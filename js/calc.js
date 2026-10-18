/* Teste de pompare — modul de calcul (fără dependențe)
   Unități interne: Q în m³/zi, t în minute la intrare și în zile în formule, lungimi în m.
   Suportă 1–3 puncte de măsură (piezometre sau puțul de pompare). */
(function (global) {
  "use strict";

  /* ---------- funcții matematice ---------- */
  // Funcția de puț Theis W(u) = E1(u)
  function W(u) {
    if (!(u > 0)) return Infinity;
    if (u < 1) {
      let s = -0.5772156649015329 - Math.log(u), term = 1;
      for (let n = 1; n < 60; n++) { term *= -u / n; s -= term / n; if (Math.abs(term / n) < 1e-16) break; }
      return s;
    }
    return Math.exp(-u) / u * (u * u + 2.334733 * u + 0.250621) / (u * u + 3.330657 * u + 1.681534); // A&S 5.1.56
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

  const QF = { ls: 86.4, mh: 24, md: 1 };
  const QU = { ls: "l/s", mh: "m³/h", md: "m³/zi" };
  const COLORS = ["#d08c2c", "#2a9d8f", "#8a5cc2"];

  /* ---------- analiza unui punct de măsură ---------- */
  function analyzePoint(ctx, P, idx) {
    const { Q, b, corr, modeH, R } = ctx;
    const r = num(P.r), NS = num(P.ns), isPW = !!P.pw, name = (P.name || "").trim() || "P" + (idx + 1);
    const notes = [];
    const tag = s => `${name}: ${s}`;
    const toS = v => modeH ? v - NS : v;
    const cor = s => corr && b > 0 ? s - s * s / (2 * b) : s;
    const KofT = T => b > 0 ? T / b : NaN;
    const pt = { idx, name, r, NS, isPW, color: COLORS[idx], notes, cj: null, th: null, re: null };

    if (!(r > 0)) notes.push(["warn", tag("introdu distanța r de la puțul de pompare.")]);
    if (modeH && !isFinite(NS)) notes.push(["bad", tag("introdu nivelul static, ca să se poată calcula denivelarea.")]);

    pt.pump = ctx.pump.map(row => ({ t: row.t, v: row.v[idx] })).filter(p => p.t > 0 && isFinite(p.v))
      .map(p => ({ t: p.t, v: p.v, sr: toS(p.v), s: cor(toS(p.v)) }));
    pt.smax = pt.pump.length ? Math.max(...pt.pump.map(p => p.sr)) : NaN;
    if (ctx.unconf && b > 0 && pt.smax > 0.25 * b)
      notes.push(["warn", tag(`denivelarea maximă (${fs(pt.smax)} m) depășește 25 % din grosimea saturată; corecția Jacob devine aproximativă.`)]);

    const pos = pt.pump.filter(p => p.s > 0);

    /* Theis (prima, pentru a putea alege automat intervalul Cooper-Jacob) */
    const thPts = pos.filter(p => inRange(p.t, R.b1, R.b2));
    const fitTheis = (pts, T0, S0) => {
      const f = p => {
        const T = Math.pow(10, p[0]), S = Math.pow(10, p[1]);
        if (S > 0.5 || S < 1e-9 || T < 1e-4 || T > 1e7) return 1e30;
        let e = 0; for (const q of pts) { const d = q.s - theisS(Q, T, S, r, q.t / 1440); e += d * d; } return e;
      };
      let best = nelder(f, [Math.log10(T0), Math.log10(S0)], 0.3, 600);
      best = nelder(f, best.p, 0.05, 400);
      return { T: Math.pow(10, best.p[0]), S: Math.pow(10, best.p[1]), rmse: Math.sqrt(best.v / pts.length) };
    };

    /* Cooper-Jacob pe un set de puncte */
    const cjFit = pts => {
      const L = linreg(pts.map(p => Math.log10(p.t)), pts.map(p => p.s));
      if (!L || !(L.m > 0)) return null;
      const T = 0.183 * Q / L.m, t0 = Math.pow(10, -L.a / L.m);
      const S = r > 0 ? 2.25 * T * (t0 / 1440) / (r * r) : NaN;
      return { T, S, ds: L.m, a: L.a, t0, r2: L.r2, n: pts.length, t1: pts[0].t, t2: pts[pts.length - 1].t };
    };

    if (Q > 0 && pos.length >= 3) {
      let start = R.a1, auto = !isFinite(R.a1);
      const inEnd = p => !isFinite(R.a2) || p.t <= R.a2;
      if (auto) {
        if (isPW) start = 10;
        else {
          // estimare inițială: C-J pe a doua jumătate (scară log), apoi pragul u < 0,05
          const lt = pos.map(p => Math.log10(p.t)), mid = (Math.min(...lt) + Math.max(...lt)) / 2;
          let est = cjFit(pos.filter(p => Math.log10(p.t) >= mid && inEnd(p)));
          if (est && r > 0) {
            for (let it = 0; it < 3; it++) {
              const tu = r * r * est.S / (4 * est.T * 0.05) * 1440;
              const sub = pos.filter(p => p.t >= tu && inEnd(p));
              if (sub.length < 3) { start = tu; break; }
              const e2 = cjFit(sub); if (!e2) break; est = e2; start = tu;
            }
          }
        }
      }
      let cjPts = pos.filter(p => (!isFinite(start) || p.t >= start) && inEnd(p));
      if (cjPts.length < 3) {
        if (auto) { cjPts = pos.filter(inEnd).slice(-Math.max(3, Math.ceil(pos.length / 3))); notes.push(["warn", tag("prea puține citiri cu u < 0,05; Cooper-Jacob s-a aplicat pe ultimele citiri. Testul ar fi trebuit să fie mai lung sau piezometrul mai aproape.")]); }
      }
      if (cjPts.length >= 3) {
        const c = cjFit(cjPts);
        if (c) {
          c.u = r > 0 ? r * r * c.S / (4 * c.T * (c.t1 / 1440)) : NaN;
          c.K = KofT(c.T); c.auto = auto;
          pt.cj = c;
          if (isFinite(c.u) && !isPW) {
            if (c.u < 0.05) notes.push(["ok", tag(`Cooper-Jacob de la ${fs(c.t1)} min${auto ? " (ales automat)" : ""}; u = ${fs(c.u, 2)} < 0,05, aproximația dreptei este valabilă.`)]);
            else notes.push(["warn", tag(`Cooper-Jacob: u = ${fs(c.u, 2)} la ${fs(c.t1)} min (> 0,05). Începe intervalul de la cel puțin ${fs(c.t1 * c.u / 0.05, 2)} min.`)]);
          }
          if (c.r2 < 0.97) notes.push(["warn", tag(`citirile din intervalul Cooper-Jacob nu stau bine pe o dreaptă (R² = ${fs(c.r2, 3)}). Verifică graficul (limită, alimentare, cedare întârziată).`)]);
        } else notes.push(["bad", tag("Cooper-Jacob: panta rezultată nu este pozitivă. Verifică citirile și intervalul.")]);
      }
    } else if (pt.pump.length) notes.push(["warn", tag("sunt necesare cel puțin 3 citiri cu denivelare pozitivă.")]);

    if (Q > 0 && r > 0 && thPts.length >= 4) {
      const T0 = pt.cj ? pt.cj.T : 100;
      const S0 = pt.cj && pt.cj.S > 0 ? Math.min(Math.max(pt.cj.S, 1e-6), 0.3) : 1e-3;
      const th = fitTheis(thPts, T0, S0);
      const last = thPts[thPts.length - 1], uL = r * r * th.S / (4 * th.T * (last.t / 1440)), WL = W(uL);
      Object.assign(th, { n: thPts.length, K: KofT(th.T), t1: thPts[0].t, t2: last.t,
        check: { t: last.t, u: uL, W: WL, s: Q / (4 * Math.PI * th.T) * WL, smeas: last.s } });
      pt.th = th;
      if (th.rmse > 0.05 * pt.smax) notes.push(["warn", tag("curba Theis nu urmărește bine citirile (eroare peste 5 % din denivelarea maximă). Pot exista limite, drenanță sau cedare întârziată; restrânge intervalul.")]);
    }

    /* Revenire */
    const tp = ctx.tp;
    pt.rec = ctx.rec.map(row => ({ t: row.t, v: row.v[idx] })).filter(p => p.t > 0 && isFinite(p.v))
      .map(p => ({ t: p.t, v: p.v, x: (tp + p.t) / p.t, sr: toS(p.v), s: cor(toS(p.v)) })).filter(p => isFinite(p.x));
    if (pt.rec.length) {
      // automat: la revenire dreapta e valabilă când u′ = r²S/(4T·t′) < 0,05, adică pentru t′ suficient de mare
      let xmax = R.c2, autoRe = !isFinite(R.c2);
      const est = pt.th || pt.cj;
      if (autoRe && !isPW && est && r > 0 && est.S > 0) {
        const tmin = r * r * est.S / (4 * est.T * 0.05) * 1440;
        xmax = (tp + tmin) / tmin;
      }
      let use = pt.rec.filter(p => inRange(p.x, R.c1, xmax));
      if (use.length < 3 && autoRe) {
        use = pt.rec.slice().sort((a, b) => a.x - b.x).slice(0, Math.min(pt.rec.length, Math.max(3, Math.ceil(pt.rec.length / 3))));
        if (use.length >= 3) notes.push(["warn", tag("la revenire sunt prea puține citiri târzii cu u′ < 0,05; s-au folosit ultimele citiri. Revenirea ar fi trebuit urmărită mai mult timp.")]);
      }
      pt.rec.forEach(p => p.on = use.includes(p));
      if (Q > 0 && isFinite(tp) && use.length >= 3) {
        const L = linreg(use.map(p => Math.log10(p.x)), use.map(p => p.s));
        if (L && L.m > 0) {
          const T = 0.183 * Q / L.m;
          const xs = use.map(p => p.x);
          pt.re = { T, ds: L.m, a: L.a, r2: L.r2, n: use.length, tp, K: KofT(T), auto: autoRe, xmin: Math.min(...xs), xmax: Math.max(...xs), t1: Math.min(...use.map(p => p.t)) };
          const rel = pt.smax > 0 ? L.a / pt.smax : 0;
          if (Math.abs(rel) > 0.05) notes.push(["warn", tag(L.a > 0
            ? `la revenire, dreapta nu trece prin s′ = 0 la t/t′ = 1 (rămân ${fs(L.a, 2)} m): posibilă limită impermeabilă sau volum limitat.`
            : `la revenire, dreapta coboară sub zero la t/t′ = 1: posibilă alimentare sau debit real mai mic decât cel notat.`)]);
        } else notes.push(["bad", tag("revenire: panta rezultată nu este pozitivă.")]);
      }
    }
    if (isPW && (pt.cj || pt.th)) notes.push(["info", tag("măsurat în puțul de pompare: T din pantă este corect, dar S este afectat de pierderile din filtru și nu se folosește.")]);
    return pt;
  }

  /* interpolare în scară log a timpului */
  function sAt(pump, t) {
    const P = pump.filter(p => isFinite(p.s));
    for (let i = 0; i < P.length; i++) {
      if (Math.abs(P[i].t - t) < 1e-9) return P[i];
      if (i && P[i - 1].t < t && P[i].t > t) {
        const f = (Math.log(t) - Math.log(P[i - 1].t)) / (Math.log(P[i].t) - Math.log(P[i - 1].t));
        return { t, s: P[i - 1].s + f * (P[i].s - P[i - 1].s), sr: P[i - 1].sr + f * (P[i].sr - P[i - 1].sr), interp: true };
      }
    }
    return null;
  }

  /* ---------- analiza completă ---------- */
  function analyze(raw) {
    const Qin = num(raw.q), qu = raw.qu || "mh";
    const n = Math.min(3, Math.max(1, parseInt(raw.n, 10) || 1));
    const inp = { Qin, qu, quLabel: QU[qu], qf: QF[qu], Q: Qin * QF[qu], b: num(raw.b), unconf: raw.aq === "u", modeH: raw.mode === "h", n };
    inp.corr = inp.unconf && !!raw.corr;
    const R = { a1: num(raw.cj1), a2: num(raw.cj2), b1: num(raw.th1), b2: num(raw.th2), c1: num(raw.rr1), c2: num(raw.rr2) };
    const rows = arr => (arr || []).map(r => ({ t: num(r.t), v: [0, 1, 2].map(i => num((r.v || [])[i])) })).filter(r => isFinite(r.t)).sort((a, b) => a.t - b.t);
    const pump = rows(raw.pump), rec = rows(raw.rec);
    const tpIn = num(raw.tp);
    const lastT = pump.length ? pump[pump.length - 1].t : NaN;
    inp.tp = isFinite(tpIn) ? tpIn : lastT;
    const notes = [];
    const { Q, b } = inp;
    if (!(Q > 0)) notes.push(["bad", "Introdu debitul Q."]);
    if (!(b > 0)) notes.push(["warn", "Fără grosimea b se poate calcula T, dar nu și K = T/b."]);

    const ctx = { Q, b, corr: inp.corr, unconf: inp.unconf, modeH: inp.modeH, R, pump, rec, tp: inp.tp };
    const points = [];
    for (let i = 0; i < n; i++) points.push(analyzePoint(ctx, (raw.pts || [])[i] || {}, i));
    points.forEach(p => notes.push(...p.notes));

    /* distanță – denivelare / Thiem (≥ 2 piezometre) */
    let dist = null;
    const pz = points.filter(p => !p.isPW && p.r > 0 && p.pump.length);
    if (pz.length >= 2 && Q > 0) {
      let tstar = num(raw.tstar), autoT = !isFinite(tstar);
      if (autoT) tstar = Math.min(...pz.map(p => p.pump[p.pump.length - 1].t));
      const vals = pz.map(p => ({ p, v: sAt(p.pump, tstar) })).filter(x => x.v && x.v.s > 0);
      const rs = new Set(vals.map(x => x.p.r));
      if (vals.length >= 2 && rs.size >= 2) {
        const L = linreg(vals.map(x => Math.log10(x.p.r)), vals.map(x => x.v.s));
        if (L && L.m < 0) {
          const dsR = -L.m, T = 0.366 * Q / dsR, r0 = Math.pow(10, L.a / dsR);
          const S = 2.25 * T * (tstar / 1440) / (r0 * r0);
          dist = { tstar, autoT, vals: vals.map(x => ({ name: x.p.name, r: x.p.r, s: x.v.s, sr: x.v.sr, interp: !!x.v.interp, color: x.p.color })), dsR, a: L.a, r2: L.r2, T, S, r0, K: b > 0 ? T / b : NaN };
          if (inp.unconf && b > 0) {
            const L2 = linreg(vals.map(x => Math.log(x.p.r)), vals.map(x => Math.pow(b - x.v.sr, 2)));
            if (L2 && L2.m > 0) { dist.dupuitK = Q / (Math.PI * L2.m); dist.dupuitT = dist.dupuitK * b; }
          }
          const far = vals.reduce((m, x) => x.p.r > m.r ? x.p : m, vals[0].p);
          const uFar = far.r * far.r * S / (4 * T * (tstar / 1440));
          dist.uFar = uFar;
          if (uFar < 0.05) notes.push(["ok", `Distanță–denivelare la t = ${fs(tstar)} min: u = ${fs(uFar, 2)} în cel mai îndepărtat piezometru (< 0,05), metoda este valabilă.`]);
          else notes.push(["warn", `Distanță–denivelare: u = ${fs(uFar, 2)} în cel mai îndepărtat piezometru (> 0,05). Alege un moment mai târziu sau verifică dacă regimul e stabilizat.`]);
          if (vals.length >= 3 && L.r2 < 0.98) notes.push(["warn", `Cele ${vals.length} piezometre nu stau bine pe o dreaptă s – lg r (R² = ${fs(L.r2, 3)}): posibilă anizotropie, limită sau piezometru defect.`]);
        } else notes.push(["bad", "Distanță–denivelare: denivelarea nu scade cu distanța. Verifică distanțele r și citirile."]);
      }
    }

    /* sinteză */
    const all = [];
    points.forEach(p => [["Cooper-Jacob", p.cj], ["Theis", p.th], ["Revenire", p.re]].forEach(([m, x]) => { if (x) all.push({ pt: p.name, method: m, T: x.T, K: x.K, S: p.isPW ? NaN : x.S, pw: p.isPW }); }));
    if (dist) all.push({ pt: dist.vals.map(v => v.name).join("–"), method: inp.unconf && dist.dupuitK ? "Dupuit-Thiem" : "Distanță–denivelare (Thiem)", T: inp.unconf && dist.dupuitT ? dist.dupuitT : dist.T, K: inp.unconf && dist.dupuitK ? dist.dupuitK : dist.K, S: inp.unconf && dist.dupuitK ? NaN : dist.S });
    const Ts = all.map(x => x.T).filter(isFinite);
    let summary = null;
    if (Ts.length) {
      const Tm = Ts.reduce((a, c) => a + c, 0) / Ts.length, spread = (Math.max(...Ts) - Math.min(...Ts)) / Tm;
      const Ss = points.filter(p => !p.isPW && p.th).map(p => p.th.S);
      summary = { n: Ts.length, Tm, Km: b > 0 ? Tm / b : NaN, Kmin: b > 0 ? Math.min(...Ts) / b : NaN, Kmax: b > 0 ? Math.max(...Ts) / b : NaN, spread,
        S: Ss.length ? Ss.reduce((a, c) => a + c, 0) / Ss.length : (dist && dist.S) || NaN };
      if (Ts.length > 1) notes.unshift(spread < 0.2
        ? ["ok", `Rezultatele sunt apropiate (abatere maximă ${fs(spread * 100, 2)} % față de medie). Rezultatul este consecvent.`]
        : ["warn", `Rezultatele diferă cu ${fs(spread * 100, 2)} %. Media este doar orientativă; verifică pe grafice care porțiune a datelor e reprezentativă.`]);
    }
    return { inp, R, points, dist, all, summary, notes, pumpRows: pump, recRows: rec };
  }

  global.PT = { W, theisS, linreg, nelder, num, fs, fd, sci, sciTxt, fS, supNum, inRange, analyze, QU, COLORS };
})(window);
