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
    const r = num(P.r), NS = num(P.ns), isPW = !!P.pw, rc = num(P.rc), name = (P.name || "").trim() || "P" + (idx + 1);
    const notes = [];
    const tag = s => `${name}: ${s}`;
    const toS = v => modeH ? v - NS : v;
    const cor = s => corr && b > 0 ? s - s * s / (2 * b) : s;
    const KofT = T => b > 0 ? T / b : NaN;
    const pt = { idx, name, r, NS, isPW, rc, color: COLORS[idx], notes, cj: null, th: null, re: null };

    if (!(r > 0)) notes.push(["warn", tag("introdu distanța r de la puțul de pompare.")]);
    if (modeH && !isFinite(NS)) notes.push(["bad", tag("introdu nivelul static, ca să se poată calcula denivelarea.")]);

    pt.pump = ctx.pump.map(row => ({ t: row.t, v: row.v[idx] })).filter(p => p.t > 0 && isFinite(p.v))
      .map(p => ({ t: p.t, v: p.v, sr: toS(p.v), s: cor(toS(p.v)) }));
    pt.smax = pt.pump.length ? Math.max(...pt.pump.map(p => p.sr)) : NaN;
    pt.over25 = ctx.unconf && b > 0 && pt.smax > 0.25 * b;
    if (pt.over25)
      notes.push(["warn", tag(`denivelarea maximă (${fs(pt.smax)} m) depășește 25 % din grosimea saturată; corecția Jacob nu mai este suficientă, iar rezultatele acestui punct sunt excluse din medie.`)]);

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
      let startBasis = "";
      if (auto) {
        if (isPW) {
          // efectul volumului de apă din puț: t > 25·rc²/T (Papadopulos-Cooper)
          const lt = pos.map(p => Math.log10(p.t)), mid = (Math.min(...lt) + Math.max(...lt)) / 2;
          const est = cjFit(pos.filter(p => Math.log10(p.t) >= mid && inEnd(p)));
          if (rc > 0 && est) { start = 25 * rc * rc / est.T * 1440; startBasis = "rc"; }
          else { start = 10; startBasis = "implicit"; notes.push(["warn", tag("completează raza coloanei rc, ca începutul dreptei să fie calculat din efectul volumului de apă din puț (s-au folosit implicit citirile de la 10 min).")]); }
        } else {
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
          c.K = KofT(c.T); c.auto = auto; c.startBasis = startBasis;
          if (isPW && rc > 0) c.tws = 25 * rc * rc / c.T * 1440;
          pt.cj = c;
          if (isFinite(c.u) && !isPW) {
            if (c.u < 0.05) notes.push(["ok", tag(`Cooper-Jacob de la ${fs(c.t1)} min${auto ? " (ales automat)" : ""}; u = ${fs(c.u, 2)} < 0,05, condiția aproximației este îndeplinită.`)]);
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
      let use = pt.rec.filter(p => inRange(p.x, R.c1, xmax)), fallback = false;
      if (use.length < 3 && autoRe) {
        fallback = true;
        use = pt.rec.slice().sort((a, b) => a.x - b.x).slice(0, Math.min(pt.rec.length, Math.max(3, Math.ceil(pt.rec.length / 3))));
        if (use.length >= 3) notes.push(["warn", tag("la revenire sunt prea puține citiri târzii cu u′ < 0,05; s-au folosit ultimele citiri. Revenirea ar fi trebuit urmărită mai mult timp.")]);
      }
      pt.rec.forEach(p => p.on = use.includes(p));
      if (Q > 0 && isFinite(tp) && use.length >= 3) {
        const L = linreg(use.map(p => Math.log10(p.x)), use.map(p => p.s));
        if (L && L.m > 0) {
          const T = 0.183 * Q / L.m;
          const xs = use.map(p => p.x);
          pt.re = { T, ds: L.m, a: L.a, r2: L.r2, n: use.length, tp, K: KofT(T), auto: autoRe, fallback, xmin: Math.min(...xs), xmax: Math.max(...xs), t1: Math.min(...use.map(p => p.t)) };
          const eS = (pt.th || pt.cj);
          pt.re.uRe = !isPW && eS && eS.S > 0 && r > 0 ? r * r * eS.S / (4 * eS.T * (pt.re.t1 / 1440)) : NaN;
          const rel = pt.smax > 0 ? L.a / pt.smax : 0;
          if (Math.abs(rel) > 0.05) notes.push(["warn", tag(L.a > 0
            ? `la revenire, dreapta nu trece prin s′ = 0 la t/t′ = 1 (rămân ${fs(L.a, 2)} m): posibilă limită impermeabilă sau volum limitat.`
            : `la revenire, dreapta coboară sub zero la t/t′ = 1: posibilă alimentare sau debit real mai mic decât cel notat.`)]);
        } else notes.push(["bad", tag("revenire: panta rezultată nu este pozitivă.")]);
      }
    }
    if (isPW && (pt.cj || pt.th)) notes.push(["info", tag("măsurat în puțul de pompare: se folosește doar T, din porțiunea de după efectul volumului de apă din puț; S este afectat de pierderile din filtru și nu se folosește. Verifică pe grafic că porțiunea folosită este o dreaptă.")]);
    return pt;
  }


  /* ---------- testul în trepte ---------- */
  function analyzeStep(st, Tmain) {
    if (!st) return null;
    const NS = num(st.ns), zp = num(st.zp), rez = isFinite(num(st.rez)) ? num(st.rez) : 1.5, pct = isFinite(num(st.pct)) ? num(st.pct) / 100 : 0.7;
    const tstep = num(st.tstep), tmain = isFinite(num(st.tmain)) ? num(st.tmain) : 1440;
    const Tin = num(st.tcorr), Tc = Tin > 0 ? Tin : (Tmain > 0 ? Tmain : NaN), Tsrc = Tin > 0 ? "introdus" : (Tmain > 0 ? "din fila Calcul" : "");
    const modeH = st.mode !== "s";
    const rows = (st.rows || []).map((r, i) => ({ i, Qh: num(r.q), v: num(r.v) })).filter(r => r.Qh > 0 && isFinite(r.v))
      .map(r => { const s = modeH ? r.v - NS : r.v, Qd = r.Qh * 24; return Object.assign(r, { s, Qd, sq: s / Qd }); }).filter(r => r.s > 0);
    const out = { NS, zp, rez, pct, modeH, rows, tstep, tmain, Tc, Tsrc, notes: [] };
    if (modeH && !isFinite(NS)) out.notes.push(["bad", "Introdu nivelul static al puțului."]);
    if (rows.length < 2) return rows.length ? out : (isFinite(NS) || isFinite(zp) ? out : null);
    const L = linreg(rows.map(r => r.Qd), rows.map(r => r.sq));
    if (!L) return out;
    out.Bfit = L.a; out.C = L.m; out.r2 = L.r2;
    if (rows.length >= 3 && L.r2 < 0.9) out.notes.push(["warn", `Punctele s/Q nu stau bine pe o dreaptă (R² = ${fs(L.r2, 3)}). Verifică dacă treptele au avut aceeași durată.`]);
    let B, C;
    if (!(out.C > 0)) {
      // model nefizic: refacem ajustarea cu restricția C = 0 (s = B·Q, prin origine)
      out.invalid = true;
      let sq = 0, qq = 0; rows.forEach(r => { sq += r.s * r.Qd; qq += r.Qd * r.Qd; });
      B = sq / qq; C = 0;
      out.notes.push(["bad", "C iese zero sau negativ: pierderile neliniare din puț nu se pot determina, iar testul în trepte nu poate fi interpretat. Cauze tipice: trepte de durate diferite, puțul s-a dezvoltat în timpul testului, debite citite greșit. Repetă testul. Randamentul nu se calculează; debitul orientativ de mai jos folosește doar o dreaptă s = B·Q prin origine și subestimează denivelarea la debite mari."]);
    } else { B = L.a; C = L.m; }
    if (!(B > 0)) { out.notes.push(["bad", "B iese zero sau negativ: verifică debitele și nivelurile treptelor."]); return out; }
    out.B = B; out.Ceff = C;
    // corecția lui B pentru durata testului principal (componenta din strat crește cu lg t)
    out.dB = tstep > 0 && Tc > 0 && tmain > tstep ? 0.183 / Tc * Math.log10(tmain / tstep) : 0;
    out.Bm = B + out.dB;
    out.corrected = out.dB > 0;
    if (!out.corrected) out.notes.push(["info", "Completează durata unei trepte și T (sau calculează mai întâi fila Calcul), ca B să fie corectat pentru durata testului principal. Fără corecție, debitul orientativ este supraestimat."]);
    const sOf = (Q, Bx) => (Bx == null ? B : Bx) * Q + C * Q * Q;
    out.sOf = Q => sOf(Q, B); out.sOfM = Q => sOf(Q, out.Bm);
    if (!out.invalid) rows.forEach(r => { r.E = B * r.Qd / sOf(r.Qd); });
    const qOf = (Bx, sl) => C > 0 ? (-Bx + Math.sqrt(Bx * Bx + 4 * C * sl)) / (2 * C) : sl / Bx;
    if (isFinite(zp) && isFinite(NS)) {
      out.sdisp = zp - NS - rez; out.slim = pct * out.sdisp;
      if (out.sdisp > 0) { out.Qor0 = qOf(B, out.slim); out.Qor = qOf(out.Bm, out.slim); }
      else out.notes.push(["bad", "Denivelarea disponibilă iese zero sau negativă: verifică adâncimea pompei, nivelul static și rezerva."]);
    }
    const qs = num(st.qsel);
    if (qs > 0) {
      const Qd = qs * 24, s = sOf(Qd, out.Bm);
      out.sel = { Qh: qs, Qd, s, s0: sOf(Qd, B), E: out.invalid ? NaN : B * Qd / sOf(Qd, B) };
      if (isFinite(out.Qor)) out.notes.push(Qd <= out.Qor ? [out.invalid ? "warn" : "ok", `Debitul ales (${fs(qs)} m³/h) este sub debitul orientativ (${fs(out.Qor / 24)} m³/h): denivelarea estimată în puț${out.corrected ? ` după ${fs(tmain)} min` : ""} este ${fs(s)} m. Urmărește nivelul din puț în primele ore ale testului principal.`]
        : ["bad", `Debitul ales (${fs(qs)} m³/h) depășește debitul orientativ (${fs(out.Qor / 24)} m³/h): nivelul din puț ar putea coborî prea aproape de pompă.`]);
      if (!out.invalid) {
        const E = out.sel.E;
        out.notes.push(E >= 0.8 ? ["ok", `Randament aparent la debitul ales: ${fs(E * 100, 2)} % (peste 80 %): pierderile neliniare din puț sunt mici. B include și pierderile liniare din puț, deci randamentul real este cel mult această valoare.`]
          : E >= 0.5 ? ["warn", `Randament aparent la debitul ales: ${fs(E * 100, 2)} % (între 50 și 80 %): pierderi neliniare însemnate; ține cont de ele la proiectarea puțurilor.`]
            : ["bad", `Randament aparent la debitul ales: ${fs(E * 100, 2)} % (sub 50 %): pierderi mari în puț; verifică filtrul și dezvoltarea puțului.`]);
      }
    }
    const qp = num(st.qpred);
    if (qp > 0) out.pred = { Qh: qp, Qd: qp * 24, s: sOf(qp * 24, out.Bm) };
    return out;
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

    /* comparația între piezometre (≥ 2): distanță–denivelare (nepermanent) SAU Thiem (stabilizat) */
    let dist = null;
    const pz = points.filter(p => !p.isPW && p.r > 0 && p.pump.length);
    if (pz.length >= 2 && Q > 0) {
      let tstar = num(raw.tstar), autoT = !isFinite(tstar);
      if (autoT) tstar = Math.min(...pz.map(p => p.pump[p.pump.length - 1].t));
      const vals = pz.map(p => ({ p, v: sAt(p.pump, tstar), v3: sAt(p.pump, tstar / 3) })).filter(x => x.v && x.v.s > 0);
      const rs = new Set(vals.map(x => x.p.r));
      if (vals.length >= 2 && rs.size >= 2) {
        const L = linreg(vals.map(x => Math.log10(x.p.r)), vals.map(x => x.v.s));
        // regimul: panta locală s – lg t în ultimul ciclu (t*/3 … t*) față de panta Cooper-Jacob
        const ratios = vals.map(x => {
          const w = x.p.pump.filter(q => q.t >= tstar / 3 && q.t <= tstar * 1.0001 && q.s > 0);
          const Lw = w.length >= 3 ? linreg(w.map(q => Math.log10(q.t)), w.map(q => q.s)) : null;
          return Lw && x.p.cj ? Lw.m / x.p.cj.ds : NaN;
        }).filter(isFinite);
        const stabDetected = ratios.length > 0 && Math.max(...ratios) < 0.25;
        const dmode = raw.dmode === "trans" || raw.dmode === "steady" ? raw.dmode : "auto";
        const regime = dmode === "auto" ? (stabDetected ? "steady" : "trans") : dmode;
        // variația lui Δs între piezometre de la t*/3 la t*
        let dsChange = NaN;
        if (vals.every(x => x.v3 && x.v3.s > 0)) {
          const L3 = linreg(vals.map(x => Math.log10(x.p.r)), vals.map(x => x.v3.s));
          if (L3 && L3.m < 0 && L.m < 0) dsChange = Math.abs(L.m - L3.m) / Math.abs(L.m);
        }
        if (L && L.m < 0) {
          const dsR = -L.m, T = 0.366 * Q / dsR;
          dist = { tstar, autoT, regime, dmode, stabDetected, ratio: ratios.length ? Math.max(...ratios) : NaN, dsChange,
            vals: vals.map(x => ({ name: x.p.name, r: x.p.r, s: x.v.s, sr: x.v.sr, interp: !!x.v.interp, color: x.p.color })), dsR, a: L.a, r2: L.r2, T, K: b > 0 ? T / b : NaN, S: NaN };
          if (regime === "trans") {
            const r0 = Math.pow(10, L.a / dsR), S = 2.25 * T * (tstar / 1440) / (r0 * r0);
            const far = vals.reduce((m, x) => x.p.r > m.r ? x.p : m, vals[0].p);
            Object.assign(dist, { r0, S, uFar: far.r * far.r * S / (4 * T * (tstar / 1440)) });
            if (dist.uFar < 0.05) notes.push(["ok", `Distanță–denivelare la t = ${fs(tstar)} min: u = ${fs(dist.uFar, 2)} în cel mai îndepărtat piezometru (< 0,05), condiția este îndeplinită.`]);
            else notes.push(["warn", `Distanță–denivelare: u = ${fs(dist.uFar, 2)} în cel mai îndepărtat piezometru (> 0,05). Alege un moment mai târziu.`]);
            if (stabDetected) notes.push(["warn", "Denivelările aproape nu mai cresc la momentul comparației (regim practic stabilizat): metoda distanță–denivelare nepermanentă nu este potrivită, iar S calculat din r₀ nu are sens. Folosește Thiem."]);
          } else {
            if (inp.unconf && b > 0) {
              const L2 = linreg(vals.map(x => Math.log(x.p.r)), vals.map(x => Math.pow(b - x.v.sr, 2)));
              if (L2 && L2.m > 0) { dist.dupuitK = Q / (Math.PI * L2.m); dist.dupuitT = dist.dupuitK * b; }
            }
            notes.push(stabDetected || dmode === "steady"
              ? ["info", `Thiem la t = ${fs(tstar)} min${dmode === "auto" ? " (regim stabilizat detectat automat)" : ""}: se calculează doar T${inp.unconf ? " (K prin Dupuit-Thiem)" : ""}; S nu se poate determina din regimul stabilizat.`]
              : ["info", "Thiem: regimul a fost ales manual."]);
            if (!stabDetected) notes.push(["warn", "Thiem: denivelările încă cresc la momentul comparației; verifică dacă regimul este cu adevărat stabilizat."]);
          }
          if (vals.length >= 3 && L.r2 < 0.98) notes.push(["warn", `Cele ${vals.length} piezometre nu stau bine pe o dreaptă s – lg r (R² = ${fs(L.r2, 3)}): posibilă anizotropie, limită sau piezometru defect.`]);
        } else notes.push(["bad", "Comparația între piezometre: denivelarea nu scade cu distanța. Verifică distanțele r și citirile."]);
      }
    }

    /* sinteză: fiecare rând = un rezultat (punct × metodă), cu verificări automate */
    const all = [];
    const incl = raw.incl || {};
    const sChk = S => {
      if (!isFinite(S) || !(S > 0)) return [];
      if (inp.unconf) return [[S < 0.01, `S = ${fS(S)} prea mic pentru nivel liber: probabil cedare întârziată — folosește doar citirile târzii`], [S > 0.35, `S = ${fS(S)} prea mare pentru nivel liber`]];
      return [[S > 5e-3, `S = ${fS(S)} prea mare pentru acvifer sub presiune (posibil nivel liber, r greșit)`], [S < 1e-6, `S = ${fS(S)} prea mic (r greșit sau piezometru în alt strat)`]];
    };
    const push = (key, group, gname, pt, method, x, S, checks, pw) => {
      const bad = checks.filter(c => c[0]).map(c => c[1]);
      const valid = bad.length === 0;
      const has = Object.prototype.hasOwnProperty.call(incl, key);
      const included = has ? !!incl[key] : valid;
      all.push({ key, group, gname, pt, method, T: x.T, K: x.K, S, pw, valid, reasons: bad, included, overridden: has });
    };
    points.forEach(p => {
      const o25 = [p.over25, `s max > 25 % din b (nivel liber)`];
      if (p.cj) push(`${p.idx}|cj`, p.idx, p.name, p.name, "Cooper-Jacob", p.cj, p.isPW ? NaN : p.cj.S,
        [[!p.isPW && isFinite(p.cj.u) && p.cj.u >= 0.05, `u = ${fs(p.cj.u, 2)} > 0,05`], [p.cj.r2 < 0.97, `R² = ${fs(p.cj.r2, 3)} < 0,97`], o25].concat(p.isPW ? [] : sChk(p.cj.S)), p.isPW);
      if (p.th) push(`${p.idx}|th`, p.idx, p.name, p.name, "Theis", p.th, p.isPW ? NaN : p.th.S,
        [[p.isPW, "în puțul pompat curba Theis e afectată de pierderile din filtru"], [p.th.rmse > 0.05 * p.smax, `eroare ${fs(p.th.rmse * 100, 2)} cm > 5 % din s max`], o25].concat(p.isPW ? [] : sChk(p.th.S)), p.isPW);
      if (p.re) push(`${p.idx}|re`, p.idx, p.name, p.name, "Revenire", p.re, NaN,
        [[Math.abs(p.re.a) > 0.05 * p.smax, `s′ la t/t′ = 1 este ${fs(p.re.a, 2)} m (departe de 0)`], [p.re.r2 < 0.97, `R² = ${fs(p.re.r2, 3)} < 0,97`],
         [isFinite(p.re.uRe) && p.re.uRe >= 0.05, `u′ = ${fs(p.re.uRe, 2)} > 0,05 la t′ = ${fs(p.re.t1)} min (lipsesc citirile târzii)`], o25], p.isPW);
    });
    if (dist) {
      const grp = "m", gn = "Între piezometre", pn = dist.vals.map(v => v.name).join("–");
      if (dist.regime === "trans") {
        push("dist", grp, gn, pn, "Distanță–denivelare (Cooper-Jacob)", dist, dist.S,
          [[dist.uFar >= 0.05, `u = ${fs(dist.uFar, 2)} > 0,05 în cel mai îndepărtat piezometru`], [dist.stabDetected, "regim practic stabilizat: folosește Thiem"],
           [dist.vals.length >= 3 && dist.r2 < 0.98, `piezometrele nu sunt aliniate (R² = ${fs(dist.r2, 3)})`]].concat(sChk(dist.S)), false);
      } else {
        const du = inp.unconf && dist.dupuitK;
        push("thiem", grp, gn, pn, du ? "Dupuit-Thiem (regim stabilizat)" : "Thiem (regim stabilizat)", { T: du ? dist.dupuitT : dist.T, K: du ? dist.dupuitK : dist.K }, NaN,
          [[!dist.stabDetected, "denivelările încă cresc: regimul nu este stabilizat"], [isFinite(dist.dsChange) && dist.dsChange > 0.05, `Δs între piezometre variază cu ${fs(dist.dsChange * 100, 2)} % în ultimul ciclu`],
           [dist.vals.length >= 3 && dist.r2 < 0.98, `piezometrele nu sunt aliniate (R² = ${fs(dist.r2, 3)})`]], false);
      }
    }
    // media pe grupuri (fiecare punct de măsură are aceeași pondere), apoi media grupurilor
    const use = all.filter(x => x.included && isFinite(x.T));
    const groups = [];
    use.forEach(x => { let g = groups.find(q => q.id === x.group); if (!g) groups.push(g = { id: x.group, name: x.gname, rows: [] }); g.rows.push(x); });
    groups.forEach(g => { g.Tm = g.rows.reduce((a, c) => a + c.T, 0) / g.rows.length; g.Km = b > 0 ? g.Tm / b : NaN; const ss = g.rows.map(x => x.S).filter(v => isFinite(v) && v > 0); g.S = ss.length ? ss.reduce((a, c) => a + c, 0) / ss.length : NaN; });
    let summary = null;
    const nExcl = all.filter(x => !x.included).length;
    if (groups.length) {
      const Tg = groups.map(g => g.Tm), Tm = Tg.reduce((a, c) => a + c, 0) / Tg.length;
      const Ts = use.map(x => x.T), spread = (Math.max(...Ts) - Math.min(...Ts)) / Tm, gspread = (Math.max(...Tg) - Math.min(...Tg)) / Tm;
      const Sg = groups.map(g => g.S).filter(isFinite);
      summary = { n: use.length, nAll: all.length, nExcl, groups, Tm, Km: b > 0 ? Tm / b : NaN, Kmin: b > 0 ? Math.min(...Ts) / b : NaN, Kmax: b > 0 ? Math.max(...Ts) / b : NaN, spread, gspread,
        S: Sg.length ? Sg.reduce((a, c) => a + c, 0) / Sg.length : NaN };
      if (use.length > 1) notes.unshift(spread < 0.2
        ? ["ok", `Rezultatele incluse sunt apropiate (abatere maximă ${fs(spread * 100, 2)} % față de media pe puncte).`]
        : ["warn", `Rezultatele incluse diferă cu ${fs(spread * 100, 2)} % (peste 20 %). Caută cauza (ghid, pasul E5) și exclude rândurile care nu corespund.`]);
      const Kad = num(raw.kad);
      summary.Kad = Kad > 0 ? Kad : NaN; summary.just = String(raw.kjust || "").trim();
      if (Kad > 0) {
        if (b > 0 && (Kad < summary.Kmin * 0.999 || Kad > summary.Kmax * 1.001)) notes.unshift(["warn", `Valoarea adoptată K = ${fs(Kad)} m/zi este în afara intervalului rezultatelor incluse (${fs(summary.Kmin)}–${fs(summary.Kmax)} m/zi). Justifică alegerea în raport.`]);
        if (!summary.just) notes.unshift(["warn", "Completează justificarea valorii adoptate; ea apare în raport."]);
      } else notes.unshift(["info", "Valoarea de proiectare nu este încă adoptată. Media pe puncte este doar orientativă: completează „K adoptat” și justificarea."]);
    }
    if (nExcl) notes.unshift(["info", `${nExcl} ${nExcl === 1 ? "rezultat este exclus" : "rezultate sunt excluse"} din medie: ${all.filter(x => !x.included).map(x => `${x.pt} ${x.method}${x.reasons.length && !x.overridden ? " (" + x.reasons.join("; ") + ")" : x.overridden ? " (exclus manual)" : ""}`).join(", ")}.`]);
    return { inp, R, points, dist, all, summary, notes, pumpRows: pump, recRows: rec, step: analyzeStep(raw.step, summary ? summary.Tm : NaN) };
  }

  global.PT = { W, theisS, linreg, nelder, num, fs, fd, sci, sciTxt, fS, supNum, inRange, analyze, analyzeStep, QU, COLORS };
})(window);
