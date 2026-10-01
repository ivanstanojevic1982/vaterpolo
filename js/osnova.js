'use strict';
/* =========================================================
   OSNOVA: baza, pomoćne funkcije, navigacija
   ========================================================= */

/* ---------- Baza (IndexedDB) ---------- */
const DB_IME = 'vaterpolo';
const DB_VERZIJA = 4;
// Sve tabele (store) i njihovi ključevi
const TABELE = {
  klubovi: 'id',
  ekipe: 'id',
  igraci: 'id',
  treninzi: 'kljuc',     // "ekipaId|datum"
  utakmice: 'id',
  raspored: 'id',
  taktike: 'id',
  testovi: 'id',
  clanarine: 'kljuc',    // "igracId|mesec"
  beleske: 'id',
  meta: 'kljuc',
};
let db;

function otvoriBazu() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_IME, DB_VERZIJA);
    req.onupgradeneeded = e => {
      const d = req.result;
      // v1/v2 -> v3: treninzi dobijaju ključ "ekipaId|datum".
      // Ekipa se dodeljuje kasnije u popraviPodatke().
      if (e.oldVersion > 0 && e.oldVersion < 3 && d.objectStoreNames.contains('treninzi')) {
        req.transaction.objectStore('treninzi').getAll().onsuccess = ev => {
          const stari = ev.target.result;
          d.deleteObjectStore('treninzi');
          const novi = d.createObjectStore('treninzi', { keyPath: 'kljuc' });
          stari.forEach(t => novi.put({ ...t, ekipaId: null, kljuc: 'bez|' + t.datum }));
        };
      }
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

/* =========================================================
   KLUBOVI I EKIPE
   ========================================================= */
let EKIPA = null;          // izabrana ekipa { id, klubId, naziv }
let KLUB = null;           // klub izabrane ekipe { id, naziv, boja }
let sviKlubovi = [], sveEkipe = [];

const BOJE_KLUBOVA = ['#0b2e4f', '#c8372d', '#1f9d55', '#b8860b', '#6a3fb5', '#0e7c86', '#d2691e'];

async function ucitajKluboveIEkipe() {
  sviKlubovi = (await sve('klubovi')).sort((a, b) => (a.redosled ?? 0) - (b.redosled ?? 0) || a.naziv.localeCompare(b.naziv, 'sr'));
  sveEkipe = (await sve('ekipe')).sort((a, b) => (a.redosled ?? 0) - (b.redosled ?? 0) || a.naziv.localeCompare(b.naziv, 'sr'));
  const aktivna = await uzmiPodesavanje('aktivnaEkipa', null);
  EKIPA = sveEkipe.find(e => e.id === aktivna) || sveEkipe[0] || null;
  KLUB = EKIPA ? sviKlubovi.find(k => k.id === EKIPA.klubId) : null;
  osveziIzborEkipe();
}

const klubEkipe = e => sviKlubovi.find(k => k.id === e?.klubId);
const nazivEkipe = (e, kratko) => {
  if (!e) return 'Opšte';
  const k = klubEkipe(e);
  return kratko || !k ? e.naziv : `${k.naziv} · ${e.naziv}`;
};
const bojaEkipe = e => klubEkipe(e)?.boja || '#6b7d8f';

async function izaberiEkipu(id) {
  await sacuvajPodesavanje('aktivnaEkipa', id);
  await ucitajKluboveIEkipe();
  utakmica = null;   // otvorena utakmica pripada staroj ekipi
  const glavni = ['igraci', 'trening', 'utakmice', 'raspored', 'vise'];
  const e = EKRANI[trenutniEkran];
  idiNa(trenutniEkran === 'utakmica' ? 'utakmice' : glavni.includes(trenutniEkran) || e?.roditelj ? trenutniEkran : 'igraci');
  poruka(`Ekipa: ${nazivEkipe(EKIPA)}`);
}

// Igrači izabrane ekipe
async function igraciEkipe(ekipaId = EKIPA?.id) {
  return sortirajIgrace((await sve('igraci')).filter(p => (p.ekipe || []).includes(ekipaId)));
}

const kljucTreninga = (datum, ekipaId = EKIPA?.id) => `${ekipaId}|${datum}`;
async function treninziEkipe(ekipaId = EKIPA?.id) {
  return (await sve('treninzi')).filter(t => t.ekipaId === ekipaId);
}

function osveziIzborEkipe() {
  const dugme = $('#izborEkipe');
  if (!dugme) return;
  dugme.innerHTML = EKIPA
    ? `<i style="background:${esc(bojaEkipe(EKIPA))}"></i>${esc(nazivEkipe(EKIPA))} ▾`
    : 'Izaberi ekipu ▾';
}

function otvoriIzborEkipe() {
  $('#listaEkipaIzbor').innerHTML = sviKlubovi.map(k => {
    const ekipe = sveEkipe.filter(e => e.klubId === k.id);
    return `<li class="klub-naslov"><i style="background:${esc(k.boja)}"></i>${esc(k.naziv)}</li>` +
      (ekipe.map(e => `<li data-id="${esc(e.id)}" class="${e.id === EKIPA?.id ? 'tu' : ''}">
        <div class="detalji"><div class="ime">${esc(e.naziv)}</div></div>
        <div class="kvacica">${e.id === EKIPA?.id ? '✓' : ''}</div></li>`).join('') ||
        '<li class="bledo"><div class="detalji opis">nema ekipa</div></li>');
  }).join('');
  $('#dlgEkipe').showModal();
}

/* Prevodi stare podatke (v1/v2, ili stara kopija) u oblik sa ekipama.
   Sve što nema ekipu ide u prvu ekipu. */
async function popraviPodatke() {
  let ekipe = await sve('ekipe');
  if (!ekipe.length) {
    let klub = (await sve('klubovi'))[0];
    if (!klub) { klub = { id: noviId(), naziv: 'Moj klub', boja: BOJE_KLUBOVA[0], redosled: 0 }; await sacuvaj('klubovi', klub); }
    await sacuvaj('ekipe', { id: noviId(), klubId: klub.id, naziv: 'Prva ekipa', redosled: 0 });
    ekipe = await sve('ekipe');
  }
  const prva = ekipe.sort((a, b) => (a.redosled ?? 0) - (b.redosled ?? 0))[0].id;

  for (const p of await sve('igraci')) {
    if (!Array.isArray(p.ekipe)) { p.ekipe = [prva]; await sacuvaj('igraci', p); }
  }
  for (const t of await sve('treninzi')) {
    if (!t.ekipaId) {
      await obrisi('treninzi', t.kljuc);
      await sacuvaj('treninzi', { ...t, ekipaId: prva, kljuc: `${prva}|${t.datum}` });
    }
  }
  for (const u of await sve('utakmice')) {
    if (!u.ekipaId) { u.ekipaId = prva; await sacuvaj('utakmice', u); }
  }
  for (const r of await sve('raspored')) {
    if (!('ekipaId' in r)) { r.ekipaId = prva; await sacuvaj('raspored', r); }
  }
  const staraClanarina = await uzmi('meta', 'clanarinaIznos');
  if (staraClanarina) {
    await sacuvajPodesavanje(`clanarinaIznos|${prva}`, staraClanarina.vrednost);
    await obrisi('meta', 'clanarinaIznos');
  }
}

/* =========================================================
   PODEŠAVANJA (liste koje trener sam menja)
   ========================================================= */
const PODRAZUMEVANO = {
  pozicije: ['Golman', 'Centar', 'Bek', 'Krilo', 'Spoljni'],
  vrsteTestova: [
    { id: '50sl',   naziv: '50 m slobodno',  jed: 'vreme', smer: 'manje' },
    { id: '100sl',  naziv: '100 m slobodno', jed: 'vreme', smer: 'manje' },
    { id: '200sl',  naziv: '200 m slobodno', jed: 'vreme', smer: 'manje' },
    { id: '400sl',  naziv: '400 m slobodno', jed: 'vreme', smer: 'manje' },
    { id: '25lop',  naziv: '25 m sa loptom', jed: 'vreme', smer: 'manje' },
    { id: 'visina', naziv: 'Visina',         jed: 'cm',    smer: 'vise' },
    { id: 'tezina', naziv: 'Težina',         jed: 'kg',    smer: 'nema' },
  ],
  tipoviDogadjaja: [
    { naziv: 'Trening',  boja: '#0b2e4f' },
    { naziv: 'Utakmica', boja: '#c8372d' },
    { naziv: 'Turnir',   boja: '#b8860b' },
    { naziv: 'Ostalo',   boja: '#6b7d8f' },
  ],
  maxFaulova: 3,
  skriveneAkcije: [],
};
const PODESAVANJA = structuredClone(PODRAZUMEVANO);

async function ucitajPodesavanja() {
  for (const k of Object.keys(PODRAZUMEVANO)) {
    PODESAVANJA[k] = await uzmiPodesavanje('p:' + k, structuredClone(PODRAZUMEVANO[k]));
  }
}
async function sacuvajListu(k, vrednost) {
  PODESAVANJA[k] = vrednost;
  await sacuvajPodesavanje('p:' + k, vrednost);
}

/* ---------- Opšti dijalog za unos ----------
   pitaj({ naslov, polja: [{ ime, label, tip, vrednost, opcije }], obrisi: 'tekst dugmeta' })
   vraća objekat sa vrednostima, 'obrisi' ili null (odustao) */
function pitaj({ naslov, polja, obrisi: tekstObrisi, opis }) {
  return new Promise(resolve => {
    const dlg = $('#dlgPitaj');
    $('#pitajNaslov').textContent = naslov;
    $('#pitajOpis').textContent = opis || '';
    $('#pitajOpis').hidden = !opis;
    $('#pitajPolja').innerHTML = polja.map(p => {
      const v = esc(p.vrednost ?? '');
      if (p.tip === 'select') {
        return `<label>${esc(p.label)}<select name="${p.ime}">${p.opcije.map(o =>
          `<option value="${esc(o.vrednost)}" ${String(o.vrednost) === String(p.vrednost) ? 'selected' : ''}>${esc(o.naziv)}</option>`).join('')}</select></label>`;
      }
      if (p.tip === 'color') {
        return `<label>${esc(p.label)}<div class="boje">${BOJE_KLUBOVA.map(b =>
          `<button type="button" class="boja ${b === p.vrednost ? 'izabrana' : ''}" data-boja="${b}" style="background:${b}"></button>`).join('')}
          <input type="color" name="${p.ime}" value="${v || BOJE_KLUBOVA[0]}"></div></label>`;
      }
      return `<label>${esc(p.label)}<input name="${p.ime}" type="${p.tip || 'text'}" value="${v}" ${p.obavezno ? 'required' : ''} autocomplete="off" ${p.tip === 'number' ? 'inputmode="numeric"' : ''}></label>`;
    }).join('');
    $('#pitajObrisi').hidden = !tekstObrisi;
    $('#pitajObrisi').textContent = tekstObrisi || '';

    const forma = $('#formaPitaj');
    const zavrsi = rez => {
      forma.onsubmit = null; $('#pitajObrisi').onclick = null; $('#pitajOdustani').onclick = null; dlg.onclose = null;
      dlg.close(); resolve(rez);
    };
    forma.onsubmit = e => {
      e.preventDefault();
      const rez = {};
      for (const p of polja) rez[p.ime] = forma.elements[p.ime].value.trim?.() ?? forma.elements[p.ime].value;
      if (polja.some(p => p.obavezno && !rez[p.ime])) return;
      zavrsi(rez);
    };
    $('#pitajObrisi').onclick = () => zavrsi('obrisi');
    $('#pitajOdustani').onclick = () => zavrsi(null);
    dlg.onclose = () => resolve(null);
    $('#pitajPolja').onclick = e => {
      const b = e.target.closest('.boja'); if (!b) return;
      $$('#pitajPolja .boja').forEach(x => x.classList.toggle('izabrana', x === b));
      b.parentElement.querySelector('input[type=color]').value = b.dataset.boja;
    };
    dlg.showModal();
    setTimeout(() => forma.querySelector('input:not([type=color])')?.focus(), 50);
  });
}
