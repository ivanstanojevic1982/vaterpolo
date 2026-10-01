'use strict';

/* ============ Baza (IndexedDB) ============ */
const DB_IME = 'vaterpolo';
const DB_VERZIJA = 1;
let db;

function otvoriBazu() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_IME, DB_VERZIJA);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains('igraci')) d.createObjectStore('igraci', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('treninzi')) d.createObjectStore('treninzi', { keyPath: 'datum' });
      if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta', { keyPath: 'kljuc' });
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

/* ============ Pomoćne ============ */
const $ = sel => document.querySelector(sel);

function danasISO(d = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function izISO(s) { const [g, m, d] = s.split('-').map(Number); return new Date(g, m - 1, d); }
function pomeriDan(iso, n) { const d = izISO(iso); d.setDate(d.getDate() + n); return danasISO(d); }

const DANI = ['nedelja', 'ponedeljak', 'utorak', 'sreda', 'četvrtak', 'petak', 'subota'];
function lepDatum(iso) {
  const d = izISO(iso);
  return `${DANI[d.getDay()]}, ${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}.`;
}
function kratakDatum(iso) { const d = izISO(iso); return `${d.getDate()}.${d.getMonth() + 1}.`; }

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function noviId() {
  return (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
}

let porukaTajmer;
function poruka(tekst) {
  const el = $('#poruka');
  el.textContent = tekst;
  el.classList.add('vidljiva');
  clearTimeout(porukaTajmer);
  porukaTajmer = setTimeout(() => el.classList.remove('vidljiva'), 2200);
}

function sortirajIgrace(lista) {
  return lista.sort((a, b) => {
    const ka = a.kapa ? Number(a.kapa) : 999, kb = b.kapa ? Number(b.kapa) : 999;
    return ka - kb || a.ime.localeCompare(b.ime, 'sr');
  });
}

function kapaHTML(p) {
  const kl = p.pozicija === 'Golman' ? 'kapa golman' : p.kapa ? 'kapa' : 'kapa prazna';
  return `<div class="${kl}">${p.kapa ? esc(p.kapa) : '–'}</div>`;
}

/* ============ Navigacija ============ */
const NASLOVI = { igraci: 'Igrači', trening: 'Trening', dolasci: 'Dolasci', kopija: 'Rezervna kopija' };

function idiNa(ekran) {
  document.querySelectorAll('.ekran').forEach(e => e.classList.toggle('aktivan', e.id === ekran));
  document.querySelectorAll('nav.dole button').forEach(b => b.classList.toggle('aktivan', b.dataset.ekran === ekran));
  $('#naslov').textContent = NASLOVI[ekran];
  window.scrollTo(0, 0);
  osvezi(ekran);
}

function osvezi(ekran) {
  if (ekran === 'igraci') return prikaziIgrace();
  if (ekran === 'trening') return prikaziTrening();
  if (ekran === 'dolasci') return prikaziDolaske();
  if (ekran === 'kopija') return prikaziKopiju();
}

/* ============ Igrači ============ */
async function prikaziIgrace() {
  const igraci = sortirajIgrace(await sve('igraci'));
  $('#nemaIgraca').hidden = igraci.length > 0;
  $('#listaIgraca').innerHTML = igraci.map(p => {
    const opis = [p.pozicija, p.godiste && `${p.godiste}. god.`].filter(Boolean).join(' · ');
    return `<li data-id="${esc(p.id)}">
      ${kapaHTML(p)}
      <div class="detalji"><div class="ime">${esc(p.ime)}</div>${opis ? `<div class="opis">${esc(opis)}</div>` : ''}</div>
      <div class="desno">›</div>
    </li>`;
  }).join('');
}

let izmenaId = null;

async function otvoriFormu(id) {
  const forma = $('#formaIgrac');
  forma.reset();
  izmenaId = id || null;
  $('#dlgNaslov').textContent = id ? 'Izmeni igrača' : 'Novi igrač';
  $('#obrisiIgraca').hidden = !id;
  if (id) {
    const p = await uzmi('igraci', id);
    for (const polje of ['ime', 'godiste', 'kapa', 'pozicija', 'telefon', 'napomena']) {
      forma.elements[polje].value = p[polje] ?? '';
    }
  }
  $('#dlgIgrac').showModal();
}

async function sacuvajIgraca(e) {
  e.preventDefault();
  const f = $('#formaIgrac').elements;
  const ime = f.ime.value.trim();
  if (!ime) { f.ime.focus(); return; }

  const postojeci = izmenaId ? await uzmi('igraci', izmenaId) : null;
  const igrac = {
    id: izmenaId || noviId(),
    ime,
    godiste: f.godiste.value || '',
    kapa: f.kapa.value || '',
    pozicija: f.pozicija.value,
    telefon: f.telefon.value.trim(),
    napomena: f.napomena.value.trim(),
    dodat: postojeci?.dodat || danasISO(),
  };

  if (igrac.kapa) {
    const isti = (await sve('igraci')).find(p => p.kapa === igrac.kapa && p.id !== igrac.id);
    if (isti && !confirm(`Kapu ${igrac.kapa} već nosi ${isti.ime}. Sačuvati svejedno?`)) return;
  }

  await sacuvaj('igraci', igrac);
  $('#dlgIgrac').close();
  poruka(izmenaId ? 'Izmene sačuvane' : 'Igrač dodat');
  prikaziIgrace();
}

async function obrisiIgraca() {
  const p = await uzmi('igraci', izmenaId);
  if (!confirm(`Obrisati igrača ${p.ime}? Biće uklonjen i iz evidencije treninga.`)) return;
  await obrisi('igraci', izmenaId);
  const treninzi = await sve('treninzi');
  for (const t of treninzi) {
    if (t.prisutni.includes(izmenaId)) {
      t.prisutni = t.prisutni.filter(x => x !== izmenaId);
      await sacuvaj('treninzi', t);
    }
  }
  $('#dlgIgrac').close();
  poruka('Igrač obrisan');
  prikaziIgrace();
}

/* ============ Trening ============ */
let trenutniDatum = danasISO();

async function prikaziTrening() {
  $('#datumTreninga').value = trenutniDatum;
  const [igraci, trening] = await Promise.all([sve('igraci'), uzmi('treninzi', trenutniDatum)]);
  sortirajIgrace(igraci);
  const prisutni = new Set(trening?.prisutni || []);

  $('#nemaZaTrening').hidden = igraci.length > 0;
  $('#treningDugmad').hidden = igraci.length === 0;
  $('#obrisiTrening').hidden = !trening;

  const dan = lepDatum(trenutniDatum);
  $('#treningInfo').textContent = trening
    ? `${dan} — prisutno ${prisutni.size} od ${igraci.length}`
    : `${dan} — trening nije upisan. Dodirni igrače koji su došli.`;

  $('#listaPrisutnih').innerHTML = igraci.map(p => `
    <li data-id="${esc(p.id)}" class="${prisutni.has(p.id) ? 'tu' : ''}">
      ${kapaHTML(p)}
      <div class="detalji"><div class="ime">${esc(p.ime)}</div></div>
      <div class="kvacica">${prisutni.has(p.id) ? '✓' : ''}</div>
    </li>`).join('');
}

async function prebaciPrisustvo(id) {
  const t = (await uzmi('treninzi', trenutniDatum)) || { datum: trenutniDatum, prisutni: [] };
  t.prisutni = t.prisutni.includes(id) ? t.prisutni.filter(x => x !== id) : [...t.prisutni, id];
  await sacuvaj('treninzi', t);
  prikaziTrening();
}

async function sviPrisutni() {
  const igraci = await sve('igraci');
  await sacuvaj('treninzi', { datum: trenutniDatum, prisutni: igraci.map(p => p.id) });
  prikaziTrening();
}

async function obrisiTrening() {
  if (!confirm(`Obrisati trening za ${lepDatum(trenutniDatum)}?`)) return;
  await obrisi('treninzi', trenutniDatum);
  poruka('Trening obrisan');
  prikaziTrening();
}

/* ============ Dolasci ============ */
function pocetakPerioda(vrednost) {
  if (vrednost === 'sve') return '0000-00-00';
  if (vrednost === 'sezona') {
    const d = new Date();
    const godina = d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1;
    return `${godina}-09-01`;
  }
  return pomeriDan(danasISO(), -Number(vrednost));
}

async function prikaziDolaske() {
  const od = pocetakPerioda($('#period').value);
  const [igraci, sviTreninzi] = await Promise.all([sve('igraci'), sve('treninzi')]);
  const treninzi = sviTreninzi.filter(t => t.datum >= od).sort((a, b) => b.datum.localeCompare(a.datum));

  $('#dolasciInfo').textContent = treninzi.length
    ? `Treninga u periodu: ${treninzi.length}`
    : 'Nema upisanih treninga u ovom periodu.';

  const redovi = igraci.map(p => {
    // Računaju se treninzi od kad je igrač u ekipi: od dana dodavanja,
    // ili od ranijeg treninga na kom je bio (ako su stari treninzi upisani naknadno)
    const prviDolazak = sviTreninzi.filter(t => t.prisutni.includes(p.id)).map(t => t.datum).sort()[0];
    const odKad = [p.dodat, prviDolazak].filter(Boolean).sort()[0] || '0000';
    const moguci = treninzi.filter(t => t.datum >= odKad);
    const bio = moguci.filter(t => t.prisutni.includes(p.id)).length;
    const pct = moguci.length ? Math.round((bio / moguci.length) * 100) : null;
    return { p, bio, ukupno: moguci.length, pct };
  }).sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1) || a.p.ime.localeCompare(b.p.ime, 'sr'));

  $('#listaDolazaka').innerHTML = treninzi.length ? redovi.map(({ p, bio, ukupno, pct }) => {
    const nivo = pct === null ? '' : pct >= 75 ? '' : pct >= 50 ? 'srednje' : 'nisko';
    return `<li>
      ${kapaHTML(p)}
      <div class="detalji">
        <div class="ime">${esc(p.ime)}</div>
        <div class="opis">${ukupno ? `${bio} od ${ukupno} treninga` : 'nema treninga od dodavanja'}</div>
        <div class="traka ${nivo}"><div style="width:${pct ?? 0}%"></div></div>
      </div>
      <div class="procenat">${pct === null ? '–' : pct + '%'}</div>
    </li>`;
  }).join('') : '';

  $('#listaTreninga').innerHTML = treninzi.map(t => `
    <li data-datum="${t.datum}">
      <div class="detalji"><div class="ime">${esc(lepDatum(t.datum))}</div>
      <div class="opis">prisutno: ${t.prisutni.length}</div></div>
      <div class="desno">›</div>
    </li>`).join('');
}

