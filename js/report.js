/* Raportul A4: construcție, paginare automată, export PDF (html2canvas + jsPDF) și tipărire.
   Lucrează cu 1–3 puncte de măsură. */
(function (global) {
  "use strict";
  const { fs, fd, sci, fS } = global.PT;
  const C = global.PTChart;

  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const v = x => `<i>${x}</i>`;
  const fr = (a, b) => `<span class="fr"><span class="fn">${a}</span><span class="fd">${b}</span></span>`;
  const eq = (body, tag) => `<div class="eq">${body}${tag ? `<span class="tag">${tag}</span>` : ""}</div>`;
  const cl = (label, body) => `<div class="cl"><div class="l">${label}</div><div class="f">${body}</div></div>`;
  const R = x => `<span class="res">${x}</span>`;
  const n4 = x => fs(x, 4);
  const dateRO = d => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d || ""); return m ? `${m[3]}.${m[2]}.${m[1]}` : (d || "—"); };
  const sS = x => fS(x);
  const dot = c => `<i style="display:inline-block;width:2.6mm;height:2.6mm;border-radius:50%;background:${c};margin-right:1.4mm;vertical-align:-.3mm"></i>`;

  function el(html, opts) {
    const d = document.createElement("div");
    d.className = "blk"; d.innerHTML = html;
    if (opts && opts.newPage) d.dataset.newpage = "1";
    return d;
  }
  const h2 = (no, title) => `<div class="h2"><span class="no">${no}</span><span class="tt">${title}</span></div>`;
  const ptTitle = p => `<div class="h3">${dot(p.color)}${esc(p.name)}${p.isPW ? " — puțul de pompare" : ""} · r = ${fs(p.r, 4)} m</div>`;
  function fig(spec, legend, caption, w, h) {
    if (!spec) return "";
    w = w || 680; h = h || 265;
    return `<div class="fig">${legend ? `<div class="fl">${legend}</div>` : ""}<img src="${C.toPNG(spec, w, h, 3)}" width="${w}" height="${h}" style="aspect-ratio:${w}/${h}" alt=""><div class="fc">${caption}</div></div>`;
  }
  const legPts = (pts, extra) => pts.map(p => `<span>${dot(p.color)}${esc(p.name)} (r = ${fs(p.r)} m)</span>`).join("") + (extra || "");

  /* ---------- blocurile raportului ---------- */
  function buildBlocks(res, meta) {
    const B = [], I = res.inp, Q = I.Q, b = I.b, S = res.summary, P = res.points;
    const sym = I.corr ? "s′" : "s";
    let no = 0;

    // copertă și identificare
    B.push(el(`<div class="cover">
      <svg class="drop" viewBox="0 0 32 32"><path d="M16 3C11 10 7 15 7 20a9 9 0 0 0 18 0c0-5-4-10-9-17z" fill="#ffffff" fill-opacity=".9"/><path d="M11.5 21a4.5 4.5 0 0 0 4.5 4.5" stroke="#1479a3" stroke-width="2" fill="none" stroke-linecap="round"/></svg>
      <div class="ey">Raport tehnic · Încercare geohidraulică</div>
      <h1>Interpretarea testului de pompare</h1>
      <div class="sub">Determinarea transmisivității, a coeficientului de înmagazinare și a permeabilității stratului acvifer pompat</div>
    </div>`));
    B.push(el(`<div class="meta">
      <div class="w"><span class="k">Lucrare</span><span class="v">${esc(meta.lucrare) || "—"}</span></div>
      <div class="w"><span class="k">Amplasament</span><span class="v">${esc(meta.amplasament) || "—"}</span></div>
      <div><span class="k">Puț de pompare</span><span class="v">${esc(meta.punct) || "—"}</span></div>
      <div><span class="k">Data testului</span><span class="v">${esc(dateRO(meta.data))}</span></div>
      <div><span class="k">Test executat de</span><span class="v">${esc(meta.firma) || "—"}</span></div>
      <div><span class="k">Data raportului</span><span class="v">${new Date().toLocaleDateString("ro-RO", { day: "2-digit", month: "2-digit", year: "numeric" })}</span></div>
    </div>`));

    // date de intrare
    const kv = [
      ["Debit pompat Q", `${n4(I.Qin)} ${I.quLabel}${I.qu !== "md" ? ` = ${n4(Q)} m³/zi` : ""}`],
      ["Grosimea stratului b", `${fs(b, 4)} m`],
      ["Tipul acviferului", I.unconf ? "cu nivel liber" : "sub presiune"],
      ["Corecție Jacob", I.corr ? "aplicată" : "neaplicată"],
      ["Durata pompării tp", isFinite(I.tp) ? `${fs(I.tp, 5)} min (${fs(I.tp / 60, 3)} h)` : "—"],
      ["Mărimea citită", I.modeH ? "adâncimea nivelului față de reper" : "denivelarea s"]
    ];
    B.push(el(h2(++no, "Date de intrare") + `<div class="kv">${kv.map(([k, x]) => `<div><span class="k">${k}</span><span class="v">${x}</span></div>`).join("")}</div>
      <table style="margin-top:3mm"><thead><tr><th>Punct de măsură</th><th class="n">Distanța r (m)</th><th class="n">Nivel static (m)</th><th class="n">Citiri pompare</th><th class="n">Citiri revenire</th><th class="n">s maxim (m)</th></tr></thead><tbody>
      ${P.map(p => `<tr><td class="m">${dot(p.color)}${esc(p.name)}${p.isPW ? " (puț)" : ""}</td><td class="n">${fs(p.r, 4)}</td><td class="n">${I.modeH ? fd(p.NS, 2) : "—"}</td><td class="n">${p.pump.length}</td><td class="n">${p.rec.length}</td><td class="n">${fd(p.smax, 2)}</td></tr>`).join("")}
      </tbody></table>`));

    // rezultate
    if (S) {
      const ad = isFinite(S.Kad);
      const order = []; res.all.forEach(x => { if (!order.includes(x.group)) order.push(x.group); });
      const rowsH = order.map(gid => {
        const rows = res.all.filter(x => x.group === gid), g = S.groups.find(q => q.id === gid);
        return rows.map(x => `<tr${x.included ? "" : ' style="color:#9aaab3"'}><td class="m"${x.included ? "" : ' style="color:#9aaab3"'}>${esc(x.pt)}</td><td>${x.method}</td><td class="n">${fs(x.T)}</td><td class="n">${fs(x.K)}</td><td class="n">${sci(x.K / 86400)}</td><td class="n">${sS(x.S)}</td><td>${x.included ? "da" : "<b style='color:#a06a05'>nu</b>"}</td></tr>`).join("")
          + `<tr style="background:#e4f2f8"><td colspan="2" style="font-weight:600;color:#0b4f6c">Media ${gid === "m" ? "între piezometre" : "pentru " + esc(rows[0].pt)}</td><td class="n">${g ? fs(g.Tm) : "—"}</td><td class="n">${g ? fs(g.Km) : "—"}</td><td class="n">${g ? sci(g.Km / 86400) : ""}</td><td class="n">${g ? sS(g.S) : ""}</td><td></td></tr>`;
      }).join("");
      B.push(el(h2(++no, "Rezultate") + `
        <div class="tiles">
          <div class="tile main"><span class="k">${ad ? "K adoptat pentru proiectare" : "K adoptat — necompletat"}</span><span class="v">${ad ? fs(S.Kad) + " m/zi" : "—"}</span><span class="u">${ad ? sci(S.Kad / 86400) + " m/s" : "valoarea se stabilește de inginer"}</span></div>
          <div class="tile"><span class="k">K orientativ (media pe puncte)</span><span class="v">${b > 0 ? fs(S.Km) : "—"}</span><span class="u">m/zi · ${b > 0 ? sci(S.Km / 86400) + " m/s" : ""}</span></div>
          <div class="tile t"><span class="k">Interval K</span><span class="v">${b > 0 && S.n > 1 ? fs(S.Kmin) + "–" + fs(S.Kmax) : "—"}</span><span class="u">${S.n} rezultate incluse · m/zi</span></div>
          <div class="tile s"><span class="k">Înmagazinare S</span><span class="v">${sS(S.S)}</span><span class="u">${isFinite(S.S) ? "media pe puncte" : "nedeterminat"}</span></div>
        </div>
        ${ad ? `<div class="rnotes" style="margin-bottom:3mm"><div class="info"><b>Justificarea valorii adoptate:</b> ${S.just ? esc(S.just) : "<i>necompletată</i>"}</div></div>` : ""}
        <table><thead><tr><th>Punct</th><th>Metodă</th><th class="n">T (m²/zi)</th><th class="n">K (m/zi)</th><th class="n">K (m/s)</th><th class="n">S</th><th>În medie</th></tr></thead><tbody>
        ${rowsH}
        <tr class="mean"><td colspan="2">Media pe puncte (${S.groups.length} ${S.groups.length === 1 ? "grup" : "grupuri"}, pondere egală)</td><td class="n">${fs(S.Tm)}</td><td class="n">${fs(S.Km)}</td><td class="n">${sci(S.Km / 86400)}</td><td class="n">${sS(S.S)}</td><td></td></tr>
        </tbody></table>
        ${S.nExcl ? `<p style="font-size:8.8pt;color:#587080;margin-top:2mm">Rezultate excluse din medie: ${res.all.filter(x => !x.included).map(x => `${esc(x.pt)} ${x.method} — ${x.overridden ? "exclus de inginer" : esc(x.reasons.join("; "))}`).join("; ")}.</p>` : ""}
        <p style="font-size:8.8pt;color:#587080;margin-top:1mm">Media se face întâi pe fiecare punct de măsură, apoi între puncte, ca fiecare punct să aibă aceeași pondere. Verificările automate sunt o condiție necesară, nu o dovadă că modelul ales este potrivit.</p>`));
    }
    if (res.notes.length) B.push(el(`<div class="h3">Observații de verificare</div><div class="rnotes">${res.notes.map(([c, t]) => `<div class="${c}">${esc(t)}</div>`).join("")}</div>`));
    B.push(el(`<div class="h3">Ipotezele metodelor de interpretare</div><ul class="hyp">
      <li>acviferul este omogen, izotrop, de grosime constantă și de extindere practic nelimitată în zona de influență;</li>
      <li>puțul de pompare este complet (filtrul acoperă toată grosimea stratului), iar curgerea spre puț este radială și orizontală;</li>
      <li>debitul pompat este constant pe toată durata testului, iar nivelul inițial este practic orizontal;</li>
      <li>apa este cedată instantaneu din înmagazinare la scăderea sarcinii${I.unconf ? "; pentru nivel liber, denivelările sunt corectate cu relația Jacob" : ""}.</li></ul>`));


    // testul în trepte
    const st = res.step;
    if (st && isFinite(st.B) && st.rows.length >= 2) {
      B.push(el(h2(++no, "Testul în trepte (legea puțului)") + `
        <p>Denivelarea din puțul pompat are două componente: pierderile liniare (B·Q), adică coborârea nivelului în strat plus pierderile liniare din zona filtrului, și pierderile neliniare din puț (C·Q²), la intrarea apei prin pietrișul de filtru și filtru, care cresc cu pătratul debitului. Împărțind la Q se obține o dreaptă s/Q = B + C·Q: intersecția cu axa dă B, panta dă C. Raportul E = B·Q/s este un randament <i>aparent</i>: B include și pierderi liniare din puț, deci randamentul real este cel mult E. Testul în trepte nu se folosește pentru K de proiectare.</p>
        <div class="eqs">
          ${eq(`${v("s")} = ${v("B")}·${v("Q")} + ${v("C")}·${v("Q")}²&nbsp;&nbsp;&nbsp;&nbsp; ${fr(v("s"), v("Q"))} = ${v("B")} + ${v("C")}·${v("Q")}&nbsp;&nbsp;&nbsp;&nbsp; ${v("E")} = ${fr(v("B") + "·" + v("Q"), v("B") + "·" + v("Q") + " + " + v("C") + "·" + v("Q") + "²")}`, "legea puțului")}
          ${eq(`${v("B")}<sub>t</sub> = ${v("B")} + ${fr("0,183", v("T"))}·lg ${fr(v("t") + "<sub>principal</sub>", v("t") + "<sub>treaptă</sub>")}&nbsp;&nbsp;&nbsp;&nbsp; ${v("Q")}<sub>or</sub> = ${fr("−" + v("B") + "<sub>t</sub> + √(" + v("B") + "<sub>t</sub>² + 4·" + v("C") + "·" + v("s") + "<sub>lim</sub>)", "2·" + v("C"))}`, "debitul orientativ")}
        </div>`));
      B.push(el(`<table><thead><tr><th>Treapta</th><th class="n">Q (m³/h)</th><th class="n">Q (m³/zi)</th><th class="n">s (m)</th><th class="n">s/Q (zi/m²)</th><th class="n">E aparent</th></tr></thead><tbody>
        ${st.rows.map((r, k) => `<tr><td class="m">${k + 1}</td><td class="n">${fs(r.Qh, 4)}</td><td class="n">${fs(r.Qd, 5)}</td><td class="n">${fd(r.s, 3)}</td><td class="n">${sci(r.sq, 3)}</td><td class="n">${isFinite(r.E) ? fs(r.E * 100, 2) + " %" : "—"}</td></tr>`).join("")}
        </tbody></table>`));
      B.push(el(`<div style="display:grid;grid-template-columns:1fr 1fr;gap:4mm">${fig(C.specStepSQ(st), "", "s/Q în funcție de Q; intersecția cu axa dă B, panta dă C.", 420, 300).replace('class="fig"', 'class="fig" style="padding:1.5mm 2mm"')}${fig(C.specStepS(st), "", `Legea puțului${st.corrected ? ` pentru ${fs(st.tmain)} min (linie plină) și pentru durata treptelor (întreruptă)` : ""}, denivelarea disponibilă (roșu), limita de lucru și Q orientativ (galben), debitul ales (verde).`, 420, 300).replace('class="fig"', 'class="fig" style="padding:1.5mm 2mm"')}</div>`));
      const sel = st.sel;
      B.push(el(`<div class="calc">
        ${cl("Dreapta s/Q – Q", st.invalid ? `panta C = ${sci(Math.abs(st.C), 3)} este ${st.C < 0 ? "negativă" : "zero"} <span class="warn">— test neinterpretabil; ajustare cu C = 0: B = ${sci(st.B, 3)} zi/m²</span>` : `${v("B")} = ${R(sci(st.B, 3) + " zi/m²")}&nbsp; ${v("C")} = ${R(sci(st.C, 3) + " zi²/m⁵")}${st.rows.length > 2 ? `&nbsp; (R² = ${fs(st.r2, 4)})` : ""}`)}
        ${st.corrected ? cl("Corecția duratei", `${v("B")}<sub>t</sub> = ${sci(st.B, 3)} + ${fr("0,183", fs(st.Tc))}·lg ${fr(fs(st.tmain), fs(st.tstep))} = ${R(sci(st.Bm, 3) + " zi/m²")}&nbsp; (T ${st.Tsrc})`) : cl("Corecția duratei", `<span class="warn">neaplicată — lipsesc durata treptei sau T; debitul orientativ este supraestimat</span>`)}
        ${isFinite(st.sdisp) ? cl("Denivelarea disponibilă", `${v("s")}<sub>disp</sub> = ${fs(st.zp, 4)} − ${fs(st.NS, 4)} − ${fs(st.rez, 3)} = ${R(fd(st.sdisp, 2) + " m")};&nbsp; ${v("s")}<sub>lim</sub> = ${fs(st.pct * 100)} % × ${fd(st.sdisp, 2)} = ${fd(st.slim, 2)} m`) : ""}
        ${isFinite(st.Qor) ? cl("Debitul orientativ", `${v("Q")}<sub>or</sub> = ${R(fs(st.Qor, 4) + " m³/zi")} = ${fs(st.Qor / 24)} m³/h${st.corrected ? ` (fără corecție: ${fs(st.Qor0 / 24)} m³/h)` : ""}`) : ""}
        ${sel ? cl("La debitul ales", `${v("Q")} = ${fs(sel.Qh)} m³/h = ${fs(sel.Qd, 5)} m³/zi;&nbsp; ${v("s")} = ${R(fd(sel.s, 2) + " m")}${st.corrected ? ` după ${fs(st.tmain)} min` : ""}${isFinite(sel.E) ? `;&nbsp; ${v("E")} aparent = ${R(fs(sel.E * 100, 2) + " %")}` : ""}`) : ""}
        ${st.pred ? cl("Estimare", `la ${v("Q")} = ${fs(st.pred.Qh)} m³/h denivelarea în puț este ${R(fd(st.pred.s, 2) + " m")}`) : ""}
      </div>${st.notes.length ? `<div class="rnotes" style="margin-top:3mm">${st.notes.map(([c, t]) => `<div class="${c}">${esc(t)}</div>`).join("")}</div>` : ""}`));
    }

    const withData = P.filter(p => p.pump.length);

    // Cooper-Jacob
    B.push(el(h2(++no, "Metoda Cooper-Jacob") + `
      <p>Metoda Cooper-Jacob (1946) este o simplificare a soluției Theis, valabilă când parametrul u = r²S/(4Tt) este mic (u &lt; 0,05), adică pentru timpi suficient de mari în raport cu distanța. În acest caz denivelarea crește liniar cu logaritmul timpului, iar pe un grafic semilogaritmic citirile se așază pe o dreaptă. Panta dreptei, exprimată ca variație a denivelării pe un ciclu logaritmic (Δs), dă transmisivitatea; intersecția dreptei cu axa s = 0, la timpul t₀, dă coeficientul de înmagazinare. Fiecare punct de măsură se interpretează separat.</p>
      <div class="eqs">
        ${eq(`${v("s")} = ${fr("2,30 · " + v("Q"), "4π" + v("T"))} · lg ${fr("2,25 · " + v("T") + " · " + v("t"), v("r") + "² · " + v("S"))}`, "ecuația dreptei")}
        ${eq(`${v("T")} = ${fr("0,183 · " + v("Q"), "Δ" + v("s"))}&nbsp;&nbsp;&nbsp;&nbsp; ${v("S")} = ${fr("2,25 · " + v("T") + " · " + v("t") + "₀", v("r") + "²")}&nbsp;&nbsp;&nbsp;&nbsp; ${v("u")} = ${fr(v("r") + "² · " + v("S"), "4 · " + v("T") + " · " + v("t"))} &lt; 0,05`)}
      </div>`));
    if (P.some(p => p.cj)) {
      B.push(el(fig(C.specCJ(res), legPts(withData, `<span>cercuri pline = citiri folosite</span>`), `Figura ${no}.1 — Denivelarea ${I.corr ? "corectată " : ""}în funcție de logaritmul timpului, pentru fiecare punct de măsură, cu dreptele ajustate prin regresie liniară.`)));
      P.filter(p => p.cj).forEach(p => {
        const c = p.cj, t0d = c.t0 / 1440, t1d = c.t1 / 1440, r = p.r;
        B.push(el(ptTitle(p) + `<div class="calc">
          ${cl("Interval folosit", `${c.n} citiri, între ${fs(c.t1)} și ${fs(c.t2)} min${c.auto ? (p.isPW ? (c.startBasis === "rc" ? ` (început din efectul volumului de apă din puț: t &gt; 25·rc²/T = ${fs(c.tws, 2)} min, rc = ${fs(p.rc)} m)` : " (început implicit la 10 min; raza coloanei necompletată)") : " (început ales automat din condiția u &lt; 0,05)") : ""}; R² = ${fs(c.r2, 4)}`)}
          ${cl("Panta dreptei", `Δ${v("s")} = ${sym}(10·${v("t")}) − ${sym}(${v("t")}) = ${R(fd(c.ds, 3) + " m / ciclu log")}`)}
          ${cl("Transmisivitatea", `${v("T")} = ${fr("0,183 · " + v("Q"), "Δ" + v("s"))} = ${fr("0,183 × " + n4(Q), fd(c.ds, 3))} = ${R(fs(c.T) + " m²/zi")}`)}
          ${!p.isPW && isFinite(c.S) ? cl("Înmagazinarea", `${v("t")}₀ = ${fs(c.t0)} min = ${sci(t0d, 3)} zile;&nbsp; ${v("S")} = ${fr("2,25 × " + fs(c.T) + " × " + sci(t0d, 3), fs(r, 4) + "²")} = ${R(sS(c.S))}`) : ""}
          ${!p.isPW && isFinite(c.u) ? cl("Verificarea u", `${v("u")} = ${fr(fs(r, 4) + "² × " + sS(c.S), "4 × " + fs(c.T) + " × " + sci(t1d, 3))} = ${fs(c.u, 2)} ${c.u < 0.05 ? `<span class="ok">&lt; 0,05 — condiție îndeplinită</span>` : `<span class="warn">&gt; 0,05 — începutul intervalului trebuie mutat</span>`}`) : ""}
          ${b > 0 ? cl("Permeabilitatea", `${v("K")} = ${fr(v("T"), v("b"))} = ${fr(fs(c.T), fs(b, 4))} = ${R(fs(c.K) + " m/zi")} = ${sci(c.K / 86400)} m/s`) : ""}
        </div>`));
      });
    } else B.push(el(`<p>Metoda nu a putut fi aplicată: sunt necesare cel puțin 3 citiri cu denivelare pozitivă.</p>`));

    // Theis
    B.push(el(h2(++no, "Metoda Theis") + `
      <p>Soluția Theis (1935) descrie curgerea nepermanentă radială spre un puț complet, pompat cu debit constant, într-un acvifer sub presiune, omogen și de extindere practic nelimitată. Denivelarea la distanța r și la timpul t este proporțională cu funcția de puț W(u). Parametrii T și S s-au determinat pentru fiecare punct prin ajustarea curbei teoretice pe citiri, prin metoda celor mai mici pătrate: se caută perechea T, S pentru care suma pătratelor diferențelor dintre denivelările măsurate și cele calculate este minimă.</p>
      <div class="eqs">
        ${eq(`${v("s")} = ${fr(v("Q"), "4π" + v("T"))} · ${v("W")}(${v("u")})&nbsp;&nbsp;&nbsp;&nbsp; ${v("u")} = ${fr(v("r") + "² · " + v("S"), "4 · " + v("T") + " · " + v("t"))}`)}
        ${eq(`${v("W")}(${v("u")}) = −0,5772 − ln ${v("u")} + ${v("u")} − ${fr(v("u") + "²", "2 · 2!")} + ${fr(v("u") + "³", "3 · 3!")} − …`, "funcția de puț")}
        ${eq(`min Σ (${v("s")}<sub>măs</sub> − ${v("s")}<sub>calc</sub>)²`, "criteriul de ajustare")}
      </div>`));
    if (P.some(p => p.th)) {
      B.push(el(fig(C.specTH(res), legPts(withData, `<span>linie întreruptă = curba Theis calculată</span>`), `Figura ${no}.1 — Citirile în coordonate logaritmice și curbele Theis calculate pentru parametrii ajustați.`)));
      P.filter(p => p.th).forEach(p => {
        const t = p.th, k = t.check, td = k.t / 1440, r = p.r;
        B.push(el(ptTitle(p) + `<div class="calc">
          ${cl("Parametri ajustați", `${v("T")} = ${R(fs(t.T) + " m²/zi")}&nbsp; ${v("S")} = ${R(sS(t.S))}${p.isPW ? ` <span class="warn">S orientativ (măsurat în puț)</span>` : ""}`)}
          ${cl("Calitatea ajustării", `eroarea medie pătratică = ${fs(t.rmse * 100, 2)} cm, pe ${t.n} citiri (${fs(t.t1)} – ${fs(t.t2)} min)`)}
          ${cl("Verificare la t = " + fs(k.t) + " min", `${v("u")} = ${fr(fs(r, 4) + "² × " + sS(t.S), "4 × " + fs(t.T) + " × " + fs(td, 4))} = ${sci(k.u, 3)};&nbsp; ${v("W")}(${v("u")}) = ${fd(k.W, 3)};&nbsp; ${v("s")}<sub>calc</sub> = ${fr(n4(Q), "4π × " + fs(t.T))} × ${fd(k.W, 3)} = ${R(fd(k.s, 3) + " m")} față de ${fd(k.smeas, 3)} m măsurat`)}
          ${b > 0 ? cl("Permeabilitatea", `${v("K")} = ${fr(fs(t.T), fs(b, 4))} = ${R(fs(t.K) + " m/zi")} = ${sci(t.K / 86400)} m/s`) : ""}
        </div>`));
      });
    } else B.push(el(`<p>Metoda nu a putut fi aplicată: sunt necesare distanța r și cel puțin 4 citiri cu denivelare pozitivă.</p>`));

    // Revenire
    if (P.some(p => p.rec.length)) {
      B.push(el(h2(++no, "Metoda revenirii (Theis-Jacob)") + `
        <p>După oprirea pompei nivelul revine. Prin suprapunerea efectelor, revenirea se tratează ca o pompare continuă cu debitul Q, la care se adaugă din momentul opririi o injecție cu același debit. Pentru u mic, denivelarea reziduală s′ variază liniar cu lg(t/t′), unde t este timpul de la pornire și t′ timpul de la oprire. Panta dreptei pe un ciclu logaritmic (Δs′) dă transmisivitatea. Metoda este puțin sensibilă la variațiile de debit din timpul pompării și se poate aplica și în puțul de pompare.</p>
        <div class="eqs">
          ${eq(`${v("s")}′ = ${fr("2,30 · " + v("Q"), "4π" + v("T"))} · lg ${fr(v("t"), v("t") + "′")}&nbsp;&nbsp;&nbsp;&nbsp; ${v("t")} = ${v("t")}<sub>p</sub> + ${v("t")}′&nbsp;&nbsp;&nbsp;&nbsp; ${v("T")} = ${fr("0,183 · " + v("Q"), "Δ" + v("s") + "′")}`)}
        </div>`));
      B.push(el(fig(C.specRE(res), legPts(P.filter(p => p.rec.length)), `Figura ${no}.1 — Denivelarea reziduală în funcție de lg(t/t′); datele târzii (t/t′ mic) sunt cele reprezentative. tp = ${fs(I.tp, 5)} min.`)));
      P.filter(p => p.re).forEach(p => {
        const e = p.re;
        B.push(el(ptTitle(p) + `<div class="calc">
          ${cl("Interval folosit", `${e.n} citiri cu t′ ≥ ${fs(e.t1)} min (t/t′ ≤ ${fs(e.xmax, 3)})${e.auto ? ", ales automat din condiția u′ &lt; 0,05" : ""}; R² = ${fs(e.r2, 4)}`)}
          ${isFinite(e.uRe) ? cl("Verificarea u′", `${v("u")}′ = r²S/(4T·t′) = ${fs(e.uRe, 2)} la t′ = ${fs(e.t1)} min ${e.uRe < 0.05 ? `<span class="ok">&lt; 0,05 — condiție îndeplinită</span>` : `<span class="warn">&gt; 0,05 — lipsesc citirile târzii</span>`}`) : ""}
          ${cl("Panta dreptei", `Δ${v("s")}′ = ${R(fd(e.ds, 3) + " m / ciclu log")}`)}
          ${cl("Transmisivitatea", `${v("T")} = ${fr("0,183 × " + n4(Q), fd(e.ds, 3))} = ${R(fs(e.T) + " m²/zi")}`)}
          ${cl("Control la t/t′ = 1", `${v("s")}′ = ${fd(e.a, 3)} m ${Math.abs(e.a) <= 0.05 * p.smax ? `<span class="ok">practic zero — fără limite sau alimentare evidente</span>` : `<span class="warn">diferit de zero — vezi observațiile</span>`}`)}
          ${b > 0 ? cl("Permeabilitatea", `${v("K")} = ${fr(fs(e.T), fs(b, 4))} = ${R(fs(e.K) + " m/zi")} = ${sci(e.K / 86400)} m/s`) : ""}
        </div>`));
      });
    }

    // comparația între piezometre
    const d = res.dist;
    if (d) {
      const du = I.unconf && d.dupuitK, tr = d.regime === "trans";
      B.push(el(h2(++no, tr ? "Metoda distanță–denivelare (Cooper-Jacob)" : (du ? "Metoda Dupuit-Thiem (regim stabilizat)" : "Metoda Thiem (regim stabilizat)")) + (tr ? `
        <p>Denivelările citite în același moment în mai multe piezometre se așază pe o dreaptă în funcție de logaritmul distanței până la puț, cât timp u &lt; 0,05 în toate piezometrele (regim nepermanent). Panta pe un ciclu logaritmic al distanței (Δs<sub>r</sub>) dă transmisivitatea, iar distanța r₀ la care dreapta taie s = 0 dă coeficientul de înmagazinare.</p>
        <div class="eqs">${eq(`${v("T")} = ${fr("0,366 · " + v("Q"), "Δ" + v("s") + "<sub>r</sub>")}&nbsp;&nbsp;&nbsp;&nbsp; ${v("S")} = ${fr("2,25 · " + v("T") + " · " + v("t"), v("r") + "₀²")}`, "Cooper-Jacob, distanță–denivelare")}</div>` : `
        <p>În regim stabilizat, denivelările din piezometre nu mai cresc, iar diferența de nivel dintre ele rămâne constantă. Același debit trece prin orice cilindru din jurul puțului, ceea ce conduce la formula Thiem${du ? " (la nivel liber, forma Dupuit-Thiem, cu grosimile saturate h = b − s)" : ""}. Din regimul stabilizat se obține doar transmisivitatea (sau K); coeficientul de înmagazinare S nu se poate determina.</p>
        <div class="eqs">${eq(`${v("T")} = ${fr(v("Q") + " · ln(" + v("r") + "₂ / " + v("r") + "₁)", "2π · (" + v("s") + "₁ − " + v("s") + "₂)")} = ${fr("0,366 · " + v("Q"), "Δ" + v("s") + "<sub>r</sub>")}`, "Thiem")}${du ? eq(`${v("K")} = ${fr(v("Q") + " · ln(" + v("r") + "₂ / " + v("r") + "₁)", "π · (" + v("h") + "₂² − " + v("h") + "₁²)")}&nbsp;&nbsp;&nbsp;&nbsp; ${v("h")} = ${v("b")} − ${v("s")}`, "Dupuit-Thiem") : ""}</div>`)
        + `<p style="font-size:9pt;color:#587080">Regimul la t = ${fs(d.tstar)} min: <b>${tr ? "nepermanent" : "stabilizat"}</b>${d.dmode === "auto" ? `, stabilit automat (în ultimul ciclu de timp denivelarea a crescut cu ${fs(d.ratio * 100, 2)} % din panta Cooper-Jacob; prag pentru regim stabilizat: 25 %)` : ", ales de inginer"}.</p>`));
      B.push(el(fig(C.specDist(res), d.vals.map(x => `<span>${dot(x.color)}${esc(x.name)}</span>`).join("") + (tr ? `<span>${dot("#0b4f6c")}r₀</span>` : ""), `Figura ${no}.1 — Denivelările din piezometre la t = ${fs(d.tstar)} min${d.autoT ? " (ultimul timp comun)" : ""}, în funcție de logaritmul distanței.`)));
      const tst = d.tstar / 1440;
      B.push(el(`<div class="h3">Calculul aplicat</div><table><thead><tr><th>Piezometru</th><th class="n">r (m)</th><th class="n">${sym} la t = ${fs(d.tstar)} min (m)</th>${du && !tr ? '<th class="n">h = b − s (m)</th>' : ""}</tr></thead><tbody>
        ${d.vals.map(x => `<tr><td class="m">${dot(x.color)}${esc(x.name)}</td><td class="n">${fs(x.r, 4)}</td><td class="n">${fd(x.s, 3)}${x.interp ? " *" : ""}</td>${du && !tr ? `<td class="n">${fd(b - x.sr, 3)}</td>` : ""}</tr>`).join("")}
        </tbody></table>${d.vals.some(x => x.interp) ? `<p style="font-size:8.5pt;color:#587080;margin-top:1mm">* valoare interpolată între citirile vecine.</p>` : ""}
        <div class="calc" style="margin-top:3mm">
          ${cl("Panta dreptei", `Δ${v("s")}<sub>r</sub> = ${R(fd(d.dsR, 3) + " m / ciclu log de distanță")}${d.vals.length > 2 ? ` (R² = ${fs(d.r2, 4)})` : ""}`)}
          ${cl("Transmisivitatea", `${v("T")} = ${fr("0,366 × " + n4(Q), fd(d.dsR, 3))} = ${R(fs(d.T) + " m²/zi")}`)}
          ${tr ? cl("Înmagazinarea", `${v("r")}₀ = ${fs(d.r0)} m;&nbsp; ${v("S")} = ${fr("2,25 × " + fs(d.T) + " × " + fs(tst, 4), fs(d.r0) + "²")} = ${R(sS(d.S))}`) : cl("Înmagazinarea", "nu se poate determina din regimul stabilizat")}
          ${tr ? cl("Verificarea u", `în cel mai îndepărtat piezometru ${v("u")} = ${fs(d.uFar, 2)} ${d.uFar < 0.05 ? `<span class="ok">&lt; 0,05 — condiție îndeplinită</span>` : `<span class="warn">&gt; 0,05 — moment prea timpuriu</span>`}`) : cl("Verificarea regimului", `Δs între piezometre a variat cu ${isFinite(d.dsChange) ? fs(d.dsChange * 100, 2) + " %" : "—"} în ultimul ciclu de timp ${isFinite(d.dsChange) && d.dsChange <= 0.05 ? `<span class="ok">— practic constant</span>` : `<span class="warn">— regimul poate să nu fie stabilizat</span>`}`)}
          ${du && !tr ? cl("Dupuit-Thiem", `${v("K")} = ${R(fs(d.dupuitK) + " m/zi")} = ${sci(d.dupuitK / 86400)} m/s;&nbsp; ${v("T")} = ${v("K")}·${v("b")} = ${fs(d.dupuitT)} m²/zi`) : (b > 0 ? cl("Permeabilitatea", `${v("K")} = ${fr(fs(d.T), fs(b, 4))} = ${R(fs(d.K) + " m/zi")} = ${sci(d.K / 86400)} m/s`) : "")}
        </div>`));
    }

    // sinteză
    if (S) {
      let corrTxt = "";
      if (I.corr) {
        const p0 = P.find(p => isFinite(p.smax)), sm = p0 ? p0.smax : NaN, sc = sm - sm * sm / (2 * b);
        corrTxt = `<p>Pentru acviferul cu nivel liber, grosimea saturată scade în timpul pompării. Denivelările măsurate s-au corectat cu relația Jacob înainte de aplicarea metodelor:</p>
          <div class="eqs">${eq(`${v("s")}′ = ${v("s")} − ${fr(v("s") + "²", "2 · " + v("b"))}`, "corecția Jacob")}</div>
          ${isFinite(sm) ? `<div class="calc">${cl("Exemplu (" + esc(p0.name) + ", s<sub>max</sub>)", `${v("s")}′ = ${fd(sm, 3)} − ${fr(fd(sm, 3) + "²", "2 × " + fs(b, 4))} = ${R(fd(sc, 3) + " m")}`)}</div>` : ""}`;
      }
      B.push(el(h2(++no, "Permeabilitatea stratului — sinteză") + `
        <p>Permeabilitatea (coeficientul de filtrare) K se obține împărțind transmisivitatea la grosimea stratului pompat. Conversia în m/s: 1 m/zi = 1/86 400 m/s = 1,157·10⁻⁵ m/s.</p>
        <div class="eqs">${eq(`${v("K")} = ${fr(v("T"), v("b"))}&nbsp;&nbsp;&nbsp;&nbsp; ${v("K")}<sub>[m/s]</sub> = ${fr(v("K") + "<sub>[m/zi]</sub>", "86 400")}`)}${I.qu !== "md" ? eq(`${v("Q")} = ${n4(I.Qin)} ${I.quLabel} × ${I.qf} = ${n4(Q)} m³/zi`, "conversia debitului") : ""}</div>
        ${corrTxt}`));
      const ad = isFinite(S.Kad);
      B.push(el(`<table><thead><tr><th>Grup</th><th class="n">Rezultate incluse</th><th class="n">T mediu (m²/zi)</th><th class="n">K (m/zi)</th><th class="n">K (m/s)</th></tr></thead><tbody>
        ${S.groups.map(g => `<tr><td class="m">${esc(g.name)}</td><td class="n">${g.rows.length}</td><td class="n">${fs(g.Tm)}</td><td class="n">${fs(g.Km)}</td><td class="n">${sci(g.Km / 86400)}</td></tr>`).join("")}
        <tr class="mean"><td colspan="2">Media pe puncte (orientativ)</td><td class="n">${fs(S.Tm)}</td><td class="n">${fs(S.Km)}</td><td class="n">${sci(S.Km / 86400)}</td></tr></tbody></table>
        <p style="margin-top:3mm">${S.n > 1 ? `Rezultatele incluse sunt ${S.spread < 0.2 ? "apropiate" : "diferite"} (abatere maximă ${fs(S.spread * 100, 2)} % față de media pe puncte). ` : ""}Media pe puncte este orientativă: rezultatele aceluiași punct (Cooper-Jacob, Theis, revenire) nu sunt măsurători independente, de aceea fiecare punct are aceeași pondere.</p>
        <div class="tiles" style="grid-template-columns:1.3fr 2.7fr;margin-top:3mm">
          <div class="tile main"><span class="k">K adoptat pentru proiectare</span><span class="v">${ad ? fs(S.Kad) + " m/zi" : "—"}</span><span class="u">${ad ? sci(S.Kad / 86400) + " m/s" : "necompletat"}</span></div>
          <div class="tile"><span class="k">Justificare</span><span class="u" style="font-size:9.4pt;color:#10252f">${ad ? (S.just ? esc(S.just) : "<i>necompletată</i>") : "Valoarea de proiectare nu a fost adoptată. Se stabilește de inginer, ținând seama de graficele, verificările și observațiile din raport și de tipul de pământ din foraje."}</span></div>
        </div>
        <div class="sign"><div>Întocmit</div><div>Verificat</div></div>`));
    }

    // anexe
    annex(B, res, "pump", "A1", "Anexă — citiri în timpul pompării", "t (min)");
    annex(B, res, "rec", "A2", "Anexă — citiri la revenire", "t′ (min)");
    return B;
  }

  function annex(B, res, kind, code, title, tlab) {
    const I = res.inp, P = res.points;
    const rows = (kind === "pump" ? res.pumpRows : res.recRows).filter(r => r.t > 0 && r.v.slice(0, I.n).some(isFinite));
    if (!rows.length) return;
    const val = (p, t) => { const a = kind === "pump" ? p.pump : p.rec; return a.find(q => q.t === t); };
    const one = I.n === 1;
    const hdr = `<tr><th class="n">t</th>${P.map(p => (I.modeH ? `<th class="n">${esc(p.name)} nivel</th>` : "") + `<th class="n">${esc(p.name)} ${kind === "pump" ? "s" : "s′"}</th>`).join("")}</tr>`;
    const row = r => `<tr><td class="n">${fs(r.t, 5)}</td>${P.map(p => { const q = val(p, r.t); return (I.modeH ? `<td class="n">${q ? fd(q.v, 2) : ""}</td>` : "") + `<td class="n">${q ? fd(q.s, 3) : ""}</td>`; }).join("")}</tr>`;
    const per = one ? 34 : 40;
    const chunks = []; for (let i = 0; i < rows.length; i += per) chunks.push(rows.slice(i, i + per));
    const groups = one ? chunks.reduce((g, c, i) => (i % 2 ? g[g.length - 1].push(c) : g.push([c]), g), []) : chunks.map(c => [c]);
    groups.forEach((gr, k) => {
      B.push(el((k === 0 ? `<div class="h2"><span class="no">${code}</span><span class="tt">${title}</span></div><p style="font-size:8.6pt;color:#587080">t în minute ${kind === "pump" ? "de la pornire" : "de la oprire"}; ${I.modeH ? "nivel = adâncimea față de reper (m); " : ""}${kind === "pump" ? "s" : "s′"} = denivelarea${I.corr ? " corectată Jacob" : ""} (m).</p>` : "") +
        `<div class="${one ? "data2" : ""}">${gr.map(ch => `<table><thead>${hdr}</thead><tbody>${ch.map(row).join("")}</tbody></table>`).join("")}</div>`, k === 0 && kind === "pump" ? { newPage: true } : null));
    });
  }

  /* ---------- paginare ---------- */
  const trunc = (s, n) => s.length > n ? s.slice(0, n - 1) + "…" : s;
  function newPage(host, meta, first) {
    const p = document.createElement("div");
    p.className = "page" + (first ? " first" : "");
    p.innerHTML = `<div class="p-head"><span class="pb">Raport · Test de pompare</span><span class="pr">${esc(meta.punct || "")}${meta.punct && meta.data ? " · " : ""}${esc(dateRO(meta.data) === "—" ? "" : dateRO(meta.data))}</span></div>
      <div class="p-body"></div>
      <div class="p-foot"><span>${esc(trunc([meta.lucrare, meta.amplasament].filter(Boolean).join(" · "), 110))}</span><span class="pn"></span></div>`;
    host.appendChild(p);
    return { page: p, body: p.querySelector(".p-body") };
  }
  function paginate(host, blocks, meta) {
    host.innerHTML = "";
    let cur = newPage(host, meta, true);
    const over = () => cur.body.scrollHeight > cur.body.clientHeight + 1;
    blocks.forEach(bk => {
      if (bk.dataset.newpage && cur.body.children.length) cur = newPage(host, meta, false);
      cur.body.appendChild(bk);
      if (over() && cur.body.children.length > 1) { cur.body.removeChild(bk); cur = newPage(host, meta, false); cur.body.appendChild(bk); }
    });
    const pages = [...host.querySelectorAll(".page")];
    pages.forEach((p, i) => p.querySelector(".pn").textContent = `Pagina ${i + 1} din ${pages.length}`);
    return pages;
  }
  async function fontsReady() {
    try {
      await Promise.all(["400 12px Barlow", "500 12px Barlow", "600 12px Barlow", "italic 400 12px Barlow", "600 12px 'Barlow Condensed'", "700 12px 'Barlow Condensed'", "400 12px 'JetBrains Mono'"].map(f => document.fonts.load(f, "ăîâșțĂÎÂȘȚ")));
      await document.fonts.ready;
    } catch (e) { }
  }
  async function build(res, meta) {
    await fontsReady();
    const host = document.getElementById("reportBuild");
    const pages = paginate(host, buildBlocks(res, meta), meta);
    await Promise.all([...host.querySelectorAll("img")].map(im => im.complete ? 0 : new Promise(r => { im.onload = im.onerror = r; })));
    return pages;
  }
  function fileName(meta) {
    const slug = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40);
    return ["Raport_test_pompare", slug(meta.lucrare), slug(meta.punct), meta.data || ""].filter(Boolean).join("_") + ".pdf";
  }
  async function makePDF(res, meta, onProgress) {
    const pages = await build(res, meta);
    const { jsPDF } = global.jspdf;
    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
    for (let i = 0; i < pages.length; i++) {
      onProgress && onProgress(i + 1, pages.length);
      const cv = await global.html2canvas(pages[i], { scale: 2.6, backgroundColor: "#ffffff", useCORS: true, logging: false });
      if (i) pdf.addPage();
      pdf.addImage(cv.toDataURL("image/jpeg", 0.93), "JPEG", 0, 0, 210, 297, undefined, "FAST");
    }
    pdf.setProperties({ title: "Raport test de pompare — " + (meta.lucrare || ""), subject: "Interpretarea testului de pompare", author: meta.firma || "", creator: "Teste de pompare" });
    const name = fileName(meta);
    pdf.save(name);
    return { name, pages: pages.length };
  }
  global.PTReport = { build, makePDF, fileName };
})(window);
