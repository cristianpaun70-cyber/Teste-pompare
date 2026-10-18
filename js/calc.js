/* Teste de pompare — modul de calcul (fără dependențe)
   Unități interne: Q în m³/zi, t în minute la intrare și zile în formule, lungimi în m. */
(function (global) {
  "use strict";

  /* ---------- funcții matematice ---------- */
  // Funcția de puț Theis W(u) = E1(u) (integrala exponențială)
  function W(u) {
    if (!(u > 0)) return Infinity;
    if (u < 1) {
      let s = -0.5772156649015329 - Math.log(u), term = 1;
      for (let n = 1; n < 60; n++) { term *= -u / n; s -= term / n; if (Math.abs(term / n) < 1e-16) break; }
      return s;
    }
    // Abramowitz & Stegun 5.1.56
    return Math.exp(-u) / u * (u * u + 2.334733 * u + 0.250621) / (u * u + 3.330657 * u + 1.681534);
  }
  function theisS(Q, T, S, r, tDays) { return Q / (4 * Math.PI * T) * W(r * r * S / (4 * T * tDays)); }

  function linreg(x, y) {
    const n = x.length; let sx = 0, sy = 0, sxx = 0, sxy = 0, syy = 0;
    for (let i = 0; i < n; i++) { sx += x[i]; sy += y[i]; sxx += x[i] * x[i]; sxy += x[i] * y[i]; syy += y[i] * y[i]; }
    const d = n * sxx - sx * sx; if (n < 2 || d === 0) return null;
    const m = (n * sxy - sx * sy) / d, a = (sy - m * sx) / n;
    const st = syy - sy * sy / n; let se = 0;
    for (let i = 0; i < n; i++) { const e = y[i] - (a + m * x[i]); se += e * e; }
    return { m, a, r2: st > 0 ? 1 - se / st : 1 };
  }

  function nelder(f, x0, step, iters) {
    let P = [x0, [x0[0] + step, x0[1]], [x0[0], x0[1] + step]].map(p => ({ p, v: f(p) }));
    const mid = (a, b, t) => [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
    for (let k = 0; k < iters; k++) {
      P.sort((a, b) => a.v - b.v);
      const [B, G, Wt] = P;
      const size = Math.max(Math.abs(G.p[0] - B.p[0]), Math.abs(G.p[1] - B.p[1]), Math.abs(Wt.p[0] - B.p[0]), Math.abs(Wt.p[1] - B.p[1]));
      if (size < 1e-7) break;
      const c = mid(B.p, G.p, 0.5);
      const xr = mid(Wt.p, c, 2), fr = f(xr);
      if (fr < B.v) { const xe = mid(Wt.p, c, 3), fe = f(xe); P[2] = fe < fr ? { p: xe, v: fe } : { p: xr, v: fr }; }
      else if (fr < G.v) P[2] = { p: xr, v: fr };
      else {
        const xc = mid(Wt.p, c, 0.5), fc = f(xc);
        if (fc < Wt.v) P[2] = { p: xc, v: fc };
        else { const p1 = mid(B.p, G.p, 0.5), p2 = mid(B.p, Wt.p, 0.5); P[1] = { p: p1, v: f(p1) }; P[2] = { p: p2, v: f(p2) }; }
      }
    }
    P.sort((a, b) => a.v - b.v); return P[0];
  }

  /* ---------- citire și formatare ---------- */
  function num(v) { if (v == null) return NaN; v = String(v).trim().replace(",", "."); return v === "" ? NaN : Number(v); }
  function parseTable(txt) {
    const out = [];
    String(txt || "").split(/\r?\n/).forEach(l => {
      l = l.trim(); if (!l) return;
      const p = /[\t;]/.test(l) ? l.split(/[\t;]+/) : l.split(/\s+/);
      if (p.length < 2) return;
      const t = num(p[0]), v = num(p[1]);
      if (isFinite(t) && isFinite(v)) out.push([t, v]);
    });
    return out.sort((a, b) => a[0] - b[0]);
  }
  const SUP = { "-": "⁻", "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹" };
  const supNum = e => String(e).split("").map(c => SUP[c]).join("");
  function fs(x, d) { if (!isFinite(x)) return "—"; return x.toLocaleString("ro-RO", { maximumSignificantDigits: d || 3 }); }
  function fd(x, dec) { if (!isFinite(x)) return "—"; return x.toLocaleString("ro-RO", { minimumFractionDigits: dec, maximumFractionDigits: dec }); }
  function sci(x, dig) {
    if (!isFinite(x) || x <= 0) return "—";
    let e = Math.floor(Math.log10(x)), m = x / Math.pow(10, e);
    const k = dig == null ? 2 : dig;
    if (Number(m.toFixed(k)) >= 10) { m /= 10; e += 1; }
    return m.toLocaleString("ro-RO", { maximumFractionDigits: k }) + "·10" + supNum(e);
  }
  function sciTxt(x) { return isFinite(x) && x > 0 ? x.toExponential(2).replace(".", ",") : "—"; }
  function fS(x) { return !isFinite(x) ? "—" : (x < 0.01 ? sci(x) : fs(x)); }
  function inRange(v, a, b) { return (!isFinite(a) || v >= a) && (!isFinite(b) || v <= b); }

  /* ---------- analiza completă ---------- */
  const QF = { ls: 86.4, mh: 24, md: 1 };
  const QU = { ls: "l/s", mh: "m³/h", md: "m³/zi" };

  function analyze(raw) {
    const Qin = num(raw.q), qu = raw.qu || "mh";
    const inp = {
      Qin, qu, quLabel: QU[qu], qf: QF[qu], Q: Qin * QF[qu],
      b: num(raw.b), r: num(raw.r), unconf: raw.aq === "u", isPW: !!raw.pw,
      modeH: raw.mode === "h", NS: num(raw.ns)
    };
    inp.corr = inp.unconf && !!raw.corr;
    const { Q, b, r, unconf, corr, isPW, modeH, NS } = inp;
    const R = {
      a1: num(raw.cj1), a2: num(raw.cj2), b1: num(raw.th1), b2: num(raw.th2), c1: num(raw.rr1), c2: num(raw.rr2)
    };
    const notes = [];
    const toS = v => modeH ? v - NS : v;
    const cor = s => corr && b > 0 ? s - s * s / (2 * b) : s;
    const KofT = T => b > 0 ? T / b : NaN;

    if (!(Q > 0)) notes.push(["bad", "Introdu debitul Q."]);
    if (!(b > 0)) notes.push(["warn", "Fără grosimea b se poate calcula T, dar nu și K = T/b."]);
    if (modeH && !isFinite(NS)) notes.push(["bad", "Introdu nivelul static, ca să se poată calcula denivelarea din adâncimile măsurate."]);

    const pump = parseTable(raw.pdata).filter(p => p[0] > 0).map(([t, v]) => ({ t, v, sr: toS(v), s: cor(toS(v)) }));
    const smax = pump.length ? Math.max(...pump.map(p => p.sr)) : NaN;
    if (unconf && b > 0 && smax > 0.25 * b)
      notes.push(["warn", `Denivelarea maximă (${fs(smax)} m) depășește 25 % din grosimea saturată; corecția Jacob devine aproximativă.`]);

    const out = { inp, R, pump, smax, notes, cj: null, th: null, re: null, ti: null, rec: [], summary: null };

    /* Cooper-Jacob */
    const cjPts = pump.filter(p => p.s > 0 && inRange(p.t, R.a1, R.a2));
    if (Q > 0 && cjPts.length >= 3) {
      const L = linreg(cjPts.map(p => Math.log10(p.t)), cjPts.map(p => p.s));
      if (L && L.m > 0) {
        const T = 0.183 * Q / L.m, t0 = Math.pow(10, -L.a / L.m);
        const S = r > 0 ? 2.25 * T * (t0 / 1440) / (r * r) : NaN;
        const t1 = cjPts[0].t, t2 = cjPts[cjPts.length - 1].t;
        const u = r > 0 ? r * r * S / (4 * T * (t1 / 1440)) : NaN;
        out.cj = { T, S, ds: L.m, a: L.a, t0, u, r2: L.r2, n: cjPts.length, t1, t2, K: KofT(T) };
        if (isFinite(u) && !isPW) {
          if (u < 0.05) notes.push(["ok", `Cooper-Jacob: u = ${fs(u, 2)} la începutul intervalului (< 0,05), aproximația dreptei este valabilă.`]);
          else notes.push(["warn", `Cooper-Jacob: u = ${fs(u, 2)} la începutul intervalului (> 0,05). Mută începutul intervalului la cel puțin ${fs(t1 * u / 0.05, 2)} min.`]);
        }
        if (L.r2 < 0.97) notes.push(["warn", `Punctele din intervalul Cooper-Jacob nu stau bine pe o dreaptă (R² = ${fs(L.r2, 3)}). Verifică pe grafic dacă panta se schimbă (limită, alimentare, cedare întârziată).`]);
      } else notes.push(["bad", "Cooper-Jacob: panta rezultată nu este pozitivă. Verifică datele și intervalul."]);
    } else if (pump.length) notes.push(["warn", "Cooper-Jacob: sunt necesare cel puțin 3 puncte cu s > 0 în interval."]);

    /* Theis */
    const thPts = pump.filter(p => p.s > 0 && inRange(p.t, R.b1, R.b2));
    if (Q > 0 && r > 0 && thPts.length >= 4) {
      const T0 = out.cj ? out.cj.T : 100;
      const S0 = out.cj && out.cj.S > 0 ? Math.min(Math.max(out.cj.S, 1e-6), 0.3) : 1e-3;
      const f = p => {
        const T = Math.pow(10, p[0]), S = Math.pow(10, p[1]);
        if (S > 0.5 || S < 1e-9 || T < 1e-4 || T > 1e7) return 1e30;
        let e = 0; for (const q of thPts) { const d = q.s - theisS(Q, T, S, r, q.t / 1440); e += d * d; } return e;
      };
      let best = nelder(f, [Math.log10(T0), Math.log10(S0)], 0.3, 600);
      best = nelder(f, best.p, 0.05, 400);
      const T = Math.pow(10, best.p[0]), S = Math.pow(10, best.p[1]), rmse = Math.sqrt(best.v / thPts.length);
      const last = thPts[thPts.length - 1], uL = r * r * S / (4 * T * (last.t / 1440)), WL = W(uL);
      out.th = { T, S, rmse, n: thPts.length, K: KofT(T), t1: thPts[0].t, t2: last.t,
        check: { t: last.t, u: uL, W: WL, s: Q / (4 * Math.PI * T) * WL, smeas: last.s } };
      if (rmse > 0.05 * smax) notes.push(["warn", "Theis: curba teoretică nu urmărește bine datele (eroare peste 5 % din denivelarea maximă). Datele pot fi influențate de limite, drenanță sau cedare întârziată; restrânge intervalul."]);
    } else if (pump.length && !(r > 0)) notes.push(["warn", "Theis și S necesită distanța r."]);

    /* Revenire */
    const tpIn = num(raw.tp);
    const tp = isFinite(tpIn) ? tpIn : (pump.length ? pump[pump.length - 1].t : NaN);
    inp.tp = tp;
    const rec = parseTable(raw.rdata).filter(p => p[0] > 0).map(([t, v]) => ({ t, v, x: (tp + t) / t, sr: toS(v), s: cor(toS(v)) })).filter(p => isFinite(p.x));
    out.rec = rec;
    if (rec.length) {
      const use = rec.filter(p => inRange(p.x, R.c1, R.c2));
      rec.forEach(p => p.on = use.includes(p));
      if (Q > 0 && isFinite(tp) && use.length >= 3) {
        const L = linreg(use.map(p => Math.log10(p.x)), use.map(p => p.s));
        if (L && L.m > 0) {
          const T = 0.183 * Q / L.m;
          out.re = { T, ds: L.m, a: L.a, r2: L.r2, n: use.length, tp, K: KofT(T) };
          const rel = smax > 0 ? L.a / smax : 0;
          if (Math.abs(rel) > 0.05) notes.push(["warn", L.a > 0
            ? `Revenire: dreapta nu trece prin s′ = 0 la t/t′ = 1 (rămân ${fs(L.a, 2)} m). Indică o limită impermeabilă sau un volum de apă limitat.`
            : `Revenire: dreapta coboară sub zero la t/t′ = 1. Indică alimentare (râu, drenanță) sau un debit mai mic decât cel declarat.`]);
        } else notes.push(["bad", "Revenire: panta rezultată nu este pozitivă."]);
      }
    }

    /* Thiem */
    const r1 = num(raw.r1), s1 = num(raw.s1), r2 = num(raw.r2), s2 = num(raw.s2);
    if ([r1, s1, r2, s2].every(isFinite)) {
      if (r2 > r1 && s1 > s2 && Q > 0) {
        if (unconf && b > 0) {
          const h1 = b - s1, h2 = b - s2;
          const K = Q * Math.log(r2 / r1) / (Math.PI * (h2 * h2 - h1 * h1));
          out.ti = { T: K * b, K, r1, s1, r2, s2, h1, h2, unconf: true };
        } else {
          const T = Q * Math.log(r2 / r1) / (2 * Math.PI * (s1 - s2));
          out.ti = { T, K: KofT(T), r1, s1, r2, s2, unconf: false };
        }
      } else notes.push(["bad", "Thiem: trebuie r₂ > r₁ și s₁ > s₂."]);
    }

    if (isPW && (out.cj || out.th)) notes.push(["info", "Măsurători în puțul de pompare: T din pantă este corect, dar S este afectat de pierderile din filtru și nu se folosește în proiectare."]);

    /* sinteză */
    const Ts = [out.cj, out.th, out.re, out.ti].filter(Boolean).map(m => m.T).filter(isFinite);
    if (Ts.length) {
      const Tm = Ts.reduce((a, c) => a + c, 0) / Ts.length;
      const spread = (Math.max(...Ts) - Math.min(...Ts)) / Tm;
      out.summary = { n: Ts.length, Tm, Km: KofT(Tm), Kmin: KofT(Math.min(...Ts)), Kmax: KofT(Math.max(...Ts)), spread,
        S: out.th && !isPW ? out.th.S : (out.cj && !isPW ? out.cj.S : NaN) };
      if (Ts.length > 1) notes.unshift(spread < 0.2
        ? ["ok", `Metodele dau valori apropiate (abatere ${fs(spread * 100, 2)} %). Rezultatul este consecvent.`]
        : ["warn", `Metodele diferă cu ${fs(spread * 100, 2)} %. Media este doar orientativă; verifică pe grafice care porțiune a datelor e reprezentativă.`]);
    }
    return out;
  }

  global.PT = { W, theisS, linreg, nelder, num, parseTable, fs, fd, sci, sciTxt, fS, supNum, inRange, analyze, QU };
})(window);
