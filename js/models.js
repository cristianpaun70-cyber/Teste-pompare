/* Teste de pompare — modele pentru acvifer semi-captiv (Hantush-Jacob, de Glee) și
   cu cedare întârziată (Boulton). Soluțiile se calculează în spațiul Laplace și se
   inversează numeric (Stehfest). Unități: Q în m³/zi, T în m²/zi, t în zile, r și L în m. */
(function (global) {
  "use strict";

  /* ---------- funcția Bessel modificată K0 (precizie ~1e-14) ---------- */
  const GAMMA = 0.5772156649015329;
  function K0(x) {
    if (!(x > 0)) return Infinity;
    if (x <= 2) {
      // serie: K0 = -(ln(x/2) + γ)·I0 + Σ (x²/4)^k/(k!)²·H_k
      const y = x * x / 4;
      let term = 1, I0 = 1, S = 0, H = 0;
      for (let k = 1; k < 40; k++) {
        term *= y / (k * k); H += 1 / k;
        I0 += term; S += term * H;
        if (term < 1e-17 * I0) break;
      }
      return -(Math.log(x / 2) + GAMMA) * I0 + S;
    }
    if (x > 700) return 0;
    // K0(x) = ∫₀^∞ exp(−x·cosh t) dt, regula trapezelor (convergență exponențială)
    const h = 0.2 / Math.max(1, Math.sqrt(x / 2)), tmax = Math.acosh(Math.max(1, 745 / x));
    let s = 0.5 * Math.exp(-x);
    for (let t = h; t <= tmax; t += h) s += Math.exp(-x * Math.cosh(t));
    return s * h;
  }

  /* ---------- inversarea Stehfest ---------- */
  function stehfestV(N) {
    const fact = n => { let f = 1; for (let i = 2; i <= n; i++) f *= i; return f; };
    const V = [], N2 = N / 2;
    for (let i = 1; i <= N; i++) {
      let s = 0;
      for (let k = Math.floor((i + 1) / 2); k <= Math.min(i, N2); k++)
        s += Math.pow(k, N2) * fact(2 * k) / (fact(N2 - k) * fact(k) * fact(k - 1) * fact(i - k) * fact(2 * k - i));
      V.push(((i + N2) % 2 ? -1 : 1) * s);
    }
    return V;
  }
  const NST = 12, VST = stehfestV(NST);
  function invert(F, t) {
    const a = Math.LN2 / t;
    let s = 0;
    for (let i = 1; i <= NST; i++) s += VST[i - 1] * F(i * a);
    return a * s;
  }

  /* ---------- soluții ---------- */
  // Theis în Laplace (folosit pentru verificare): s̄ = Q/(2πTp)·K0(r·√(pS/T))
  function theisL(Q, T, S, r, t) { return invert(p => Q / (2 * Math.PI * T * p) * K0(r * Math.sqrt(p * S / T)), t); }
  // Hantush-Jacob: q² = pS/T + 1/L², L = √(T·c)
  function hantushS(Q, T, S, L, r, t) { return invert(p => Q / (2 * Math.PI * T * p) * K0(r * Math.sqrt(p * S / T + 1 / (L * L))), t); }
  // regim stabilizat în acvifer drenant (de Glee): s = Q/(2πT)·K0(r/L)
  function deGleeS(Q, T, L, r) { return Q / (2 * Math.PI * T) * K0(r / L); }
  // Boulton (1963): q² = (p/T)·(S + α·Sy/(p + α))
  function boultonS(Q, T, S, Sy, a, r, t) { return invert(p => Q / (2 * Math.PI * T * p) * K0(r * Math.sqrt(p / T * (S + a * Sy / (p + a)))), t); }

  /* ---------- Nelder-Mead în n dimensiuni ---------- */
  function nelderN(f, x0, step, iters) {
    const n = x0.length;
    let P = [x0.slice()];
    for (let i = 0; i < n; i++) { const x = x0.slice(); x[i] += Array.isArray(step) ? step[i] : step; P.push(x); }
    P = P.map(p => ({ p, v: f(p) }));
    const comb = (a, b, t) => a.map((ai, i) => ai + t * (b[i] - ai));
    for (let k = 0; k < iters; k++) {
      P.sort((a, b) => a.v - b.v);
      let size = 0; for (let i = 1; i <= n; i++) for (let j = 0; j < n; j++) size = Math.max(size, Math.abs(P[i].p[j] - P[0].p[j]));
      if (size < 1e-7) break;
      const c = new Array(n).fill(0);
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) c[j] += P[i].p[j] / n;
      const Wt = P[n];
      const xr = comb(Wt.p, c, 2), fr = f(xr);
      if (fr < P[0].v) { const xe = comb(Wt.p, c, 3), fe = f(xe); P[n] = fe < fr ? { p: xe, v: fe } : { p: xr, v: fr }; }
      else if (fr < P[n - 1].v) P[n] = { p: xr, v: fr };
      else {
        const xc = comb(Wt.p, c, 0.5), fc = f(xc);
        if (fc < Wt.v) P[n] = { p: xc, v: fc };
        else for (let i = 1; i <= n; i++) { const xs = comb(P[0].p, P[i].p, 0.5); P[i] = { p: xs, v: f(xs) }; }
      }
    }
    P.sort((a, b) => a.v - b.v);
    return P[0];
  }

  /* ---------- ajustări pe citiri (pts: [{t (min), s (m)}]) ---------- */
  const cache = new Map();
  const key = (tag, Q, r, pts, extra) => tag + "|" + Q + "|" + r + "|" + (extra || "") + "|" + pts.map(p => p.t + ":" + p.s.toFixed(5)).join(",");
  function remember(k, fn) { if (cache.has(k)) return cache.get(k); const v = fn(); if (cache.size > 200) cache.clear(); cache.set(k, v); return v; }

  function fitHantush(Q, r, pts, T0, S0) {
    return remember(key("H", Q, r, pts, T0.toPrecision(4) + "," + S0.toPrecision(4)), () => {
      const f = p => {
        const T = 10 ** p[0], S = 10 ** p[1], L = 10 ** p[2];
        if (T < 1e-3 || T > 1e7 || S < 1e-8 || S > 0.5 || L < r * 0.05 || L > 1e6) return 1e30;
        let e = 0; for (const q of pts) { const d = q.s - hantushS(Q, T, S, L, r, q.t / 1440); e += d * d; } return e;
      };
      let best = null;
      for (const m of [2, 6, 20, 80]) {
        const L0 = Math.max(r * m, 5);
        let b = nelderN(f, [Math.log10(T0), Math.log10(S0), Math.log10(L0)], [0.2, 0.3, 0.3], 500);
        b = nelderN(f, b.p, [0.04, 0.06, 0.06], 300);
        if (!best || b.v < best.v) best = b;
      }
      const T = 10 ** best.p[0], S = 10 ** best.p[1], L = 10 ** best.p[2];
      return { T, S, L, c: L * L / T, rmse: Math.sqrt(best.v / pts.length), n: pts.length };
    });
  }

  function fitBoulton(Q, r, pts, T0, Sy0) {
    return remember(key("B", Q, r, pts, T0.toPrecision(4) + "," + Sy0.toPrecision(4)), () => {
      const f = p => {
        const T = 10 ** p[0], S = 10 ** p[1], Sy = 10 ** p[2], a = 10 ** p[3];
        if (T < 1e-3 || T > 1e7 || S < 1e-7 || Sy > 0.6 || Sy < 2e-4 || S > Sy || a < 1e-4 || a > 1e5) return 1e30;
        let e = 0; for (const q of pts) { const d = q.s - boultonS(Q, T, S, Sy, a, r, q.t / 1440); e += d * d; } return e;
      };
      const tmid = Math.sqrt(pts[0].t * pts[pts.length - 1].t) / 1440;
      let best = null;
      for (const am of [0.1, 1, 10]) for (const sr of [0.003, 0.03]) {
        const a0 = am / tmid;
        let b = nelderN(f, [Math.log10(T0), Math.log10(Sy0 * sr), Math.log10(Sy0), Math.log10(a0)], [0.2, 0.4, 0.2, 0.4], 600);
        if (!best || b.v < best.v) best = b;
      }
      best = nelderN(f, best.p, [0.04, 0.08, 0.04, 0.08], 500);
      const T = 10 ** best.p[0], S = 10 ** best.p[1], Sy = 10 ** best.p[2], a = 10 ** best.p[3];
      return { T, S, Sy, alpha: a, D: Math.sqrt(T / (a * Sy)), rmse: Math.sqrt(best.v / pts.length), n: pts.length };
    });
  }

  // de Glee: denivelări stabilizate în ≥ 2 piezometre (vals: [{r, s}])
  function fitDeGlee(Q, vals, T0) {
    const f = p => {
      const T = 10 ** p[0], L = 10 ** p[1];
      if (T < 1e-3 || T > 1e7 || L < 1 || L > 1e6) return 1e30;
      let e = 0; for (const v of vals) { const d = v.s - deGleeS(Q, T, L, v.r); e += d * d; } return e;
    };
    let best = null;
    for (const L0 of [30, 100, 300, 1000, 3000]) { const b = nelderN(f, [Math.log10(T0), Math.log10(L0)], [0.2, 0.3], 600); if (!best || b.v < best.v) best = b; }
    const T = 10 ** best.p[0], L = 10 ** best.p[1];
    return { T, L, c: L * L / T, rmse: Math.sqrt(best.v / vals.length) };
  }

  global.PTM = { K0, invert, theisL, hantushS, deGleeS, boultonS, nelderN, fitHantush, fitBoulton, fitDeGlee, stehfestV };
})(typeof window !== "undefined" ? window : globalThis);