/* ============ Rezervna kopija ============ */
async function prikaziKopiju() {
  const [igraci, treninzi, meta] = await Promise.all([sve('igraci'), sve('treninzi'), uzmi('meta', 'poslednjaKopija')]);
  $('#statistika').textContent = `U telefonu: ${igraci.length} igrača, ${treninzi.length} treninga.`;
  $('#poslednjaKopija').textContent = meta
    ? `Poslednja kopija: ${lepDatum(meta.vrednost)}`
    : 'Kopija još nije napravljena.';
}

async function izvezi() {
  const podaci = {
    aplikacija: 'vaterpolo-trener',
    verzija: 1,
    napravljeno: new Date().toISOString(),
    igraci: await sve('igraci'),
    treninzi: await sve('treninzi'),
  };
  const ime = `vaterpolo-kopija-${danasISO()}.json`;
  const json = JSON.stringify(podaci, null, 1);
  const fajl = new File([json], ime, { type: 'application/json' });

  let uspeh = false;
  if (navigator.canShare && navigator.canShare({ files: [fajl] })) {
    try {
      await navigator.share({ files: [fajl], title: 'Vaterpolo – rezervna kopija' });
      uspeh = true;
    } catch (e) {
      if (e.name === 'AbortError') return; // korisnik odustao
    }
  }
  if (!uspeh) {
    const url = URL.createObjectURL(fajl);
    const a = document.createElement('a');
    a.href = url; a.download = ime;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
  await sacuvaj('meta', { kljuc: 'poslednjaKopija', vrednost: danasISO() });
  poruka('Kopija napravljena');
  prikaziKopiju();
}

async function uvezi(e) {
  const fajl = e.target.files[0];
  e.target.value = '';
  if (!fajl) return;
  let podaci;
  try {
    podaci = JSON.parse(await fajl.text());
    if (podaci.aplikacija !== 'vaterpolo-trener' || !Array.isArray(podaci.igraci) || !Array.isArray(podaci.treninzi)) throw 0;
  } catch {
    alert('Ovo nije ispravan fajl rezervne kopije.');
    return;
  }
  const kad = podaci.napravljeno ? lepDatum(danasISO(new Date(podaci.napravljeno))) : 'nepoznato';
  if (!confirm(`Kopija od ${kad}: ${podaci.igraci.length} igrača, ${podaci.treninzi.length} treninga.\n\nTrenutni podaci biće ZAMENJENI. Nastaviti?`)) return;

  await tx(['igraci', 'treninzi'], 'readwrite', ([si, st]) => {
    si.clear(); st.clear();
    podaci.igraci.forEach(p => si.put(p));
    podaci.treninzi.forEach(t => st.put(t));
  });
  poruka('Podaci vraćeni iz kopije');
  prikaziKopiju();
}

/* ============ Pokretanje ============ */
async function start() {
  try {
    db = await otvoriBazu();
  } catch (e) {
    document.body.innerHTML = '<p style="padding:20px">Baza ne može da se otvori. Ako koristiš privatni režim u Safariju, isključi ga.</p>';
    return;
  }

  // Zamoli pretraživač da ne briše podatke
  if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});

  document.querySelectorAll('nav.dole button').forEach(b => b.addEventListener('click', () => idiNa(b.dataset.ekran)));

  $('#dodajIgraca').addEventListener('click', () => otvoriFormu());
  $('#listaIgraca').addEventListener('click', e => { const li = e.target.closest('li'); if (li) otvoriFormu(li.dataset.id); });
  $('#formaIgrac').addEventListener('submit', sacuvajIgraca);
  $('#odustani').addEventListener('click', () => $('#dlgIgrac').close());
  $('#obrisiIgraca').addEventListener('click', obrisiIgraca);

  $('#datumTreninga').addEventListener('change', e => { if (e.target.value) { trenutniDatum = e.target.value; prikaziTrening(); } });
  $('#danNazad').addEventListener('click', () => { trenutniDatum = pomeriDan(trenutniDatum, -1); prikaziTrening(); });
  $('#danNapred').addEventListener('click', () => { trenutniDatum = pomeriDan(trenutniDatum, 1); prikaziTrening(); });
  $('#listaPrisutnih').addEventListener('click', e => { const li = e.target.closest('li'); if (li) prebaciPrisustvo(li.dataset.id); });
  $('#sviPrisutni').addEventListener('click', sviPrisutni);
  $('#obrisiTrening').addEventListener('click', obrisiTrening);

  $('#period').addEventListener('change', prikaziDolaske);
  $('#listaTreninga').addEventListener('click', e => {
    const li = e.target.closest('li');
    if (li) { trenutniDatum = li.dataset.datum; idiNa('trening'); }
  });

  $('#izvoz').addEventListener('click', izvezi);
  $('#uvozFajl').addEventListener('change', uvezi);

  prikaziIgrace();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

start();
