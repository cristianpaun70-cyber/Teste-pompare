/* Grafice: aceeași geometrie, două ieșiri — SVG pentru site, canvas (PNG) pentru raport.
   Fiecare punct de măsură are culoarea lui; dreptele ajustate au aceeași culoare. */
(function (global) {
  "use strict";
  const { fs, supNum, theisS, inRange } = global.PT;

  const PAL = {
    grid: "#d6e4ec", gridMinor: "#e8f0f4", axis: "#6d8594", text: "#5d7483", label: "#10303f",
    pt: "#d08c2c", fit: "#1479a3", mk: "#0b4f6c",
    font: "Barlow, 'Segoe UI', Arial, sans-serif"
  };

  function decLabel(e) {
    if (e >= -3 && e <= 6) return Math.pow(10, e).toLocaleString("ro-RO", { maximumSignificantDigits: 1 });
    return "10" + supNum(e);
  }
  function niceTicks(lo, hi, n) {
    const range = hi - lo || 1, s0 = range / (n || 5), mag = Math.pow(10, Math.floor(Math.log10(s0))), nr = s0 / mag;
    const step = (nr < 1.5 ? 1 : nr < 3 ? 2 : nr < 7 ? 5 : 10) * mag;
    const t = []; for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + step * 1e-6; v += step) t.push(Math.abs(v) < step * 1e-9 ? 0 : v);
    return { t, step };
  }
  function niceMax(v) { const { t, step } = niceTicks(0, v * 1.06, 5); const top = t[t.length - 1]; return top >= v ? top : top + step; }
  function logBounds(a) {
    const lo = Math.min(...a), hi = Math.max(...a);
    return [Math.pow(10, Math.floor(Math.log10(lo))), Math.pow(10, Math.ceil(Math.log10(hi) - 1e-12))];
  }
  function darker(hex, f) {
    const n = parseInt(hex.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    const c = x => Math.max(0, Math.round(x * f)).toString(16).padStart(2, "0");
    return "#" + c(r) + c(g) + c(b);
  }

  /* ---------- geometrie comună ---------- */
  function draw(be, o, Wd, H, pal) {
    pal = pal || PAL;
    const m = { l: 56, r: 16, t: 14, b: 46 }, pw = Wd - m.l - m.r, ph = H - m.t - m.b;
    const lx = o.xLog ? Math.log10 : v => v, ly = o.yLog ? Math.log10 : v => v;
    const X0 = lx(o.x0), X1 = lx(o.x1), Y0 = ly(o.y0), Y1 = ly(o.y1);
    const sx = v => m.l + (lx(v) - X0) / (X1 - X0) * pw, sy = v => m.t + ph - (ly(v) - Y0) / (Y1 - Y0) * ph;
    const G = { stroke: pal.grid, width: 1 }, Gm = { stroke: pal.gridMinor, width: 0.8 };
    const T = { size: 11.5, color: pal.text, family: pal.font };
    be.begin(Wd, H);
    const logAxis = (lo, hi, horiz) => {
      for (let e = Math.floor(Math.log10(lo) + 1e-9); e <= Math.ceil(Math.log10(hi) - 1e-9); e++)
        for (let k = 1; k < 10; k++) {
          const v = k * Math.pow(10, e); if (v < lo * 0.999 || v > hi * 1.001) continue;
          if (horiz) { const x = sx(v); be.line(x, m.t, x, m.t + ph, k === 1 ? G : Gm); if (k === 1) be.text(x, m.t + ph + 16, decLabel(e), Object.assign({ anchor: "middle" }, T)); }
          else { const y = sy(v); be.line(m.l, y, m.l + pw, y, k === 1 ? G : Gm); if (k === 1) be.text(m.l - 7, y + 4, decLabel(e), Object.assign({ anchor: "end" }, T)); }
        }
    };
    if (o.xLog) logAxis(o.x0, o.x1, true);
    if (o.yLog) logAxis(o.y0, o.y1, false);
    else niceTicks(o.y0, o.y1, 5).t.forEach(v => { const y = sy(v); be.line(m.l, y, m.l + pw, y, G); be.text(m.l - 7, y + 4, fs(v, 3), Object.assign({ anchor: "end" }, T)); });
    const A = { stroke: pal.axis, width: 1.1 };
    be.line(m.l, m.t + ph, m.l + pw, m.t + ph, A); be.line(m.l, m.t, m.l, m.t + ph, A);
    be.clip(m.l, m.t, pw, ph);
    (o.series || []).forEach(s => {
      const col = s.color || (s.type === "pts" ? pal.pt : pal.fit);
      if (s.type === "line" && s.data.length > 1)
        be.poly(s.data.map(p => [sx(p[0]), sy(p[1])]), { stroke: s.type === "line" && s.color ? darker(col, 0.82) : col, width: s.dash ? 1.8 : 2.1, dash: s.dash ? [6, 4] : null });
      if (s.type === "pts") s.data.forEach(p => be.circle(sx(p[0]), sy(p[1]), 3.6, p[2] ? { fill: col, stroke: col, width: 1.4 } : { fill: "none", stroke: col, width: 1.4 }));
      if (s.type === "mk") s.data.forEach(p => be.circle(sx(p[0]), sy(p[1]), 4.6, { fill: col, stroke: "#ffffff", width: 1.5 }));
    });
    be.unclip();
    const L = { size: 12.5, weight: 600, color: pal.label, family: pal.font, anchor: "middle" };
    be.text(m.l + pw / 2, H - 9, o.xl, L);
    be.text(15, m.t + ph / 2, o.yl, Object.assign({ rotate: -90 }, L));
    return be.end();
  }

  /* ---------- ieșire SVG ---------- */
  function svgBackend() {
    const P = []; let W, H; const cid = "c" + Math.random().toString(36).slice(2, 8);
    const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const st = s => `stroke="${s.stroke}" stroke-width="${s.width}"${s.dash ? ` stroke-dasharray="${s.dash.join(" ")}"` : ""}`;
    return {
      begin(w, h) { W = w; H = h; },
      line(x1, y1, x2, y2, s) { P.push(`<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" ${st(s)}/>`); },
      poly(pts, s) { P.push(`<polyline fill="none" points="${pts.map(p => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ")}" ${st(s)} stroke-linejoin="round"/>`); },
      circle(x, y, r, s) { P.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="${s.fill}" ${st(s)}/>`); },
      text(x, y, t, s) {
        const tr = s.rotate ? ` transform="translate(${x} ${y}) rotate(${s.rotate})"` : "";
        P.push(`<text${tr} x="${s.rotate ? 0 : x.toFixed(1)}" y="${s.rotate ? 0 : y.toFixed(1)}" fill="${s.color}" font-size="${s.size}" font-weight="${s.weight || 400}" font-family="${esc(s.family)}" text-anchor="${s.anchor || "start"}">${esc(t)}</text>`);
      },
      clip(x, y, w, h) { P.push(`<clipPath id="${cid}"><rect x="${x}" y="${y}" width="${w}" height="${h}"/></clipPath><g clip-path="url(#${cid})">`); },
      unclip() { P.push("</g>"); },
      end() { return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img">${P.join("")}</svg>`; }
    };
  }

  /* ---------- ieșire canvas ---------- */
  function canvasBackend(scale) {
    let cv, ctx;
    return {
      begin(w, h) { cv = document.createElement("canvas"); cv.width = Math.round(w * scale); cv.height = Math.round(h * scale); ctx = cv.getContext("2d"); ctx.scale(scale, scale); ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, w, h); },
      line(x1, y1, x2, y2, s) { ctx.beginPath(); ctx.setLineDash(s.dash || []); ctx.strokeStyle = s.stroke; ctx.lineWidth = s.width; ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); },
      poly(pts, s) { ctx.beginPath(); ctx.setLineDash(s.dash || []); ctx.strokeStyle = s.stroke; ctx.lineWidth = s.width; ctx.lineJoin = "round"; pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke(); ctx.setLineDash([]); },
      circle(x, y, r, s) { ctx.beginPath(); ctx.setLineDash([]); ctx.arc(x, y, r, 0, Math.PI * 2); if (s.fill !== "none") { ctx.fillStyle = s.fill; ctx.fill(); } ctx.strokeStyle = s.stroke; ctx.lineWidth = s.width; ctx.stroke(); },
      text(x, y, t, s) {
        ctx.save(); ctx.fillStyle = s.color; ctx.font = `${s.weight || 400} ${s.size}px ${s.family}`;
        ctx.textAlign = s.anchor === "middle" ? "center" : s.anchor === "end" ? "right" : "left";
        if (s.rotate) { ctx.translate(x, y); ctx.rotate(s.rotate * Math.PI / 180); ctx.fillText(t, 0, 0); } else ctx.fillText(t, x, y);
        ctx.restore();
      },
      clip(x, y, w, h) { ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); },
      unclip() { ctx.restore(); },
      end() { return cv.toDataURL("image/png"); }
    };
  }

  /* ---------- specificațiile graficelor ---------- */
  const withPos = res => res.points.filter(p => p.pump.some(q => q.s > 0));
  function specCJ(res) {
    const pts = withPos(res); if (!pts.length) return null;
    const all = pts.flatMap(p => p.pump.filter(q => q.s > 0));
    if (all.length < 2) return null;
    const [x0, x1] = logBounds(all.map(q => q.t)), y1 = niceMax(Math.max(...all.map(q => q.s)));
    const ser = [];
    pts.forEach(p => {
      const c = p.cj;
      if (c) ser.push({ type: "line", color: p.color, data: [[x0, c.a + c.ds * Math.log10(x0)], [x1, c.a + c.ds * Math.log10(x1)]] });
      ser.push({ type: "pts", color: p.color, data: p.pump.filter(q => q.s > 0).map(q => [q.t, q.s, c ? q.t >= c.t1 - 1e-9 && q.t <= c.t2 + 1e-9 : false]) });
    });
    return { xLog: true, x0, x1, y0: 0, y1, series: ser, xl: "timp de la pornire t (min)", yl: res.inp.corr ? "denivelare corectată s′ (m)" : "denivelare s (m)" };
  }
  function specTH(res) {
    const pts = withPos(res); if (!pts.length) return null;
    const all = pts.flatMap(p => p.pump.filter(q => q.s > 0));
    if (all.length < 2) return null;
    const [x0, x1] = logBounds(all.map(q => q.t)), [y0, y1] = logBounds(all.map(q => q.s));
    const ser = [];
    pts.forEach(p => {
      if (p.th) {
        const cv = [];
        for (let i = 0; i <= 90; i++) { const t = x0 * Math.pow(x1 / x0, i / 90), s = theisS(res.inp.Q, p.th.T, p.th.S, p.r, t / 1440); if (s > 0) cv.push([t, Math.max(s, y0 * 0.3)]); }
        ser.push({ type: "line", color: p.color, dash: true, data: cv });
      }
      ser.push({ type: "pts", color: p.color, data: p.pump.filter(q => q.s > 0).map(q => [q.t, q.s, inRange(q.t, res.R.b1, res.R.b2)]) });
    });
    return { xLog: true, yLog: true, x0, x1, y0, y1, series: ser, xl: "timp de la pornire t (min)", yl: "denivelare s (m)" };
  }
  function specRE(res) {
    const pts = res.points.filter(p => p.rec.length >= 2); if (!pts.length) return null;
    const all = pts.flatMap(p => p.rec);
    const [, x1] = logBounds(all.map(q => q.x).concat([10]));
    const vals = all.map(q => q.s).concat([0]);
    const lo = Math.min(0, ...vals), y1 = niceMax(Math.max(...vals)), y0 = lo < 0 ? -niceMax(-lo) : 0;
    const ser = [];
    pts.forEach(p => {
      if (p.re) ser.push({ type: "line", color: p.color, data: [[1, p.re.a], [x1, p.re.a + p.re.ds * Math.log10(x1)]] });
      ser.push({ type: "pts", color: p.color, data: p.rec.map(q => [q.x, q.s, q.on]) });
    });
    return { xLog: true, x0: 1, x1, y0, y1, series: ser, xl: "t/t′   (t = tp + t′)", yl: "denivelare reziduală s′ (m)" };
  }
  function specDist(res) {
    const d = res.dist; if (!d) return null;
    const rs = d.vals.map(v => v.r).concat([d.r0]);
    const x0 = Math.pow(10, Math.floor(Math.log10(Math.min(...rs)))), x1 = Math.pow(10, Math.ceil(Math.log10(Math.max(...rs)) - 1e-12));
    const y1 = niceMax(Math.max(...d.vals.map(v => v.s), d.a - d.dsR * Math.log10(x0)) );
    const ser = [{ type: "line", data: [[x0, d.a - d.dsR * Math.log10(x0)], [x1, d.a - d.dsR * Math.log10(x1)]] }];
    d.vals.forEach(v => ser.push({ type: "pts", color: v.color, data: [[v.r, v.s, true]] }));
    ser.push({ type: "mk", data: [[d.r0, 0]] });
    return { xLog: true, x0, x1, y0: 0, y1, series: ser, xl: "distanța de la puț r (m)", yl: `denivelare s (m) la t = ${fs(d.tstar)} min` };
  }

  function toSVG(o, w, h, pal) { return draw(svgBackend(), o, w, h, pal); }
  function toPNG(o, w, h, scale, pal) { return draw(canvasBackend(scale || 3), o, w, h, pal); }

  global.PTChart = { specCJ, specTH, specRE, specDist, toSVG, toPNG, PAL };
})(window);
