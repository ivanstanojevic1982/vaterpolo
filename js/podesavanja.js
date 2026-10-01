'use strict';
/* =========================================================
   PODEŠAVANJA: klubovi, ekipe i liste koje trener sam menja
   ========================================================= */
EKRANI.podesavanja = { naslov: 'Podešavanja', roditelj: 'vise', prikazi: prikaziPodesavanja };

const JEDINICE = [
  { vrednost: 'vreme', naziv: 'vreme (sekunde / min:s)' },
  { vrednost: 'cm', naziv: 'cm' },
  { vrednost: 'kg', naziv: 'kg' },
  { vrednost: 'm', naziv: 'metri' },
  { vrednost: 'pon.', naziv: 'broj ponavljanja' },
  { vrednost: 'bod.', naziv: 'bodovi' },
];
const SMEROVI = [
  { vrednost: 'manje', naziv: 'manje je bolje (npr. vreme)' },
  { vrednost: 'vise', naziv: 'više je bolje' },
  { vrednost: 'nema', naziv: 'bez ocene (npr. težina)' },
];

async function prikaziPodesavanja() {
  // Klubovi i ekipe
  $('#pKlubovi').innerHTML = sviKlubovi.map(k => {
    const ekipe = sveEkipe.filter(e => e.klubId === k.id);
    return `<li class="p-klub" data-klub="${esc(k.id)}">
        <i class="tacka" style="background:${esc(k.boja)}"></i>
        <div class="detalji"><div class="ime">${esc(k.naziv)}</div><div class="opis">${ekipe.length} ${ekipe.length === 1 ? 'ekipa' : 'ekipe'}</div></div>
        <div class="desno">✎</div>
      </li>` +
      ekipe.map(e => `<li class="p-ekipa" data-ekipa="${esc(e.id)}">
        <div class="detalji"><div class="ime">${esc(e.naziv)}${e.id === EKIPA?.id ? ' <span class="znacka">izabrana</span>' : ''}</div></div>
        <div class="desno">✎</div></li>`).join('') +
      `<li class="p-ekipa p-dodaj" data-nova-ekipa="${esc(k.id)}"><div class="detalji"><div class="ime">+ Dodaj ekipu u ${esc(k.naziv)}</div></div></li>`;
  }).join('');

  // Pozicije
  $('#pPozicije').innerHTML = PODESAVANJA.pozicije.map((p, i) =>
    `<button class="cip ${p === 'Golman' ? 'stalno' : ''}" data-i="${i}">${esc(p)}${p === 'Golman' ? '' : ' ✎'}</button>`).join('');

  // Testovi
  $('#pTestovi').innerHTML = PODESAVANJA.vrsteTestova.map(v => `<li data-id="${esc(v.id)}">
    <div class="detalji"><div class="ime">${esc(v.naziv)}</div>
    <div class="opis">${esc(v.jed === 'vreme' ? 'vreme' : v.jed)} · ${{ manje: 'manje je bolje', vise: 'više je bolje', nema: 'bez ocene' }[v.smer] || ''}</div></div>
    <div class="desno">✎</div></li>`).join('') || '<li class="bledo"><div class="detalji opis">nema vrsta testova</div></li>';

  // Vrste događaja
  $('#pTipovi').innerHTML = PODESAVANJA.tipoviDogadjaja.map((t, i) => `<li data-i="${i}">
    <i class="tacka velika" style="background:${esc(t.boja)}"></i>
    <div class="detalji"><div class="ime">${esc(t.naziv)}</div></div><div class="desno">✎</div></li>`).join('');

  // Utakmica
  $('#pMaxFaulova').value = String(PODESAVANJA.maxFaulova);
  $('#pAkcije').innerHTML = Object.entries(AKCIJE).filter(([t]) => t !== 'golProtivnika').map(([t, a]) =>
    `<label class="cek"><input type="checkbox" value="${t}" ${PODESAVANJA.skriveneAkcije.includes(t) ? '' : 'checked'} ${t === 'gol' ? 'disabled' : ''}> ${a.ikona} ${esc(a.naziv)}</label>`).join('');
}

async function osveziSve() {
  await ucitajKluboveIEkipe();
  await prikaziPodesavanja();
}

