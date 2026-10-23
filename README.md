# Teste de pompare

Site static pentru interpretarea testelor de pompare și generarea raportului tehnic în PDF.

**Ce face**
- citirile se trec direct în site, într-un tabel cu câmpuri (timp + nivel), pentru **1, 2 sau 3 puncte de măsură** (piezometre sau puțul pompat), separat pentru pompare și revenire; se poate lipi și din Excel;
- calculează transmisivitatea T, coeficientul de înmagazinare S și permeabilitatea K = T/b pentru fiecare punct prin Cooper-Jacob (cu alegerea automată a intervalului din condiția u < 0,05), Theis (ajustare automată prin cele mai mici pătrate) și revenire (Theis-Jacob); cu două sau trei piezometre adaugă comparația între piezometre: distanță–denivelare (Cooper-Jacob, T și S) în regim nepermanent sau Thiem / Dupuit-Thiem (doar T) în regim stabilizat, cu detectarea automată a regimului;
- tipul acviferului poate fi **sub presiune**, **semi-captiv (drenant)** sau **cu nivel liber**:
  - în acviferul sub presiune, dacă curba se aplatizează (drenanță prin stratul acoperitor sau o limită de alimentare), programul aplică automat **Hantush-Jacob** (T, S, factorul de drenanță L și rezistența c = L²/T) și scoate din medie Cooper-Jacob, Theis și revenirea; la „semi-captiv” Hantush-Jacob se calculează mereu; în regim stabilizat, comparația între piezometre se face cu **de Glee** în loc de Thiem;
  - la nivel liber, dacă curba are forma în „S” a cedării întârziate, programul aplică **Boulton** (T, S, cedarea specifică Sy, indicele α); rezultatul este acceptat doar dacă testul a ajuns în porțiunea finală a curbei; din α nu se calculează Kz (după Neuman, α nu este o constantă a stratului);
  - soluțiile se calculează în spațiul Laplace și se inversează numeric (Stehfest);
 (u < 0,05, u′ la revenire, alinierea punctelor, revenirea la zero, S plauzibil, s < 25 % din b la nivel liber) și scoate din medie rezultatele care nu trec verificarea; orice rând poate fi inclus sau exclus manual;
- face media întâi pe fiecare punct, apoi între puncte (pondere egală), iar valoarea de proiectare K se adoptă explicit de inginer, cu justificare în raport;
- fila **Test în trepte** calculează legea puțului s = B·Q + C·Q², un debit orientativ pentru testul principal (cu B corectat pentru durata testului), randamentul aparent și denivelarea la orice debit; dacă C ≤ 0, testul este marcat ca neinterpretabil;
- aplică opțional corecția Jacob pentru acvifer cu nivel liber;
- verifică automat condiția u < 0,05, consistența între metode și forma dreptei de revenire;
- generează raportul PDF (A4) cu datele lucrării, explicarea metodelor, formulele generale și formulele aplicate cu valori, graficele și anexele cu citirile;
- include procedura de execuție a testului în teren.

Totul rulează în browser; nimic nu este trimis pe un server, iar ultima sesiune rămâne salvată local.

## Publicare pe GitHub Pages

1. În repository: **Settings → Pages**.
2. La „Build and deployment”, alege **Source: Deploy from a branch**, apoi **Branch: `main`** și folderul **`/ (root)`** → **Save**.
3. După 1–2 minute site-ul este disponibil la `https://<utilizator>.github.io/<repository>/`.

## Structură

| Fișier | Rol |
|---|---|
| `index.html` | pagina site-ului (Calcul, Raport PDF, Procedură de teren) |
| `css/style.css`, `css/report.css` | aspectul site-ului și al raportului A4 (inclusiv tipărirea) |
| `js/models.js` | modelele Hantush-Jacob, de Glee și Boulton (K₀, inversare Stehfest, ajustare Nelder-Mead) |
| `js/calc.js` | calculele (funcția de puț W(u), regresie, ajustare Theis, Thiem) |
| `js/charts.js` | graficele (SVG pe site, imagine de înaltă rezoluție în raport) |
| `js/report.js` | construcția raportului, paginarea automată și exportul PDF |
| `js/app.js` | interfața și salvarea locală |
| `vendor/` | html2canvas 1.4.1 și jsPDF 2.5.1 (licențe MIT), incluse local |
| `fonts/` | Barlow, Barlow Condensed, JetBrains Mono (licență OFL), incluse local |

## Referințe

- SR EN ISO 22282-4:2012 — Încercări geohidraulice. Partea 4: Încercări de pompare.
- Kruseman, G.P., de Ridder, N.A. — *Analysis and Evaluation of Pumping Test Data*, ed. a 2-a, ILRI Publication 47, 1990.
- Hantush, M.S., Jacob, C.E. — *Non-steady radial flow in an infinite leaky aquifer*, Trans. AGU 36, 1955.
- Boulton, N.S. — *Analysis of data from non-equilibrium pumping tests allowing for delayed yield from storage*, Proc. ICE 26, 1963.
- Neuman, S.P. — *Analysis of pumping test data from anisotropic unconfined aquifers considering delayed gravity response*, WRR 11(2), 1975.
- Stehfest, H. — *Numerical inversion of Laplace transforms*, Comm. ACM 13(1), 1970.
