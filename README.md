# Teste de pompare

Site static pentru interpretarea testelor de pompare și generarea raportului tehnic în PDF.

**Ce face**
- citirile se trec direct în site, într-un tabel cu câmpuri (timp + nivel), pentru **1, 2 sau 3 puncte de măsură** (piezometre sau puțul pompat), separat pentru pompare și revenire; se poate lipi și din Excel;
- calculează transmisivitatea T, coeficientul de înmagazinare S și permeabilitatea K = T/b pentru fiecare punct prin Cooper-Jacob (cu alegerea automată a intervalului din condiția u < 0,05), Theis (ajustare automată prin cele mai mici pătrate) și revenire (Theis-Jacob); cu două sau trei piezometre adaugă metoda distanță–denivelare (Thiem, respectiv Dupuit-Thiem la nivel liber);
- verifică automat fiecare rezultat (u < 0,05, alinierea punctelor, revenirea la zero) și scoate din medie rezultatele care nu trec verificarea; orice rând poate fi inclus sau exclus manual;
- fila **Test în trepte** calculează legea puțului s = B·Q + C·Q², debitul maxim pentru testul principal, randamentul puțului și denivelarea la orice debit;
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
| `js/calc.js` | calculele (funcția de puț W(u), regresie, ajustare Theis, Thiem) |
| `js/charts.js` | graficele (SVG pe site, imagine de înaltă rezoluție în raport) |
| `js/report.js` | construcția raportului, paginarea automată și exportul PDF |
| `js/app.js` | interfața și salvarea locală |
| `vendor/` | html2canvas 1.4.1 și jsPDF 2.5.1 (licențe MIT), incluse local |
| `fonts/` | Barlow, Barlow Condensed, JetBrains Mono (licență OFL), incluse local |

## Referințe

- SR EN ISO 22282-4:2012 — Încercări geohidraulice. Partea 4: Încercări de pompare.
- Kruseman, G.P., de Ridder, N.A. — *Analysis and Evaluation of Pumping Test Data*, ed. a 2-a, ILRI Publication 47, 1990.
