/* Raportul A4: construcție, paginare automată, export PDF (html2canvas + jsPDF) și tipărire */
(function (global) {
  "use strict";
  const { fs, fd, sci, fS, W } = global.PT;
  const C = global.PTChart;

  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const v = x => `<i>${x}</i>`;
  const fr = (a, b) => `<span class="fr"><span class="fn">${a}</span><span class="fd">${b}</span></span>`;
  const eq = (body, tag) => `<div class="eq">${body}${tag ? `<span class="tag">${tag}</span>` : ""}</div>`;
  const cl = (label, body) => `<div class="cl"><div class="l">${label}</div><div class="f">${body}</div></div>`;
  const R = x => `<span class="res">${x}</span>`;
  const n4 = x => fs(x, 4);
  const dateRO = d => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d || ""); return m ? `${m[3]}.${m[2]}.${m[1]}` : (d || "—"); };
  const sS = x => fS(x); // S formatat (științific sub 0,01)

  function el(html, cls, opts) {
    const d = document.createElement("div");
    d.className = "blk " + (cls || "");
    d.innerHTML = html;
    if (opts && opts.newPage) d.dataset.newpage = "1";
    return d;
  }
  function h2(no, title) { return `<div class="h2"><span class="no">${no}</span><span class="tt">${title}</span></div>`; }
  function fig(spec, legend, caption) {
    if (!spec) return "";
    const src = C.toPNG(spec, 680, 265, 3);
    return `<div class="fig">${legend ? `<div class="fl">${legend}</div>` : ""}<img src="${src}" alt=""><div class="fc">${caption}</div></div>`;
  }
  const LEG = {
    pts: `<span><i class="f"></i>citiri folosite la calcul</span><span><i class="h"></i>citiri excluse</span>`,
    line: `<span><i class="l"></i>dreapta ajustată</span>`,
    t0: `<span><i class="t"></i>t₀</span>`,
    theis: `<span><i class="d"></i>curba Theis calculată</span>`
  };

  /* ---------- blocurile raportului ---------- */
  function buildBlocks(res, meta) {
    const B = [], I = res.inp, Q = I.Q, b = I.b, r = I.r, S = res.summary;
    const sym = I.corr ? "s′" : "s";
    let no = 0;

    // copertă
    B.push(el(`<div class="cover">
      <svg class="drop" viewBox="0 0 32 32"><path d="M16 3C11 10 7 15 7 20a9 9 0 0 0 18 0c0-5-4-10-9-17z" fill="#ffffff" fill-opacity=".9"/><path d="M11.5 21a4.5 4.5 0 0 0 4.5 4.5" stroke="#1479a3" stroke-width="2" fill="none" stroke-linecap="round"/></svg>
      <div class="ey">Raport tehnic · Încercare geohidraulică</div>
      <h1>Interpretarea testului de pompare</h1>
      <div class="sub">Determinarea transmisivității, a coeficientului de înmagazinare și a permeabilității stratului acvifer pompat</div>
    </div>`, "", null));
    B.push(el(`<div class="meta">
      <div class="w"><span class="k">Lucrare</span><span class="v">${esc(meta.lucrare) || "—"}</span></div>
      <div class="w"><span class="k">Amplasament</span><span class="v">${esc(meta.amplasament) || "—"}</span></div>
      <div><span class="k">Puț / punct de măsură</span><span class="v">${esc(meta.punct) || "—"}</span></div>
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
      ["Distanța de măsură r", `${fs(r, 4)} m${I.isPW ? " (puțul de pompare)" : ""}`],
      ["Nivel static", I.modeH ? `${fs(I.NS, 4)} m sub reper` : "denivelări introduse direct"],
      ["Durata pompării tp", isFinite(I.tp) ? `${fs(I.tp, 5)} min (${fs(I.tp / 60, 3)} h)` : "—"],
      ["Citiri pompare / revenire", `${res.pump.length} / ${res.rec.length}`],
      ["Denivelarea maximă", `${fs(res.smax, 3)} m`],
      ["Unități de calcul", "Q în m³/zi, t în zile"]
    ];
    B.push(el(h2(++no, "Date de intrare") + `<div class="kv">${kv.map(([k, x]) => `<div><span class="k">${k}</span><span class="v">${x}</span></div>`).join("")}</div>`));

    // rezultate
    if (S) {
      const rows = [["Cooper-Jacob", res.cj], ["Theis", res.th], ["Revenire (Theis-Jacob)", res.re], ["Thiem", res.ti]].filter(x => x[1]);
      B.push(el(h2(++no, "Rezultate") + `
        <div class="tiles">
          <div class="tile main"><span class="k">Permeabilitate K (medie)</span><span class="v">${b > 0 ? fs(S.Km) + " m/zi" : "—"}</span><span class="u">${b > 0 ? sci(S.Km / 86400) + " m/s" : "necesită b"}</span></div>
          <div class="tile"><span class="k">Transmisivitate T</span><span class="v">${fs(S.Tm)}</span><span class="u">m²/zi</span></div>
          <div class="tile s"><span class="k">Înmagazinare S</span><span class="v">${sS(S.S)}</span><span class="u">${isFinite(S.S) ? (res.th ? "din Theis" : "din Cooper-Jacob") : "nedeterminat"}</span></div>
          <div class="tile t"><span class="k">Interval K</span><span class="v">${b > 0 && S.n > 1 ? fs(S.Kmin) + "–" + fs(S.Kmax) : "—"}</span><span class="u">${S.n} ${S.n === 1 ? "metodă" : "metode"} · m/zi</span></div>
        </div>
        <table><thead><tr><th>Metodă</th><th class="n">T (m²/zi)</th><th class="n">K (m/zi)</th><th class="n">K (m/s)</th><th class="n">S</th></tr></thead><tbody>
        ${rows.map(([nme, m]) => `<tr><td class="m">${nme}</td><td class="n">${fs(m.T)}</td><td class="n">${fs(m.K)}</td><td class="n">${sci(m.K / 86400)}</td><td class="n">${m.S && !I.isPW ? sS(m.S) : (m.S ? "(" + sS(m.S) + ")" : "—")}</td></tr>`).join("")}
        <tr class="mean"><td>Medie aritmetică</td><td class="n">${fs(S.Tm)}</td><td class="n">${fs(S.Km)}</td><td class="n">${sci(S.Km / 86400)}</td><td class="n">${sS(S.S)}</td></tr>
        </tbody></table>`));
    }
    if (res.notes.length) B.push(el(`<div class="h3">Observații de verificare</div><div class="rnotes">${res.notes.map(([c, t]) => `<div class="${c}">${esc(t)}</div>`).join("")}</div>`));
    B.push(el(`<div class="h3">Ipotezele metodelor de interpretare</div><ul class="hyp">
      <li>acviferul este omogen, izotrop, de grosime constantă și de extindere practic nelimitată în zona de influență;</li>
      <li>puțul de pompare este complet (filtrul acoperă toată grosimea stratului), iar curgerea spre puț este radială și orizontală;</li>
      <li>debitul pompat este constant pe toată durata testului, iar nivelul inițial este practic orizontal;</li>
      <li>apa este cedată instantaneu din înmagazinare la scăderea sarcinii${I.unconf ? "; pentru nivel liber, denivelările sunt corectate cu relația Jacob" : ""}.</li></ul>`));

    // Cooper-Jacob
    B.push(el(h2(++no, "Metoda Cooper-Jacob") + `
      <p>Metoda Cooper-Jacob (1946) este o simplificare a soluției Theis, valabilă când parametrul u = r²S/(4Tt) este mic (u &lt; 0,05), adică pentru distanțe mici sau timpi suficient de mari. În acest caz denivelarea crește liniar cu logaritmul timpului, iar pe un grafic semilogaritmic citirile se așază pe o dreaptă. Panta dreptei, exprimată ca variație a denivelării pe un ciclu logaritmic (Δs), dă transmisivitatea; intersecția dreptei cu axa s = 0, la timpul t₀, dă coeficientul de înmagazinare.</p>
      <div class="eqs">
        ${eq(`${v("s")} = ${fr("2,30 · " + v("Q"), "4π" + v("T"))} · lg ${fr("2,25 · " + v("T") + " · " + v("t"), v("r") + "² · " + v("S"))}`, "ecuația dreptei")}
        ${eq(`${v("T")} = ${fr("0,183 · " + v("Q"), "Δ" + v("s"))}&nbsp;&nbsp;&nbsp;&nbsp; ${v("S")} = ${fr("2,25 · " + v("T") + " · " + v("t") + "₀", v("r") + "²")}&nbsp;&nbsp;&nbsp;&nbsp; ${v("u")} = ${fr(v("r") + "² · " + v("S"), "4 · " + v("T") + " · " + v("t"))} &lt; 0,05`)}
      </div>`));
    if (res.cj) {
      const c = res.cj, t0d = c.t0 / 1440, t1d = c.t1 / 1440;
      B.push(el(fig(C.specCJ(res), LEG.pts + LEG.line + LEG.t0, `Figura ${no}.1 — Denivelarea ${I.corr ? "corectată " : ""}în funcție de logaritmul timpului. Dreapta este ajustată prin regresie liniară pe ${c.n} citiri, între ${fs(c.t1)} și ${fs(c.t2)} min (R² = ${fs(c.r2, 4)}).`)));
      B.push(el(`<div class="h3">Calculul aplicat</div><div class="calc">
        ${cl("Panta dreptei", `Δ${v("s")} = ${sym}(10·${v("t")}) − ${sym}(${v("t")}) = ${R(fd(c.ds, 3) + " m / ciclu log")}`)}
        ${cl("Transmisivitatea", `${v("T")} = ${fr("0,183 · " + v("Q"), "Δ" + v("s"))} = ${fr("0,183 × " + n4(Q), fd(c.ds, 3))} = ${R(fs(c.T) + " m²/zi")}`)}
        ${cl("Timpul t₀", `${v("t")}₀ = 10<sup>−a/Δs</sup> = ${fs(c.t0)} min = ${sci(t0d, 3)} zile`)}
        ${isFinite(c.S) ? cl("Înmagazinarea", `${v("S")} = ${fr("2,25 · " + v("T") + " · " + v("t") + "₀", v("r") + "²")} = ${fr("2,25 × " + fs(c.T) + " × " + sci(t0d, 3), fs(r, 4) + "²")} = ${R(sS(c.S))}${I.isPW ? ` <span class="warn">orientativ (măsurat în puț)</span>` : ""}`) : ""}
        ${isFinite(c.u) && !I.isPW ? cl("Verificarea u", `${v("u")} = ${fr(v("r") + "² · " + v("S"), "4 · " + v("T") + " · " + v("t") + "₁")} = ${fr(fs(r, 4) + "² × " + sS(c.S), "4 × " + fs(c.T) + " × " + sci(t1d, 3))} = ${fs(c.u, 2)} ${c.u < 0.05 ? `<span class="ok">&lt; 0,05 — condiție îndeplinită</span>` : `<span class="warn">&gt; 0,05 — începutul intervalului trebuie mutat</span>`}`) : ""}
        ${b > 0 ? cl("Permeabilitatea", `${v("K")} = ${fr(v("T"), v("b"))} = ${fr(fs(c.T), fs(b, 4))} = ${R(fs(c.K) + " m/zi")} = ${sci(c.K / 86400)} m/s`) : ""}
      </div>`));
    } else B.push(el(`<p>Metoda nu a putut fi aplicată: sunt necesare cel puțin 3 citiri cu denivelare pozitivă în intervalul ales.</p>`));

    // Theis
    B.push(el(h2(++no, "Metoda Theis") + `
      <p>Soluția Theis (1935) descrie curgerea nepermanentă radială spre un puț complet, pompat cu debit constant, într-un acvifer sub presiune, omogen și de extindere practic nelimitată. Denivelarea la distanța r și la timpul t este proporțională cu funcția de puț W(u). Parametrii T și S s-au determinat prin ajustarea curbei teoretice pe citiri, prin metoda celor mai mici pătrate: se caută perechea T, S pentru care suma pătratelor diferențelor dintre denivelările măsurate și cele calculate este minimă.</p>
      <div class="eqs">
        ${eq(`${v("s")} = ${fr(v("Q"), "4π" + v("T"))} · ${v("W")}(${v("u")})&nbsp;&nbsp;&nbsp;&nbsp; ${v("u")} = ${fr(v("r") + "² · " + v("S"), "4 · " + v("T") + " · " + v("t"))}`)}
        ${eq(`${v("W")}(${v("u")}) = −0,5772 − ln ${v("u")} + ${v("u")} − ${fr(v("u") + "²", "2 · 2!")} + ${fr(v("u") + "³", "3 · 3!")} − …`, "funcția de puț")}
        ${eq(`min Σ (${v("s")}<sub>măs</sub> − ${v("s")}<sub>calc</sub>)²`, "criteriul de ajustare")}
      </div>`));
    if (res.th) {
      const t = res.th, k = t.check, td = k.t / 1440;
      B.push(el(fig(C.specTH(res), LEG.pts + LEG.theis, `Figura ${no}.1 — Citirile în coordonate logaritmice și curba Theis calculată pentru parametrii ajustați (${t.n} citiri folosite).`)));
      B.push(el(`<div class="h3">Calculul aplicat</div><div class="calc">
        ${cl("Parametri ajustați", `${v("T")} = ${R(fs(t.T) + " m²/zi")}&nbsp; ${v("S")} = ${R(sS(t.S))}${I.isPW ? ` <span class="warn">S orientativ (măsurat în puț)</span>` : ""}`)}
        ${cl("Calitatea ajustării", `eroarea medie pătratică = ${fs(t.rmse * 100, 2)} cm, pe ${t.n} citiri (${fs(t.t1)} – ${fs(t.t2)} min)`)}
        ${cl("Verificare la t = " + fs(k.t) + " min", `${v("u")} = ${fr(fs(r, 4) + "² × " + sS(t.S), "4 × " + fs(t.T) + " × " + fs(td, 4))} = ${sci(k.u, 3)} ;&nbsp; ${v("W")}(${v("u")}) = ${fd(k.W, 3)}`)}
        ${cl("", `${v("s")}<sub>calc</sub> = ${fr(n4(Q), "4π × " + fs(t.T))} × ${fd(k.W, 3)} = ${R(fd(k.s, 3) + " m")}&nbsp; față de ${v("s")}<sub>măs</sub> = ${fd(k.smeas, 3)} m`)}
        ${b > 0 ? cl("Permeabilitatea", `${v("K")} = ${fr(v("T"), v("b"))} = ${fr(fs(t.T), fs(b, 4))} = ${R(fs(t.K) + " m/zi")} = ${sci(t.K / 86400)} m/s`) : ""}
      </div>`));
    } else B.push(el(`<p>Metoda nu a putut fi aplicată: sunt necesare distanța r și cel puțin 4 citiri cu denivelare pozitivă.</p>`));

    // Revenire
    if (res.rec.length) {
      B.push(el(h2(++no, "Metoda revenirii (Theis-Jacob)") + `
        <p>După oprirea pompei nivelul revine. Prin suprapunerea efectelor, revenirea se tratează ca o pompare continuă cu debitul Q, la care se adaugă din momentul opririi o injecție cu același debit. Pentru u mic, denivelarea reziduală s′ variază liniar cu lg(t/t′), unde t este timpul de la pornire și t′ timpul de la oprire. Panta dreptei pe un ciclu logaritmic (Δs′) dă transmisivitatea. Metoda este puțin sensibilă la variațiile de debit din timpul pompării și se poate aplica și în puțul de pompare.</p>
        <div class="eqs">
          ${eq(`${v("s")}′ = ${fr(v("Q"), "4π" + v("T"))} · [${v("W")}(${v("u")}) − ${v("W")}(${v("u")}′)] ≈ ${fr("2,30 · " + v("Q"), "4π" + v("T"))} · lg ${fr(v("t"), v("t") + "′")}&nbsp;&nbsp;&nbsp;&nbsp; ${v("t")} = ${v("t")}<sub>p</sub> + ${v("t")}′`)}
          ${eq(`${v("T")} = ${fr("0,183 · " + v("Q"), "Δ" + v("s") + "′")}`)}
        </div>`));
      if (res.re) {
        const e = res.re;
        B.push(el(fig(C.specRE(res), LEG.pts + LEG.line, `Figura ${no}.1 — Denivelarea reziduală în funcție de lg(t/t′). Datele târzii (t/t′ mic) sunt cele reprezentative; tp = ${fs(e.tp, 5)} min.`)));
        B.push(el(`<div class="h3">Calculul aplicat</div><div class="calc">
          ${cl("Panta dreptei", `Δ${v("s")}′ = ${R(fd(e.ds, 3) + " m / ciclu log")}&nbsp; (${e.n} citiri, R² = ${fs(e.r2, 4)})`)}
          ${cl("Transmisivitatea", `${v("T")} = ${fr("0,183 · " + v("Q"), "Δ" + v("s") + "′")} = ${fr("0,183 × " + n4(Q), fd(e.ds, 3))} = ${R(fs(e.T) + " m²/zi")}`)}
          ${cl("Control la t/t′ = 1", `${v("s")}′ = ${fd(e.a, 3)} m ${Math.abs(e.a) <= 0.05 * res.smax ? `<span class="ok">practic zero — fără limite sau alimentare evidente</span>` : `<span class="warn">diferit de zero — vezi observațiile</span>`}`)}
          ${b > 0 ? cl("Permeabilitatea", `${v("K")} = ${fr(v("T"), v("b"))} = ${fr(fs(e.T), fs(b, 4))} = ${R(fs(e.K) + " m/zi")} = ${sci(e.K / 86400)} m/s`) : ""}
        </div>`));
      } else B.push(el(`<p>Revenirea nu a putut fi interpretată: sunt necesare cel puțin 3 citiri în intervalul ales și durata pompării.</p>`));
    }

    // Thiem
    if (res.ti) {
      const t = res.ti;
      B.push(el(h2(++no, "Metoda Thiem (regim stabilizat)") + `
        <p>Metoda Thiem (1906) folosește regimul stabilizat: după un timp suficient de lung, diferența de denivelare dintre două piezometre aflate la distanțe diferite de puț nu se mai modifică. Debitul care trece prin orice suprafață cilindrică din jurul puțului este același, ceea ce conduce la o relație logaritmică între debit și diferența de nivel.</p>
        <div class="eqs">
          ${t.unconf
            ? eq(`${v("K")} = ${fr(v("Q") + " · ln(" + v("r") + "₂ / " + v("r") + "₁)", "π · (" + v("h") + "₂² − " + v("h") + "₁²)")}&nbsp;&nbsp;&nbsp;&nbsp; ${v("h")} = ${v("b")} − ${v("s")}`, "nivel liber")
            : eq(`${v("T")} = ${fr(v("Q") + " · ln(" + v("r") + "₂ / " + v("r") + "₁)", "2π · (" + v("s") + "₁ − " + v("s") + "₂)")}`, "acvifer sub presiune")}
        </div>
        <div class="h3">Calculul aplicat</div><div class="calc">
          ${cl("Date", `${v("r")}₁ = ${fs(t.r1, 4)} m, ${v("s")}₁ = ${fs(t.s1, 4)} m;&nbsp; ${v("r")}₂ = ${fs(t.r2, 4)} m, ${v("s")}₂ = ${fs(t.s2, 4)} m`)}
          ${t.unconf
            ? cl("Permeabilitatea", `${v("K")} = ${fr(n4(Q) + " × ln(" + fs(t.r2, 4) + " / " + fs(t.r1, 4) + ")", "π × (" + fs(t.h2, 4) + "² − " + fs(t.h1, 4) + "²)")} = ${R(fs(t.K) + " m/zi")} = ${sci(t.K / 86400)} m/s`) + cl("Transmisivitatea", `${v("T")} = ${v("K")} · ${v("b")} = ${fs(t.K)} × ${fs(b, 4)} = ${R(fs(t.T) + " m²/zi")}`)
            : cl("Transmisivitatea", `${v("T")} = ${fr(n4(Q) + " × ln(" + fs(t.r2, 4) + " / " + fs(t.r1, 4) + ")", "2π × (" + fs(t.s1, 4) + " − " + fs(t.s2, 4) + ")")} = ${R(fs(t.T) + " m²/zi")}`) + (b > 0 ? cl("Permeabilitatea", `${v("K")} = ${fr(v("T"), v("b"))} = ${fr(fs(t.T), fs(b, 4))} = ${R(fs(t.K) + " m/zi")} = ${sci(t.K / 86400)} m/s`) : "")}
        </div>`));
    }

    // sinteză K
    if (S) {
      let corrTxt = "";
      if (I.corr) {
        const sm = res.smax, sc = sm - sm * sm / (2 * b);
        corrTxt = `<p>Pentru acviferul cu nivel liber, grosimea saturată scade în timpul pompării. Denivelările măsurate s-au corectat cu relația Jacob înainte de aplicarea metodelor de mai sus:</p>
          <div class="eqs">${eq(`${v("s")}′ = ${v("s")} − ${fr(v("s") + "²", "2 · " + v("b"))}`, "corecția Jacob")}</div>
          <div class="calc">${cl("Exemplu la s<sub>max</sub>", `${v("s")}′ = ${fd(sm, 3)} − ${fr(fd(sm, 3) + "²", "2 × " + fs(b, 4))} = ${R(fd(sc, 3) + " m")}`)}</div>`;
      }
      B.push(el(h2(++no, "Permeabilitatea stratului — sinteză") + `
        <p>Permeabilitatea (coeficientul de filtrare) K se obține împărțind transmisivitatea la grosimea stratului pompat. Conversia în m/s: 1 m/zi = 1/86 400 m/s = 1,157·10⁻⁵ m/s.</p>
        <div class="eqs">${eq(`${v("K")} = ${fr(v("T"), v("b"))}&nbsp;&nbsp;&nbsp;&nbsp; ${v("K")}<sub>[m/s]</sub> = ${fr(v("K") + "<sub>[m/zi]</sub>", "86 400")}`)}${I.qu !== "md" ? eq(`${v("Q")} = ${n4(I.Qin)} ${I.quLabel} × ${I.qf} = ${n4(Q)} m³/zi`, "conversia debitului") : ""}</div>
        ${corrTxt}`));
      const rows = [["Cooper-Jacob", res.cj], ["Theis", res.th], ["Revenire", res.re], ["Thiem", res.ti]].filter(x => x[1]);
      B.push(el(`<table><thead><tr><th>Metodă</th><th class="n">T (m²/zi)</th><th class="n">b (m)</th><th class="n">K (m/zi)</th><th class="n">K (m/s)</th></tr></thead><tbody>
        ${rows.map(([nme, m]) => `<tr><td class="m">${nme}</td><td class="n">${fs(m.T)}</td><td class="n">${fs(b, 4)}</td><td class="n">${fs(m.K)}</td><td class="n">${sci(m.K / 86400)}</td></tr>`).join("")}
        <tr class="mean"><td>Medie aritmetică</td><td class="n">${fs(S.Tm)}</td><td class="n">${fs(b, 4)}</td><td class="n">${fs(S.Km)}</td><td class="n">${sci(S.Km / 86400)}</td></tr></tbody></table>
        <p style="margin-top:3mm">${S.n > 1 ? `Metodele aplicate dau valori ${S.spread < 0.2 ? "apropiate" : "diferite"} (abatere maximă ${fs(S.spread * 100, 2)} % față de medie). ` : ""}Valoarea medie este o medie aritmetică a metodelor aplicate; valoarea de proiectare se stabilește de inginer, ținând seama de graficele și observațiile din raport.</p>
        <div class="sign"><div>Întocmit</div><div>Verificat</div></div>`));
    }

    // anexe cu datele
    const pump = res.pump;
    if (pump.length) {
      const hdr = `<tr><th class="n">Nr.</th><th class="n">t (min)</th>${I.modeH ? '<th class="n">Nivel (m)</th>' : ""}<th class="n">s (m)</th>${I.corr ? '<th class="n">s′ (m)</th>' : ""}</tr>`;
      const row = (p, i) => `<tr><td class="n">${i + 1}</td><td class="n">${fs(p.t, 5)}</td>${I.modeH ? `<td class="n">${fd(p.v, 2)}</td>` : ""}<td class="n">${fd(p.sr, 3)}</td>${I.corr ? `<td class="n">${fd(p.s, 3)}</td>` : ""}</tr>`;
      chunked(pump, 34).forEach((pair, k) => {
        B.push(el((k === 0 ? h2("A1", "Anexă — citiri în timpul pompării") : "") +
          `<div class="data2">${pair.map(ch => `<table><thead>${hdr}</thead><tbody>${ch.rows.map(p => row(p, ch.start + ch.rows.indexOf(p))).join("")}</tbody></table>`).join("")}</div>`, "", k === 0 ? { newPage: true } : null));
      });
    }
    if (res.rec.length) {
      const hdr = `<tr><th class="n">Nr.</th><th class="n">t′ (min)</th><th class="n">t/t′</th>${I.modeH ? '<th class="n">Nivel (m)</th>' : ""}<th class="n">s′ (m)</th></tr>`;
      const row = (p, i) => `<tr><td class="n">${i + 1}</td><td class="n">${fs(p.t, 5)}</td><td class="n">${fs(p.x, 4)}</td>${I.modeH ? `<td class="n">${fd(p.v, 2)}</td>` : ""}<td class="n">${fd(p.s, 3)}</td></tr>`;
      chunked(res.rec, 34).forEach((pair, k) => {
        B.push(el((k === 0 ? h2("A2", "Anexă — citiri la revenire") : "") +
          `<div class="data2">${pair.map(ch => `<table><thead>${hdr}</thead><tbody>${ch.rows.map((p, j) => row(p, ch.start + j)).join("")}</tbody></table>`).join("")}</div>`));
      });
    }
    return B;
  }
  // împarte în coloane de câte n rânduri, grupate câte două pe bloc
  function chunked(arr, n) {
    const cols = [];
    for (let i = 0; i < arr.length; i += n) cols.push({ start: i, rows: arr.slice(i, i + n) });
    const pairs = [];
    for (let i = 0; i < cols.length; i += 2) pairs.push(cols.slice(i, i + 2));
    return pairs;
  }

  /* ---------- paginare ---------- */
  function newPage(host, meta, first) {
    const p = document.createElement("div");
    p.className = "page" + (first ? " first" : "");
    p.innerHTML = `<div class="p-head"><span class="pb">Raport · Test de pompare</span><span class="pr">${esc(meta.punct || "")}${meta.punct && meta.data ? " · " : ""}${esc(dateRO(meta.data) === "—" ? "" : dateRO(meta.data))}</span></div>
      <div class="p-body"></div>
      <div class="p-foot"><span>${esc(trunc([meta.lucrare, meta.amplasament].filter(Boolean).join(" · "), 110))}</span><span class="pn"></span></div>`;
    host.appendChild(p);
    return { page: p, body: p.querySelector(".p-body") };
  }
  const trunc = (s, n) => s.length > n ? s.slice(0, n - 1) + "…" : s;

  function paginate(host, blocks, meta) {
    host.innerHTML = "";
    let cur = newPage(host, meta, true);
    const over = () => cur.body.scrollHeight > cur.body.clientHeight + 1;
    blocks.forEach(bk => {
      if (bk.dataset.newpage && cur.body.children.length) cur = newPage(host, meta, false);
      cur.body.appendChild(bk);
      if (over() && cur.body.children.length > 1) {
        cur.body.removeChild(bk);
        cur = newPage(host, meta, false);
        cur.body.appendChild(bk);
      }
    });
    const pages = [...host.querySelectorAll(".page")];
    pages.forEach((p, i) => p.querySelector(".pn").textContent = `Pagina ${i + 1} din ${pages.length}`);
    return pages;
  }

  async function fontsReady() {
    try {
      await Promise.all(["400 12px Barlow", "500 12px Barlow", "600 12px Barlow", "italic 400 12px Barlow", "600 12px 'Barlow Condensed'", "700 12px 'Barlow Condensed'", "400 12px 'JetBrains Mono'"].map(f => document.fonts.load(f, "ăîâșțĂÎÂȘȚ")));
      await document.fonts.ready;
    } catch (e) { /* fonturile de rezervă sunt suficiente */ }
  }

  async function build(res, meta) {
    await fontsReady();
    const host = document.getElementById("reportBuild");
    const blocks = buildBlocks(res, meta);
    const pages = paginate(host, blocks, meta);
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
    return { name, pages: pages.length, pdf };
  }

  global.PTReport = { build, makePDF, fileName };
})(window);
