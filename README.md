# Vaterpolo trener

Offline veb aplikacija (PWA) za vaterpolo trenera koji radi u više klubova i ekipa: igrači, evidencija treninga i dolazaka, statistika utakmica uživo sa zapisnikom, raspored, tabla za taktiku, testovi napretka, članarine i rezervna kopija.
Svi podaci se čuvaju samo u telefonu.

## Postavljanje na GitHub Pages
1. Napravi javni repozitorijum (npr. `vaterpolo`) i ubaci sve fajlove iz ovog foldera.
2. Settings → Pages → Source: *Deploy from a branch* → Branch: `main`, folder `/ (root)` → Save.
3. Posle minut-dva aplikacija je na `https://<korisničko-ime>.github.io/vaterpolo/`.

## Instalacija na iPhone
Otvori adresu u Safariju → dugme Deli → **Dodaj na početni ekran**.

## Izmene
Posle svake izmene fajlova povećaj `VERZIJA` u `sw.js` (npr. `vaterpolo-v2`), da bi telefon preuzeo novu verziju.

## Struktura
- `index.html` – svi ekrani i dijalozi
- `style.css` – izgled
- `js/osnova.js` – baza (IndexedDB), pomoćne funkcije, navigacija
- `js/igraci.js` – igrači, trening, dolasci
- `js/utakmice.js` – utakmice i zapisnik
- `js/raspored.js` – raspored
- `js/taktika.js` – tabla za taktiku
- `js/testovi.js` – testovi i članarine
- `js/podesavanja.js` – klubovi, ekipe i liste koje trener sam menja
- `js/kopija.js` – rezervna kopija, ekran „Više“
- `js/start.js` – pokretanje
- `sw.js` – rad bez interneta
