/* Interfața: câmpuri, salvare locală, rezultate, grafice, raport */
(function () {
  "use strict";
  const { fs, sci, fS, theisS, analyze } = window.PT;
  const C = window.PTChart;
  const $ = id => document.getElementById(id);
  const META = ["lucrare", "amplasament", "punct", "data", "firma"];
  const FIELDS = META.concat(["q", "qu", "b", "aq", "corr", "r", "pw", "mode", "ns", "pdata", "cj1", "cj2", "th1", "th2", "tp", "rdata", "rr1", "rr2", "r1", "s1", "r2", "s2"]);
  const KEY = "teste-pompare-site-v1";
  let last = null;

  const getVals = () => { const v = {}; FIELDS.forEach(k => { const e = $(k); v[k] = e.type === "checkbox" ? e.checked : e.value; }); return v; };
  const setVals = v => FIELDS.forEach(k => { if (!(k in v)) return; const e = $(k); if (e.type === "checkbox") e.checked = !!v[k]; else e.value = v[k]; });
  const meta = () => { const v = getVals(); const m = {}; META.forEach(k => m[k] = v[k].trim()); return m; };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(getVals())); } catch (e) { } };

  /* ---------- afișarea rezultatelor ---------- */
  function render() {
    const raw = getVals();
    const res = last = analyze(raw);
    const I = res.inp;
    $("corrWrap").hidden = !I.unconf;
    $("nsWrap").style.visibility = I.modeH ? "visible" : "hidden";

    const rows = [["Cooper-Jacob", res.cj, m => `Δs = ${fs(m.ds)} m/ciclu · t₀ = ${fs(m.t0)} min · R² = ${fs(m.r2, 4)}`],
      ["Theis", res.th, m => `ajustare pe ${m.n} citiri · eroare medie ${fs(m.rmse * 100, 2)} cm`],
      ["Revenire", res.re, m => `Δs′ = ${fs(m.ds)} m/ciclu · s′(t/t′=1) = ${fs(m.a, 2)} m`],
      ["Thiem", res.ti, m => m.unconf ? `nivel liber: h₁ = ${fs(m.h1)} m, h₂ = ${fs(m.h2)} m` : `s₁ − s₂ = ${fs(m.s1 - m.s2)} m`]].filter(x => x[1]);
    $("res").innerHTML = rows.length ? rows.map(([n, m, d]) => `<tr><td class="m">${n}</td><td class="n">${fs(m.T)}</td><td class="n">${fs(m.K)}</td><td class="n">${sci(m.K / 86400)}</td><td class="n">${m.S ? (I.isPW ? "(" + fS(m.S) + ")" : fS(m.S)) : "—"}</td><td class="help">${d(m)}</td></tr>`).join("")
      : `<tr><td colspan="6" class="help">Rezultatele apar după ce introduci debitul și citirile.</td></tr>`;

    const S = res.summary;
    $("verdict").innerHTML = S ? `
      <div class="tile main"><span class="k">Permeabilitate K medie</span><span class="v">${I.b > 0 ? fs(S.Km) + " m/zi" : "—"}</span><span class="u">${I.b > 0 ? sci(S.Km / 86400) + " m/s" : "introdu grosimea b"}</span></div>
      <div class="tile"><span class="k">Transmisivitate T</span><span class="v">${fs(S.Tm)}</span><span class="u">m²/zi · medie din ${S.n}</span></div>
      <div class="tile"><span class="k">Înmagazinare S</span><span class="v">${fS(S.S)}</span><span class="u">${isFinite(S.S) ? (res.th ? "Theis" : "Cooper-Jacob") : "nedeterminat"}</span></div>
      ${S.n > 1 && I.b > 0 ? `<div class="tile"><span class="k">Interval K</span><span class="v">${fs(S.Kmin)}–${fs(S.Kmax)}</span><span class="u">m/zi</span></div>` : ""}`
      : `<div class="empty" style="grid-column:1/-1">Introdu datele ca să obții K.</div>`;
    $("notes").innerHTML = res.notes.map(([c, t]) => `<li class="${c}">${t.replace(/</g, "&lt;")}</li>`).join("");

    drawCharts(res);
  }

  function chartInto(id, spec, emptyMsg) {
    const host = $(id);
    if (!spec) { host.innerHTML = `<div class="empty">${emptyMsg}</div>`; return; }
    const w = Math.max(300, Math.round(host.clientWidth || 600));
    host.innerHTML = C.toSVG(spec, w, Math.round(Math.min(360, Math.max(240, w * 0.52))));
  }
  function drawCharts(res) {
    if ($("tab-calc").hidden) return;
    chartInto("chCJ", C.specCJ(res), "Graficul apare după ce introduci cel puțin două citiri cu denivelare pozitivă.");
    chartInto("chTH", C.specTH(res), "Introdu citirile de pompare.");
    chartInto("chRE", C.specRE(res), "Introdu citirile de revenire.");
    $("capCJ").textContent = res.cj ? `Panta: ${fs(res.cj.ds)} m pe ciclu logaritmic; t₀ = ${fs(res.cj.t0)} min. Alege intervalul pe porțiunea dreaptă de la final.` : "";
    $("capTH").textContent = res.th ? `Curba Theis pentru T = ${fs(res.th.T)} m²/zi și S = ${fS(res.th.S)}.` : (res.pump.length ? "Curba apare după ce introduci r și cel puțin 4 citiri." : "");
    $("capRE").textContent = res.re ? `Panta: ${fs(res.re.ds)} m pe ciclu. Datele târzii (t/t′ mic, în stânga) sunt cele reprezentative.` : "";
  }

  /* ---------- raport ---------- */
  async function preview() {
    const pv = $("preview");
    pv.innerHTML = `<div class="busy-box" style="box-shadow:none;background:transparent"><div class="spin"></div><span>Pregătesc previzualizarea…</span></div>`;
    const pages = await window.PTReport.build(last || analyze(getVals()), meta());
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
    try {
      await window.PTReport.makePDF(last || analyze(getVals()), meta(), (i, n) => { msg.textContent = `Generez pagina ${i} din ${n}…`; });
    } catch (e) {
      console.error(e); alertBox("Raportul nu a putut fi generat: " + (e && e.message ? e.message : e));
    } finally { busy.hidden = true; }
  }
  function alertBox(t) { const n = $("notes"); const li = document.createElement("li"); li.className = "bad"; li.textContent = t; n.prepend(li); }
  async function printReport() { await window.PTReport.build(last || analyze(getVals()), meta()); window.print(); }

  /* ---------- exemplu ---------- */
  function example() {
    const Qm = 50 * 24, T = 450, S = 0.0008, r = 12, NS = 3.40;
    let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 - 0.5; };
    const c = x => String(x).replace(".", ",");
    const tt = [0.5, 1, 1.5, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50, 60, 75, 90, 120, 150, 180, 240, 300, 360, 480, 600, 720, 900, 1080, 1260, 1440];
    const p = tt.map(t => `${c(t)}\t${c((NS + theisS(Qm, T, S, r, t / 1440) + rnd() * 0.01).toFixed(2))}`);
    const tr = [0.5, 1, 2, 3, 5, 8, 10, 15, 20, 30, 45, 60, 90, 120, 180, 240, 360, 480, 720];
    const rc = tr.map(t => `${c(t)}\t${c((NS + theisS(Qm, T, S, r, (1440 + t) / 1440) - theisS(Qm, T, S, r, t / 1440) + rnd() * 0.01).toFixed(2))}`);
    setVals({
      lucrare: "Exemplu — incintă excavată, epuizment", amplasament: "București (date sintetice)", punct: "PP1 / PZ1", data: (d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`)(new Date()), firma: "Exemplu Foraj SRL",
      q: "50", qu: "mh", b: "15", aq: "c", corr: true, r: "12", pw: false, mode: "h", ns: "3,40",
      pdata: "t (min)\tnivel (m)\n" + p.join("\n"), cj1: "10", cj2: "", th1: "", th2: "", tp: "1440",
      rdata: "t' (min)\tnivel (m)\n" + rc.join("\n"), rr1: "", rr2: "",
      r1: "12", s1: c(theisS(Qm, T, S, 12, 1).toFixed(2)), r2: "35", s2: c(theisS(Qm, T, S, 35, 1).toFixed(2))
    });
    $("exNote").hidden = false;
  }

  /* ---------- file și evenimente ---------- */
  function showTab(name) {
    ["calc", "rep", "proc"].forEach(t => { $("tab-" + t).hidden = t !== name; $("tb-" + t).setAttribute("aria-selected", t === name); });
    if (name === "calc") render();
    if (name === "rep") preview();
    try { history.replaceState(null, "", "#" + (name === "calc" ? "calcul" : name === "rep" ? "raport" : "procedura")); } catch (e) { }
  }
  $("tb-calc").addEventListener("click", () => showTab("calc"));
  $("tb-rep").addEventListener("click", () => showTab("rep"));
  $("tb-proc").addEventListener("click", () => showTab("proc"));

  let tmr; const sched = () => { clearTimeout(tmr); tmr = setTimeout(() => { render(); save(); }, 180); };
  FIELDS.forEach(k => { $(k).addEventListener("input", sched); $(k).addEventListener("change", sched); });
  ["pdata", "rdata"].forEach(k => $(k).addEventListener("input", () => { $("exNote").hidden = true; }));
  $("btnEx").addEventListener("click", () => { example(); render(); save(); });
  $("btnClr").addEventListener("click", () => {
    ["pdata", "rdata", "cj1", "cj2", "th1", "th2", "tp", "rr1", "rr2", "r1", "s1", "r2", "s2"].forEach(k => $(k).value = "");
    $("exNote").hidden = true; render(); save();
  });
  $("btnPdf").addEventListener("click", downloadPDF);
  $("btnPdf2").addEventListener("click", downloadPDF);
  $("btnPrint").addEventListener("click", printReport);
  let rt; window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => { if (!$("tab-calc").hidden && last) drawCharts(last); }, 150); });

  let loaded = false;
  try { const s = JSON.parse(localStorage.getItem(KEY) || "null"); if (s && s.pdata !== undefined) { setVals(s); loaded = true; $("exNote").hidden = true; } } catch (e) { }
  if (!loaded) example();
  const h = location.hash.replace("#", "");
  showTab(h === "raport" ? "rep" : h === "procedura" ? "proc" : "calc");
  window.PTApp = { render, downloadPDF, getLast: () => last, meta };
})();