/* ---------- Klubovi ---------- */
async function urediKlub(id) {
  const k = id ? sviKlubovi.find(x => x.id === id) : null;
  const polja = [
    { ime: 'naziv', label: 'Naziv kluba', vrednost: k?.naziv, obavezno: true },
    { ime: 'boja', label: 'Boja kluba', tip: 'color', vrednost: k?.boja || BOJE_KLUBOVA[sviKlubovi.length % BOJE_KLUBOVA.length] },
  ];
  if (!k) polja.push({ ime: 'ekipa', label: 'Prva ekipa u klubu', vrednost: 'Seniori', obavezno: true });
  const r = await pitaj({ naslov: k ? 'Izmeni klub' : 'Novi klub', polja, obrisi: k ? 'Obriši klub' : null });
  if (!r) return;
  if (r === 'obrisi') return obrisiKlub(k);
  if (k) {
    await sacuvaj('klubovi', { ...k, naziv: r.naziv, boja: r.boja });
  } else {
    const novi = { id: noviId(), naziv: r.naziv, boja: r.boja, redosled: sviKlubovi.length };
    await sacuvaj('klubovi', novi);
    await sacuvaj('ekipe', { id: noviId(), klubId: novi.id, naziv: r.ekipa, redosled: 0 });
  }
  poruka('Sačuvano');
  osveziSve();
}

async function obrisiKlub(k) {
  const ekipe = sveEkipe.filter(e => e.klubId === k.id);
  if (ekipe.length === sveEkipe.length) return alert('Ovo je jedini klub. Prvo dodaj drugi klub, pa onda obriši ovaj.');
  if (!confirm(`Obrisati klub „${k.naziv}“ i sve njegove ekipe (${ekipe.map(e => e.naziv).join(', ') || 'nema'})?\n\nBrišu se i njihovi treninzi, utakmice i raspored.`)) return;
  if (ekipe.length && !confirm('Sigurno? Ovo ne može da se vrati (osim iz rezervne kopije).')) return;
  for (const e of ekipe) await obrisiEkipuPotpuno(e.id);
  await obrisi('klubovi', k.id);
  poruka('Klub obrisan');
  osveziSve();
}

/* ---------- Ekipe ---------- */
async function urediEkipu(id, klubId) {
  const e = id ? sveEkipe.find(x => x.id === id) : null;
  const polja = [
    { ime: 'naziv', label: 'Naziv ekipe', vrednost: e?.naziv, obavezno: true, },
    { ime: 'klubId', label: 'Klub', tip: 'select', vrednost: e?.klubId || klubId, opcije: sviKlubovi.map(k => ({ vrednost: k.id, naziv: k.naziv })) },
  ];
  const r = await pitaj({
    naslov: e ? 'Izmeni ekipu' : 'Nova ekipa',
    opis: e ? '' : 'npr. Pioniri, Kadeti, Juniori, Seniori, Škola vaterpola…',
    polja, obrisi: e ? 'Obriši ekipu' : null,
  });
  if (!r) return;
  if (r === 'obrisi') {
    if (sveEkipe.length === 1) return alert('Ovo je jedina ekipa. Prvo dodaj drugu.');
    const igraci = await igraciEkipe(e.id);
    const samoOvde = igraci.filter(p => p.ekipe.length === 1).length;
    if (!confirm(`Obrisati ekipu „${e.naziv}“?\n\nBrišu se njeni treninzi, utakmice i raspored.${samoOvde ? `\n${samoOvde} igrača koji igraju samo ovde biće obrisano.` : ''}`)) return;
    await obrisiEkipuPotpuno(e.id);
    poruka('Ekipa obrisana');
    return osveziSve();
  }
  if (e) await sacuvaj('ekipe', { ...e, naziv: r.naziv, klubId: r.klubId });
  else {
    const nova = { id: noviId(), klubId: r.klubId, naziv: r.naziv, redosled: sveEkipe.filter(x => x.klubId === r.klubId).length };
    await sacuvaj('ekipe', nova);
    if (confirm(`Ekipa „${nova.naziv}“ je dodata. Da li odmah da pređeš na nju?`)) {
      await sacuvajPodesavanje('aktivnaEkipa', nova.id);
    }
  }
  poruka('Sačuvano');
  osveziSve();
}

