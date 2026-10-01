'use strict';
/* =========================================================
   OSNOVA: baza, pomoćne funkcije, navigacija
   ========================================================= */

/* ---------- Baza (IndexedDB) ---------- */
const DB_IME = 'vaterpolo';
const DB_VERZIJA = 2;
// Sve tabele (store) i njihovi ključevi
const TABELE = {
  igraci: 'id',
  treninzi: 'datum',
  utakmice: 'id',
  raspored: 'id',
  taktike: 'id',
  testovi: 'id',
  clanarine: 'kljuc',
  meta: 'kljuc',
};
let db;

function otvoriBazu() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_IME, DB_VERZIJA);
    req.onupgradeneeded = () => {
      const d = req.result;
      for (const [ime, kljuc] of Object.entries(TABELE)) {
        if (!d.objectStoreNames.contains(ime)) d.createObjectStore(ime, { keyPath: kljuc });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(store, mode, fn) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    let rezultat;
    t.oncomplete = () => resolve(rezultat);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
    const stores = Array.isArray(store) ? store.map(s => t.objectStore(s)) : t.objectStore(store);
    const r = fn(stores);
    if (r && 'onsuccess' in r) r.onsuccess = () => { rezultat = r.result; };
  });
}

const sve = store => tx(store, 'readonly', s => s.getAll());
const uzmi = (store, kljuc) => tx(store, 'readonly', s => s.get(kljuc));
const sacuvaj = (store, obj) => tx(store, 'readwrite', s => s.put(obj));
const obrisi = (store, kljuc) => tx(store, 'readwrite', s => s.delete(kljuc));

async function uzmiPodesavanje(kljuc, podrazumevano) {
  const m = await uzmi('meta', kljuc);
  return m ? m.vrednost : podrazumevano;
}
const sacuvajPodesavanje = (kljuc, vrednost) => sacuvaj('meta', { kljuc, vrednost });

/* ---------- Pomoćne ---------- */
const $ = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);

function danasISO(d = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function izISO(s) { const [g, m, d] = s.split('-').map(Number); return new Date(g, m - 1, d); }
function pomeriDan(iso, n) { const d = izISO(iso); d.setDate(d.getDate() + n); return danasISO(d); }

const DANI = ['nedelja', 'ponedeljak', 'utorak', 'sreda', 'četvrtak', 'petak', 'subota'];
const DANI_KRATKO = ['ned', 'pon', 'uto', 'sre', 'čet', 'pet', 'sub'];
const MESECI = ['januar', 'februar', 'mart', 'april', 'maj', 'jun', 'jul', 'avgust', 'septembar', 'oktobar', 'novembar', 'decembar'];
const MESECI_KRATKO = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'avg', 'sep', 'okt', 'nov', 'dec'];

function lepDatum(iso) {
  const d = izISO(iso);
  return `${DANI[d.getDay()]}, ${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}.`;
}
function kratakDatum(iso) { const d = izISO(iso); return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}.`; }

function pocetakSezone(d = new Date()) {
  const godina = d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1;
  return `${godina}-09-01`;
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function noviId() {
  return crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
}

let porukaTajmer;
function poruka(tekst, trajanje = 2200) {
  const el = $('#poruka');
  el.textContent = tekst;
  el.classList.add('vidljiva');
  clearTimeout(porukaTajmer);
  porukaTajmer = setTimeout(() => el.classList.remove('vidljiva'), trajanje);
}

function sortirajIgrace(lista) {
  return lista.sort((a, b) => {
    const ka = a.kapa ? Number(a.kapa) : 999, kb = b.kapa ? Number(b.kapa) : 999;
    return ka - kb || a.ime.localeCompare(b.ime, 'sr');
  });
}

function kapaHTML(p) {
  if (!p) return '<div class="kapa prazna">?</div>';
  const kl = p.pozicija === 'Golman' ? 'kapa golman' : p.kapa ? 'kapa' : 'kapa prazna';
  return `<div class="${kl}">${p.kapa ? esc(p.kapa) : '–'}</div>`;
}

function prezime(p) {
  if (!p) return 'obrisan';
  const delovi = p.ime.trim().split(/\s+/);
  return delovi.length > 1 ? delovi.slice(1).join(' ') : delovi[0];
}

async function podeliTekst(naslov, tekst) {
  if (navigator.share) {
    try { await navigator.share({ title: naslov, text: tekst }); return; }
    catch (e) { if (e.name === 'AbortError') return; }
  }
  try { await navigator.clipboard.writeText(tekst); poruka('Kopirano – nalepi gde želiš'); }
  catch { alert(tekst); }
}

/* ---------- Navigacija ---------- */
// Svaki ekran se prijavi ovde: { naslov, roditelj (za dugme nazad), prikazi() }
const EKRANI = {};
let trenutniEkran = 'igraci';

function idiNa(ekran) {
  const e = EKRANI[ekran];
  trenutniEkran = ekran;
  $$('.ekran').forEach(s => s.classList.toggle('aktivan', s.id === ekran));
  const tab = e.roditelj || ekran;
  $$('nav.dole button').forEach(b => b.classList.toggle('aktivan', b.dataset.ekran === tab));
  $('#naslov').textContent = typeof e.naslov === 'function' ? e.naslov() : e.naslov;
  $('#nazad').hidden = !e.roditelj;
  window.scrollTo(0, 0);
  if (e.prikazi) e.prikazi();
}

function postaviNaslov(tekst) { $('#naslov').textContent = tekst; }
