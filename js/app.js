/* Interfața: câmpuri, puncte de măsură, tabel de citiri, rezultate, grafice, raport */
(function () {
  "use strict";
  const { fs, sci, fS, theisS, analyze, COLORS } = window.PT;
  const C = window.PTChart;
  const $ = id => document.getElementById(id);
  const META = ["lucrare", "amplasament", "punct", "data", "firma"];
  const SIMPLE = META.concat(["q", "qu", "b", "aq", "corr", "mode", "cj1", "cj2", "th1", "th2", "tp", "rr1", "rr2", "tstar"]);
  const KEY = "teste-pompare-site-v2";
  const STD_T = [0.5, 1, 1.5, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50, 60, 75, 90, 120, 150, 180, 240, 300, 360, 480, 600, 720, 900, 1080, 1260, 1440];
  const emptyRow = () => ({ t: "", v: ["", "", ""] });
  const emptyStep = () => ({ mode: "h", ns: "", zp: "", rez: "1,5", pct: "70", qsel: "", qpred: "", rows: Array.from({ length: 6 }, () => ({ q: "", v: "" })) });
  const state = { n: 1, pts: [0, 1, 2].map(i => ({ name: "P" + (i + 1), r: "", ns: "", pw: false })), pump: [], rec: [], grid: "pump", incl: {}, step: emptyStep() };
  let last = null;

  /* ---------- stare ---------- */
  const getSimple = () => { const v = {}; SIMPLE.forEach(k => { const e = $(k); v[k] = e.type === "checkbox" ? e.checked : e.value; }); return v; };
  const setSimple = v => SIMPLE.forEach(k => { if (!(k in v)) return; const e = $(k); if (e.type === "checkbox") e.checked = !!v[k]; else e.value = v[k]; });
  const raw = () => Object.assign(getSimple(), { n: state.n, pts: state.pts, pump: state.pump, rec: state.rec, incl: state.incl, step: state.step });
  const meta = () => { const v = getSimple(); const m = {}; META.forEach(k => m[k] = String(v[k] || "").trim()); return m; };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify({ simple: getSimple(), n: state.n, pts: state.pts, pump: state.pump, rec: state.rec, incl: state.incl, step: state.step })); } catch (e) { } };
  let tmr; const sched = () => { clearTimeout(tmr); tmr = setTimeout(() => { render(); save(); }, 200); };

  /* ---------- puncte de măsură ---------- */
  function renderPts() {
    document.querySelectorAll(".seg-b[data-n]").forEach(b => b.setAttribute("aria-checked", String(+b.dataset.n === state.n)));
    const box = $("ptsBox"); box.innerHTML = "";
    for (let i = 0; i < state.n; i++) {
      const p = state.pts[i], d = document.createElement("div");
      d.className = "pt"; d.style.setProperty("--c", COLORS[i]);
      d.innerHTML = `<div class="ttl"><b><span class="dot"></span>Punctul ${i + 1}</b><label class="check"><input type="checkbox" data-k="pw" ${p.pw ? "checked" : ""}> <span>este puțul de pompare</span></label></div>
        <div class="field nm"><label for="pn${i}">Denumire</label><input id="pn${i}" type="text" data-k="name" value="${esc(p.name)}"></div>
        <div class="field"><label for="pr${i}">Distanța r (m)</label><input id="pr${i}" type="text" inputmode="decimal" data-k="r" value="${esc(p.r)}"></div>
        <div class="field"><label for="ps${i}">Nivel static (m)</label><input id="ps${i}" type="text" inputmode="decimal" data-k="ns" value="${esc(p.ns)}"></div>`;
      d.querySelectorAll("input").forEach(inp => inp.addEventListener("input", () => {
        p[inp.dataset.k] = inp.type === "checkbox" ? inp.checked : inp.value;
        if (inp.dataset.k === "name") renderGridHead();
        sched();
      }));
      box.appendChild(d);
    }
    $("tstarWrap").hidden = state.n < 2;
    document.querySelectorAll('#ptsBox [data-k="ns"]').forEach(e => e.closest(".field").style.visibility = $("mode").value === "h" ? "visible" : "hidden");
  }
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  /* ---------- tabelul de citiri ---------- */
  const rows = () => state[state.grid];
  function padRows() { const r = rows(); const min = Math.max(15, r.length); while (r.length < min) r.push(emptyRow()); }
  function renderGridHead() {
    const unit = $("mode").value === "h" ? "adâncime nivel (m)" : "denivelare s (m)";
    let h = `<tr><th></th><th>${state.grid === "pump" ? "t (min)" : "t′ (min)"}<span class="u">${state.grid === "pump" ? "de la pornire" : "de la oprire"}</span></th>`;
    for (let i = 0; i < state.n; i++) h += `<th><span class="sw" style="background:${COLORS[i]}"></span>${esc(state.pts[i].name || "P" + (i + 1))}<span class="u">${unit}</span></th>`;
    $("gridHead").innerHTML = h + "<th></th></tr>";
    $("gridHelp").textContent = state.grid === "pump"
      ? "Citirile din timpul pompării cu debit constant. Timpul se socotește de la pornirea pompei."
      : "Citirile după oprirea pompei. Timpul t′ se socotește de la oprire; durata pompării tp se ia din setări.";
  }
  function renderGrid() {
    document.querySelectorAll(".seg-b[data-g]").forEach(b => b.setAttribute("aria-selected", String(b.dataset.g === state.grid)));
    padRows(); renderGridHead();
    const body = $("gridBody"); const r = rows();
    body.innerHTML = r.map((row, i) => {
      let tds = `<td class="no">${i + 1}</td><td><input data-r="${i}" data-c="-1" inputmode="decimal" value="${esc(row.t)}" aria-label="timp rândul ${i + 1}"></td>`;
      for (let c = 0; c < state.n; c++) tds += `<td><input data-r="${i}" data-c="${c}" inputmode="decimal" value="${esc(row.v[c])}" aria-label="${esc(state.pts[c].name)} rândul ${i + 1}"></td>`;
      return `<tr>${tds}<td class="del"><button type="button" class="x" data-del="${i}" title="Șterge rândul" aria-label="Șterge rândul ${i + 1}">×</button></td></tr>`;
    }).join("");
    markBad();
  }
  function markBad() {
    $("gridBody").querySelectorAll("input").forEach(inp => {
      const v = inp.value.trim(); inp.classList.toggle("bad", v !== "" && !isFinite(Number(v.replace(",", "."))));
    });
  }
  function setCell(r, c, val) { const row = rows()[r]; if (c < 0) row.t = val; else row.v[c] = val; }
  $("gridBody").addEventListener("input", e => {
    const inp = e.target; if (!inp.dataset || inp.dataset.r == null) return;
    setCell(+inp.dataset.r, +inp.dataset.c, inp.value);
    const v = inp.value.trim(); inp.classList.toggle("bad", v !== "" && !isFinite(Number(v.replace(",", "."))));
    $("exNote").hidden = true; sched();
  });
  $("gridBody").addEventListener("keydown", e => {
    const inp = e.target; if (e.key !== "Enter" || inp.dataset.r == null) return;
    e.preventDefault();
    const r = +inp.dataset.r + 1, c = inp.dataset.c;
    if (r >= rows().length) { for (let k = 0; k < 10; k++) rows().push(emptyRow()); renderGrid(); }
    const nx = $("gridBody").querySelector(`input[data-r="${r}"][data-c="${c}"]`); if (nx) { nx.focus(); nx.select(); }
  });
  $("gridBody").addEventListener("paste", e => {
    const inp = e.target; if (inp.dataset.r == null) return;
    const txt = (e.clipboardData || window.clipboardData).getData("text");
    if (!/[\t\n]/.test(txt)) return;
    e.preventDefault();
    const lines = txt.replace(/\r/g, "").split("\n").filter((l, i, a) => l.trim() !== "" || i < a.length - 1).filter(l => l.trim() !== "");
    const r0 = +inp.dataset.r, c0 = +inp.dataset.c, cols = [-1, 0, 1, 2].slice(0, state.n + 1), ci0 = cols.indexOf(c0);
    lines.forEach((l, k) => {
      const parts = l.split(/\t|;/);
      while (rows().length <= r0 + k) rows().push(emptyRow());
      parts.forEach((v, j) => { const c = cols[ci0 + j]; if (c !== undefined) setCell(r0 + k, c, v.trim()); });
    });
    $("exNote").hidden = true; renderGrid(); sched();
  });
  $("gridBody").addEventListener("click", e => {
    const b = e.target.closest("button[data-del]"); if (!b) return;
    rows().splice(+b.dataset.del, 1); renderGrid(); sched();
  });
  document.querySelectorAll(".seg-b[data-g]").forEach(b => b.addEventListener("click", () => { state.grid = b.dataset.g; renderGrid(); }));
  document.querySelectorAll(".seg-b[data-n]").forEach(b => b.addEventListener("click", () => { state.n = +b.dataset.n; renderPts(); renderGrid(); sched(); }));
  $("gAdd").addEventListener("click", () => { for (let k = 0; k < 10; k++) rows().push(emptyRow()); renderGrid(); });
  $("gStd").addEventListener("click", () => {
    const r = rows(), list = state.grid === "pump" ? STD_T : STD_T.filter(t => t <= Math.max(720, Number(String($("tp").value).replace(",", ".")) || 0));
    list.forEach((t, i) => { while (r.length <= i) r.push(emptyRow()); if (String(r[i].t).trim() === "") r[i].t = String(t).replace(".", ","); });
    renderGrid(); sched();
  });
  $("gClear").addEventListener("click", () => { state[state.grid] = []; renderGrid(); sched(); });

  /* ---------- rezultate ---------- */
  function legend(res, which) {
    return res.points.filter(p => which === "re" ? p.rec.length : p.pump.length).map(p => `<span><i class="pk" style="background:${p.color}"></i>${esc(p.name)}${p.isPW ? " (puț)" : ""} · r = ${fs(p.r)} m</span>`).join("")
      + (which === "cj" ? `<span>cercuri pline = citiri folosite la dreaptă</span>` : which === "th" ? `<span>linie întreruptă = curba Theis</span>` : "");
  }
  function render() {
    const res = last = analyze(raw()), I = res.inp;
    $("corrWrap").hidden = !I.unconf;
    document.querySelectorAll('#ptsBox [data-k="ns"]').forEach(e => e.closest(".field").style.visibility = I.modeH ? "visible" : "hidden");
    const det = {};
    res.points.forEach(p => {
      if (p.cj) det[p.idx + "|cj"] = `Δs = ${fs(p.cj.ds)} m/ciclu · de la ${fs(p.cj.t1)} min${p.cj.auto ? " (automat)" : ""} · R² = ${fs(p.cj.r2, 4)}`;
      if (p.th) det[p.idx + "|th"] = `ajustare pe ${p.th.n} citiri · eroare medie ${fs(p.th.rmse * 100, 2)} cm`;
      if (p.re) det[p.idx + "|re"] = `Δs′ = ${fs(p.re.ds)} m/ciclu · t′ ≥ ${fs(p.re.t1)} min${p.re.auto ? " (automat)" : ""} · s′(t/t′=1) = ${fs(p.re.a, 2)} m`;
    });
    if (res.dist) det.dist = `la t = ${fs(res.dist.tstar)} min · Δs = ${fs(res.dist.dsR)} m/ciclu de distanță`;
    const colOf = key => key === "dist" ? null : (res.points[+key.split("|")[0]] || {}).color;
    const rowsHtml = res.all.map(x => {
      const c = colOf(x.key);
      const vk = x.valid ? `<span class="vk ok">✔ trece</span>` : `<span class="vk bad">⚠ ${esc(x.reasons.join("; "))}</span>`;
      return `<tr class="${x.included ? "" : "off"}"><td><input type="checkbox" data-key="${x.key}" ${x.included ? "checked" : ""} aria-label="Include în medie ${esc(x.pt)} ${esc(x.method)}">${x.overridden ? ' <span class="vk man" title="Ales manual">manual</span>' : ""}</td>
        <td class="m">${c ? `<i class="pk" style="background:${c};display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:6px"></i>` : ""}${esc(x.pt)}</td><td>${x.method}</td><td class="n">${fs(x.T)}</td><td class="n">${fs(x.K)}</td><td class="n">${sci(x.K / 86400)}</td><td class="n">${isFinite(x.S) ? fS(x.S) : "—"}</td><td>${vk}</td><td class="help">${det[x.key] || ""}</td></tr>`;
    });
    $("res").innerHTML = rowsHtml.join("") || `<tr><td colspan="9" class="help">Rezultatele apar după ce introduci debitul, distanțele și citirile.</td></tr>`;
    const S = res.summary;
    $("verdict").innerHTML = S ? `
      <div class="tile main"><span class="k">Permeabilitate K medie</span><span class="v">${I.b > 0 ? fs(S.Km) + " m/zi" : "—"}</span><span class="u">${I.b > 0 ? sci(S.Km / 86400) + " m/s" : "introdu grosimea b"}</span></div>
      <div class="tile"><span class="k">Transmisivitate T</span><span class="v">${fs(S.Tm)}</span><span class="u">m²/zi · medie din ${S.n} rezultate${S.nExcl ? ` (${S.nExcl} excluse)` : ""}</span></div>
      <div class="tile"><span class="k">Înmagazinare S</span><span class="v">${fS(S.S)}</span><span class="u">${isFinite(S.S) ? "media rezultatelor incluse" : "nedeterminat"}</span></div>
      ${S.n > 1 && I.b > 0 ? `<div class="tile"><span class="k">Interval K</span><span class="v">${fs(S.Kmin)}–${fs(S.Kmax)}</span><span class="u">m/zi</span></div>` : ""}`
      : `<div class="empty" style="grid-column:1/-1">Introdu datele ca să obții K.</div>`;
    $("notes").innerHTML = res.notes.map(([c, t]) => `<li class="${c}">${esc(t)}</li>`).join("");
    drawCharts(res);
  }
  function chartInto(id, spec, emptyMsg) {
    const host = $(id);
    if (!spec) { host.innerHTML = `<div class="empty">${emptyMsg}</div>`; return; }
    const w = Math.max(300, Math.round(host.clientWidth || 600));
    host.innerHTML = C.toSVG(spec, w, Math.round(Math.min(380, Math.max(240, w * 0.5))));
  }
  function drawCharts(res) {
    if ($("tab-calc").hidden) return;
    $("legCJ").innerHTML = legend(res, "cj"); $("legTH").innerHTML = legend(res, "th"); $("legRE").innerHTML = legend(res, "re");
    chartInto("chCJ", C.specCJ(res), "Graficul apare după ce introduci cel puțin două citiri cu denivelare pozitivă.");
    chartInto("chTH", C.specTH(res), "Introdu citirile de pompare.");
    chartInto("chRE", C.specRE(res), "Introdu citirile de revenire.");
    $("capCJ").textContent = res.points.filter(p => p.cj).map(p => `${p.name}: Δs = ${fs(p.cj.ds)} m/ciclu, t₀ = ${fs(p.cj.t0)} min`).join(" · ");
    $("capTH").textContent = res.points.filter(p => p.th).map(p => `${p.name}: T = ${fs(p.th.T)} m²/zi, S = ${fS(p.th.S)}`).join(" · ");
    $("capRE").textContent = res.points.filter(p => p.re).map(p => `${p.name}: Δs′ = ${fs(p.re.ds)} m/ciclu`).join(" · ");
    $("distCard").hidden = !res.dist;
    if (res.dist) {
      const d = res.dist;
      $("legDI").innerHTML = d.vals.map(v => `<span><i class="pk" style="background:${v.color}"></i>${esc(v.name)} · r = ${fs(v.r)} m · s = ${fs(v.s)} m${v.interp ? " (interpolat)" : ""}</span>`).join("") + `<span><i class="pk" style="background:#0b4f6c"></i>r₀ = ${fs(d.r0)} m</span>`;
      chartInto("chDI", C.specDist(res), "");
      $("capDI").textContent = `Denivelările din piezometre la t = ${fs(d.tstar)} min${d.autoT ? " (ultimul timp comun)" : ""}. Panta pe un ciclu logaritmic de distanță: Δs = ${fs(d.dsR)} m.`;
    }
  }


  $("res").addEventListener("change", e => {
    const cb = e.target; if (!cb.dataset || !cb.dataset.key) return;
    const row = last && last.all.find(x => x.key === cb.dataset.key); if (!row) return;
    if (cb.checked === row.valid) delete state.incl[cb.dataset.key]; else state.incl[cb.dataset.key] = cb.checked;
    render(); save();
  });

  /* ---------- testul în trepte ---------- */
  const STF = ["mode", "ns", "zp", "rez", "pct", "qsel", "qpred"];
  function stepFill() {
    STF.forEach(k => { $("st_" + k).value = state.step[k] ?? ""; });
    $("stBody").innerHTML = state.step.rows.map((r, i) => `<tr><td class="no">${i + 1}</td><td><input data-i="${i}" data-k="q" inputmode="decimal" value="${esc(r.q)}" aria-label="Debit treapta ${i + 1}"></td><td><input data-i="${i}" data-k="v" inputmode="decimal" value="${esc(r.v)}" aria-label="Nivel treapta ${i + 1}"></td><td class="stc" id="sts${i}"></td><td class="stc" id="stq${i}"></td><td class="stc" id="ste${i}"></td></tr>`).join("");
  }
  function stepRender() {
    $("st_nsWrap").style.visibility = state.step.mode === "s" ? "hidden" : "visible";
    $("stVh").innerHTML = state.step.mode === "s" ? 'Denivelarea la sfârșitul treptei<span class="u">m</span>' : 'Nivel la sfârșitul treptei<span class="u">m față de reper</span>';
    const st = window.PT.analyzeStep(state.step);
    state.step.rows.forEach((_, i) => { ["sts", "stq", "ste"].forEach(p => $(p + i).textContent = ""); });
    if (st) st.rows.forEach(r => { $("sts" + r.i).textContent = fs(r.s, 3); $("stq" + r.i).textContent = fs(r.sq * 1000, 4); $("ste" + r.i).textContent = isFinite(r.E) ? fs(r.E * 100, 2) + " %" : ""; });
    const ok = st && isFinite(st.B);
    $("stVerdict").innerHTML = ok ? `
      <div class="tile main"><span class="k">Q max pentru testul principal</span><span class="v">${isFinite(st.Qmax) ? fs(st.Qmax / 24) + " m³/h" : "—"}</span><span class="u">${isFinite(st.Qmax) ? fs(st.Qmax, 4) + " m³/zi · " + fs(st.pct * 100) + " % din s disponibil" : "completează nivelul static și adâncimea pompei"}</span></div>
      <div class="tile"><span class="k">B (pierderea prin strat)</span><span class="v">${sci(st.B, 3)}</span><span class="u">zi/m²</span></div>
      <div class="tile"><span class="k">C (pierderea în puț)</span><span class="v">${st.C > 0 ? sci(st.C, 3) : "—"}</span><span class="u">zi²/m⁵</span></div>
      <div class="tile"><span class="k">Randament la debitul ales</span><span class="v">${st.sel ? fs(st.sel.E * 100, 2) + " %" : "—"}</span><span class="u">${st.sel ? "s ≈ " + fs(st.sel.s) + " m la " + fs(st.sel.Qh) + " m³/h" : "completează debitul ales"}</span></div>
      ${isFinite(st.sdisp) ? `<div class="tile"><span class="k">Denivelare disponibilă</span><span class="v">${fs(st.sdisp)} m</span><span class="u">limită de lucru ${fs(st.slim)} m</span></div>` : ""}
      ${st.pred ? `<div class="tile"><span class="k">Estimare la ${fs(st.pred.Qh)} m³/h</span><span class="v">${fs(st.pred.s)} m</span><span class="u">denivelarea în puț</span></div>` : ""}`
      : `<div class="empty" style="grid-column:1/-1">Rezultatele apar după ce completezi cel puțin două trepte.</div>`;
    $("stNotes").innerHTML = (st ? st.notes : []).map(([c, t]) => `<li class="${c}">${esc(t)}</li>`).join("");
    if ($("tab-step").hidden) return;
    chartInto("chSQ", ok ? C.specStepSQ(st) : null, "Graficul apare după ce completezi cel puțin două trepte.");
    chartInto("chSS", ok ? C.specStepS(st) : null, "Graficul apare după ce completezi cel puțin două trepte.");
  }
  let stT; const stSched = () => { clearTimeout(stT); stT = setTimeout(() => { stepRender(); save(); }, 200); };
  STF.forEach(k => { const e = $("st_" + k); const h = () => { state.step[k] = e.value; stSched(); }; e.addEventListener("input", h); e.addEventListener("change", h); });
  $("stBody").addEventListener("input", e => { const inp = e.target; if (inp.dataset.i == null) return; state.step.rows[+inp.dataset.i][inp.dataset.k] = inp.value; stSched(); });
  $("stBody").addEventListener("paste", e => {
    const inp = e.target; if (inp.dataset.i == null) return;
    const txt = (e.clipboardData || window.clipboardData).getData("text"); if (!/[\t\n]/.test(txt)) return;
    e.preventDefault();
    const lines = txt.replace(/\r/g, "").split("\n").filter(l => l.trim() !== ""), i0 = +inp.dataset.i, k0 = inp.dataset.k;
    lines.forEach((l, j) => { const r = state.step.rows[i0 + j]; if (!r) return; const parts = l.split(/\t|;/); if (k0 === "q") { r.q = (parts[0] || "").trim(); if (parts[1] != null) r.v = parts[1].trim(); } else r.v = (parts[0] || "").trim(); });
    stepFill(); stepRender(); save();
  });
  function stepExample() {
    const c = x => String(x).replace(".", ",");
    state.step = Object.assign(emptyStep(), { mode: "h", ns: "3,40", zp: "10,5", rez: "1,5", pct: "70", qsel: "50", qpred: "60" });
    [15, 30, 45, 60].forEach((q, i) => { const Q = q * 24; state.step.rows[i] = { q: String(q), v: c((3.40 + 1.6e-3 * Q + 3e-7 * Q * Q).toFixed(2)) }; });
  }
  $("stEx").addEventListener("click", () => { stepExample(); stepFill(); stepRender(); save(); });
  $("stClr").addEventListener("click", () => { state.step = emptyStep(); stepFill(); stepRender(); save(); });

  /* ---------- raport ---------- */
  async function preview() {
    const pv = $("preview");
    pv.innerHTML = `<div class="busy-box" style="box-shadow:none;background:transparent"><div class="spin"></div><span>Pregătesc previzualizarea…</span></div>`;
    const pages = await window.PTReport.build(last || analyze(raw()), meta());
    pv.innerHTML = "";
    const avail = Math.min(pv.clientWidth - 32, 860);
    pages.forEach(p => {
      const w = p.offsetWidth, h = p.offsetHeight, k = Math.min(1, avail / w);
      const box = document.createElement("div"); box.className = "pv";
      box.style.width = (w * k) + "px"; box.style.height = (h * k) + "px";
      const cl = p.cloneNode(true); cl.style.transform = `scale(${k})`;
      box.appendChild(cl); pv.appendChild(box);
    });
  }
  async function downloadPDF() {
    const busy = $("busy"), msg = $("busyMsg");
    busy.hidden = false; msg.textContent = "Pregătesc raportul…";
    try { await window.PTReport.makePDF(last || analyze(raw()), meta(), (i, n) => { msg.textContent = `Generez pagina ${i} din ${n}…`; }); }
    catch (e) { console.error(e); const li = document.createElement("li"); li.className = "bad"; li.textContent = "Raportul nu a putut fi generat: " + (e && e.message ? e.message : e); $("notes").prepend(li); }
    finally { busy.hidden = true; }
  }
  async function printReport() { await window.PTReport.build(last || analyze(raw()), meta()); window.print(); }

  /* ---------- exemplu sintetic ---------- */
  function example() {
    const Qm = 50 * 24, T = 450, S = 0.0008;
    const P = [{ name: "PZ1", r: 12, ns: 3.40 }, { name: "PZ2", r: 35, ns: 3.38 }, { name: "PZ3", r: 80, ns: 3.42 }];
    let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 - 0.5; };
    const c = x => String(x).replace(".", ",");
    state.n = 3; state.incl = {};
    state.pts = P.map(p => ({ name: p.name, r: String(p.r), ns: c(p.ns.toFixed(2)), pw: false }));
    state.pump = STD_T.map(t => ({ t: c(t), v: P.map(p => c((p.ns + theisS(Qm, T, S, p.r, t / 1440) + rnd() * 0.01).toFixed(2))) }));
    const tr = [0.5, 1, 2, 3, 5, 8, 10, 15, 20, 30, 45, 60, 90, 120, 180, 240, 360, 480, 720];
    state.rec = tr.map(t => ({ t: c(t), v: P.map(p => c((p.ns + theisS(Qm, T, S, p.r, (1440 + t) / 1440) - theisS(Qm, T, S, p.r, t / 1440) + rnd() * 0.01).toFixed(2))) }));
    const d = new Date();
    setSimple({ lucrare: "Exemplu — incintă excavată, epuizment", amplasament: "București (date sintetice)", punct: "PP1",
      data: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`, firma: "Exemplu Foraj SRL",
      q: "50", qu: "mh", b: "15", aq: "c", corr: true, mode: "h", cj1: "", cj2: "", th1: "", th2: "", tp: "1440", rr1: "", rr2: "", tstar: "" });
    $("exNote").hidden = false;
  }

  /* ---------- file și evenimente ---------- */
  function showTab(name) {
    ["calc", "step", "rep", "proc"].forEach(t => { $("tab-" + t).hidden = t !== name; $("tb-" + t).setAttribute("aria-selected", t === name); });
    if (name === "calc") render();
    if (name === "step") stepRender();
    if (name === "rep") { last = analyze(raw()); preview(); }
    try { history.replaceState(null, "", "#" + ({ calc: "calcul", step: "trepte", rep: "raport", proc: "procedura" })[name]); } catch (e) { }
  }
  $("tb-calc").addEventListener("click", () => showTab("calc"));
  $("tb-rep").addEventListener("click", () => showTab("rep"));
  $("tb-step").addEventListener("click", () => showTab("step"));
  $("tb-proc").addEventListener("click", () => showTab("proc"));
  SIMPLE.forEach(k => { $(k).addEventListener("input", sched); $(k).addEventListener("change", sched); });
  $("mode").addEventListener("change", () => { renderGridHead(); renderPts(); });
  $("btnEx").addEventListener("click", () => { example(); renderPts(); renderGrid(); render(); save(); });
  $("btnClr").addEventListener("click", () => { state.pump = []; state.rec = []; $("exNote").hidden = true; renderGrid(); render(); save(); });
  $("btnPdf").addEventListener("click", downloadPDF);
  $("btnPdf2").addEventListener("click", downloadPDF);
  $("btnPrint").addEventListener("click", printReport);
  let rt; window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => { if (!$("tab-calc").hidden && last) drawCharts(last); if (!$("tab-step").hidden) stepRender(); }, 150); });

  let loaded = false;
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || "null");
    if (s && s.simple) { setSimple(s.simple); state.n = s.n || 1; if (s.pts) s.pts.forEach((p, i) => state.pts[i] = Object.assign(state.pts[i], p)); state.pump = s.pump || []; state.rec = s.rec || []; state.incl = s.incl || {}; if (s.step) state.step = Object.assign(emptyStep(), s.step); loaded = true; $("exNote").hidden = true; }
  } catch (e) { }
  if (!loaded) { example(); stepExample(); }
  renderPts(); renderGrid(); stepFill();
  const h = location.hash.replace("#", "");
  showTab(h === "raport" ? "rep" : h === "procedura" ? "proc" : h === "trepte" ? "step" : "calc");
  window.PTApp = { render, getLast: () => last, meta, state };
})();