async function obrisiEkipuPotpuno(ekipaId) {
  for (const t of await sve('treninzi')) if (t.ekipaId === ekipaId) await obrisi('treninzi', t.kljuc);
  for (const u of await sve('utakmice')) if (u.ekipaId === ekipaId) await obrisi('utakmice', u.id);
  for (const r of await sve('raspored')) if (r.ekipaId === ekipaId) await obrisi('raspored', r.id);
  const testovi = await sve('testovi'), clanarine = await sve('clanarine');
  for (const p of await sve('igraci')) {
    if (!p.ekipe.includes(ekipaId)) continue;
    p.ekipe = p.ekipe.filter(x => x !== ekipaId);
    if (p.ekipe.length) { await sacuvaj('igraci', p); continue; }
    await obrisi('igraci', p.id);
    for (const t of testovi) if (t.igracId === p.id) await obrisi('testovi', t.id);
    for (const c of clanarine) if (c.igracId === p.id) await obrisi('clanarine', c.kljuc);
  }
  await obrisi('meta', `clanarinaIznos|${ekipaId}`);
  await obrisi('ekipe', ekipaId);
  if (EKIPA?.id === ekipaId) {
    const druga = (await sve('ekipe'))[0];
    if (druga) await sacuvajPodesavanje('aktivnaEkipa', druga.id);
  }
}

/* ---------- Pozicije ---------- */
async function urediPoziciju(i) {
  const stara = i == null ? null : PODESAVANJA.pozicije[i];
  if (stara === 'Golman') return poruka('Golman je stalna pozicija');
  const r = await pitaj({
    naslov: stara ? 'Izmeni poziciju' : 'Nova pozicija',
    polja: [{ ime: 'naziv', label: 'Naziv', vrednost: stara, obavezno: true }],
    obrisi: stara ? 'Obriši' : null,
  });
  if (!r) return;
  const lista = [...PODESAVANJA.pozicije];
  if (r === 'obrisi') lista.splice(i, 1);
  else if (stara) {
    if (r.naziv === 'Golman') return alert('Golman već postoji.');
    lista[i] = r.naziv;
    // Preimenuj i kod igrača
    for (const p of await sve('igraci')) if (p.pozicija === stara) { p.pozicija = r.naziv; await sacuvaj('igraci', p); }
  } else {
    if (lista.includes(r.naziv)) return alert('Ta pozicija već postoji.');
    lista.push(r.naziv);
  }
  await sacuvajListu('pozicije', lista);
  prikaziPodesavanja();
}

/* ---------- Vrste testova ---------- */
async function urediVrstuTesta(id) {
  const v = id ? PODESAVANJA.vrsteTestova.find(x => x.id === id) : null;
  const r = await pitaj({
    naslov: v ? 'Izmeni test' : 'Nova vrsta testa',
    opis: v ? '' : 'npr. 4 x 25 m sprint, skok iz vode, broj dodavanja…',
    polja: [
      { ime: 'naziv', label: 'Naziv testa', vrednost: v?.naziv, obavezno: true },
      { ime: 'jed', label: 'Šta se meri', tip: 'select', vrednost: v?.jed || 'vreme', opcije: JEDINICE },
      { ime: 'smer', label: 'Rezultat je bolji kad je', tip: 'select', vrednost: v?.smer || 'manje', opcije: SMEROVI },
    ],
    obrisi: v ? 'Obriši test' : null,
  });
  if (!r) return;
  let lista = [...PODESAVANJA.vrsteTestova];
  if (r === 'obrisi') {
    const rezultati = (await sve('testovi')).filter(t => t.vrsta === id);
    if (rezultati.length && !confirm(`Za ovaj test postoji ${rezultati.length} upisanih rezultata. Obrisati i njih?`)) return;
    for (const t of rezultati) await obrisi('testovi', t.id);
    lista = lista.filter(x => x.id !== id);
  } else if (v) {
    lista = lista.map(x => (x.id === id ? { ...x, ...r } : x));
  } else {
    lista.push({ id: noviId(), ...r });
  }
  await sacuvajListu('vrsteTestova', lista);
  prikaziPodesavanja();
}

/* ---------- Vrste događaja ---------- */
async function urediTip(i) {
  const t = i == null ? null : PODESAVANJA.tipoviDogadjaja[i];
  const r = await pitaj({
    naslov: t ? 'Izmeni vrstu događaja' : 'Nova vrsta događaja',
    opis: t ? '' : 'npr. Kondicioni, Sastanak, Pripreme…',
    polja: [
      { ime: 'naziv', label: 'Naziv', vrednost: t?.naziv, obavezno: true },
      { ime: 'boja', label: 'Boja', tip: 'color', vrednost: t?.boja || '#0e7c86' },
    ],
    obrisi: t && PODESAVANJA.tipoviDogadjaja.length > 1 ? 'Obriši' : null,
  });
  if (!r) return;
  const lista = [...PODESAVANJA.tipoviDogadjaja];
  if (r === 'obrisi') lista.splice(i, 1);
  else if (t) {
    if (t.naziv !== r.naziv) {
      for (const d of await sve('raspored')) if (d.tip === t.naziv) { d.tip = r.naziv; await sacuvaj('raspored', d); }
    }
    lista[i] = { naziv: r.naziv, boja: r.boja };
  } else {
    if (lista.some(x => x.naziv === r.naziv)) return alert('Ta vrsta već postoji.');
    lista.push({ naziv: r.naziv, boja: r.boja });
  }
  await sacuvajListu('tipoviDogadjaja', lista);
  prikaziPodesavanja();
}

async function vratiPodrazumevano() {
  if (!confirm('Vratiti pozicije, vrste testova i vrste događaja na početne vrednosti?\n\nRezultati testova koje si sam dodao ostaju u bazi, ali se neće videti dok ne vratiš tu vrstu testa.')) return;
  await sacuvajListu('pozicije', structuredClone(PODRAZUMEVANO.pozicije));
  await sacuvajListu('vrsteTestova', structuredClone(PODRAZUMEVANO.vrsteTestova));
  await sacuvajListu('tipoviDogadjaja', structuredClone(PODRAZUMEVANO.tipoviDogadjaja));
  poruka('Vraćeno na početno');
  prikaziPodesavanja();
}

function initPodesavanja() {
  $('#izborEkipe').addEventListener('click', otvoriIzborEkipe);
  $('#listaEkipaIzbor').addEventListener('click', e => {
    const li = e.target.closest('li[data-id]'); if (!li) return;
    $('#dlgEkipe').close();
    izaberiEkipu(li.dataset.id);
  });
  $('#urediEkipe').addEventListener('click', () => { $('#dlgEkipe').close(); idiNa('podesavanja'); });

  $('#pKlubovi').addEventListener('click', e => {
    const li = e.target.closest('li'); if (!li) return;
    if (li.dataset.klub) urediKlub(li.dataset.klub);
    else if (li.dataset.ekipa) urediEkipu(li.dataset.ekipa);
    else if (li.dataset.novaEkipa) urediEkipu(null, li.dataset.novaEkipa);
  });
  $('#pNoviKlub').addEventListener('click', () => urediKlub());
  $('#pPozicije').addEventListener('click', e => { const b = e.target.closest('.cip'); if (b) urediPoziciju(Number(b.dataset.i)); });
  $('#pNovaPozicija').addEventListener('click', () => urediPoziciju(null));
  $('#pTestovi').addEventListener('click', e => { const li = e.target.closest('li[data-id]'); if (li) urediVrstuTesta(li.dataset.id); });
  $('#pNoviTest').addEventListener('click', () => urediVrstuTesta());
  $('#pTipovi').addEventListener('click', e => { const li = e.target.closest('li[data-i]'); if (li) urediTip(Number(li.dataset.i)); });
  $('#pNoviTip').addEventListener('click', () => urediTip(null));
  $('#pMaxFaulova').addEventListener('change', async e => { await sacuvajListu('maxFaulova', Number(e.target.value)); poruka('Sačuvano'); });
  $('#pAkcije').addEventListener('change', async () => {
    const skrivene = [...$$('#pAkcije input')].filter(i => !i.checked).map(i => i.value);
    await sacuvajListu('skriveneAkcije', skrivene);
    poruka('Sačuvano');
  });
  $('#pVratiPodrazumevano').addEventListener('click', vratiPodrazumevano);
}
