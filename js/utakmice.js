'use strict';
/* =========================================================
   UTAKMICE: lista, statistika uživo, zapisnik
   ========================================================= */

// Vrste događaja. faul: true = lična greška (3 = van igre)
const AKCIJE = {
  gol:           { naziv: 'Gol',                 ikona: '⚽' },
  promasaj:      { naziv: 'Promašaj',            ikona: '✖️' },
  asist:         { naziv: 'Asistencija',         ikona: '🅰️' },
  izboreno:      { naziv: 'Izborio isključenje', ikona: '➕' },
  peterac:       { naziv: 'Izborio peterac',     ikona: '🎯' },
  iskljucenje:   { naziv: 'Isključenje',         ikona: '⛔', faul: true },
  peterac_napr:  { naziv: 'Napravio peterac',    ikona: '⚠️', faul: true },
  odbrana:       { naziv: 'Odbrana',             ikona: '🧤' },
  golProtivnika: { naziv: 'Gol protivnika',      ikona: '🥅' },
};
const AKCIJE_IGRAC = ['gol', 'promasaj', 'asist', 'izboreno', 'peterac', 'iskljucenje', 'peterac_napr'];
const AKCIJE_GOLMAN = ['odbrana', 'gol', 'promasaj', 'asist', 'iskljucenje', 'peterac_napr'];
// Broj ličnih grešaka do isključenja i skrivena dugmad dolaze iz Podešavanja
const maxF = () => Number(PODESAVANJA.maxFaulova) || 3;
const akcijeIgraca = uGolu => (uGolu ? AKCIJE_GOLMAN : AKCIJE_IGRAC).filter(t => !PODESAVANJA.skriveneAkcije.includes(t));

const nazivPerioda = p => (p >= 5 ? 'P' : `Q${p}`);

let utakmica = null;          // trenutno otvorena utakmica
let igraciMapa = new Map();   // id -> igrač
let izmenaUtakmiceId = null;
let akcijaIgracId = null;

/* ---------- Lista ---------- */
EKRANI.utakmice = { naslov: 'Utakmice', prikazi: prikaziUtakmice };
EKRANI.utakmica = { naslov: () => utakmica ? `Protiv: ${utakmica.protivnik}` : 'Utakmica', roditelj: 'utakmice', prikazi: prikaziUtakmicu };

function rezultat(u) {
  let mi = 0, oni = 0;
  for (const d of u.dogadjaji) { if (d.t === 'gol') mi++; else if (d.t === 'golProtivnika') oni++; }
  return { mi, oni };
}

async function prikaziUtakmice() {
  const lista = (await sve('utakmice')).filter(u => u.ekipaId === EKIPA.id).sort((a, b) => (b.datum + (b.vreme || '')).localeCompare(a.datum + (a.vreme || '')));
  $('#nemaUtakmica').hidden = lista.length > 0;
  $('#nemaUtakmica').textContent = `Ekipa „${EKIPA.naziv}“ još nema utakmica.`;
  $('#listaUtakmica').innerHTML = lista.map(u => {
    const { mi, oni } = rezultat(u);
    const ishod = !u.dogadjaji.length ? '' : mi > oni ? 'pobeda' : mi < oni ? 'poraz' : 'nereseno';
    const opis = [kratakDatum(u.datum), u.takmicenje, u.mesto].filter(Boolean).join(' · ');
    return `<li data-id="${esc(u.id)}">
      <div class="detalji"><div class="ime">${esc(u.protivnik)}</div><div class="opis">${esc(opis)}</div></div>
      <div class="skor ${ishod}">${mi}:${oni}</div>
    </li>`;
  }).join('');
}

async function otvoriUtakmicu(id) {
  utakmica = await uzmi('utakmice', id);
  idiNa('utakmica');
}

/* ---------- Forma: nova / izmena ---------- */
async function otvoriFormuUtakmice(id) {
  const forma = $('#formaUtakmica');
  forma.reset();
  izmenaUtakmiceId = id || null;
  const u = id ? await uzmi('utakmice', id) : null;
  $('#dlgUtakmicaNaslov').textContent = u ? 'Izmeni utakmicu' : 'Nova utakmica';
  forma.elements.datum.value = u?.datum || danasISO();
  if (u) for (const polje of ['protivnik', 'vreme', 'mesto', 'takmicenje']) forma.elements[polje].value = u[polje] || '';

  const igraci = await igraciEkipe(u?.ekipaId || EKIPA.id);
  const izabrani = new Set(u ? u.sastav : igraci.map(p => p.id));
  $('#sastavLista').innerHTML = igraci.map(p => `
    <li data-id="${esc(p.id)}" class="${izabrani.has(p.id) ? 'tu' : ''}">
      ${kapaHTML(p)}<div class="detalji"><div class="ime">${esc(p.ime)}</div></div>
      <div class="kvacica">${izabrani.has(p.id) ? '✓' : ''}</div>
    </li>`).join('') || '<li><div class="detalji opis">Nema igrača — dodaj ih na kartici „Igrači“.</div></li>';
  osveziBrojSastava();
  $('#dlgUtakmica').showModal();
}

function osveziBrojSastava() {
  const n = $$('#sastavLista li.tu').length;
  $('#sastavBroj').textContent = `${n} izabrano`;
}

async function sacuvajUtakmicu(e) {
  e.preventDefault();
  const f = $('#formaUtakmica').elements;
  const protivnik = f.protivnik.value.trim();
  if (!protivnik) { f.protivnik.focus(); return; }
  const sastav = [...$$('#sastavLista li.tu')].map(li => li.dataset.id);
  if (!sastav.length) { alert('Izaberi bar jednog igrača u sastavu.'); return; }

  const stara = izmenaUtakmiceId ? await uzmi('utakmice', izmenaUtakmiceId) : null;
  const u = {
    ...(stara || { id: noviId(), ekipaId: EKIPA.id, period: 1, dogadjaji: [] }),
    protivnik,
    datum: f.datum.value,
    vreme: f.vreme.value,
    mesto: f.mesto.value.trim(),
    takmicenje: f.takmicenje.value.trim(),
    sastav,
  };
  await sacuvaj('utakmice', u);
  $('#dlgUtakmica').close();
  utakmica = u;
  if (trenutniEkran === 'utakmica') { postaviNaslov(`Protiv: ${u.protivnik}`); prikaziUtakmicu(); }
  else idiNa('utakmica');
}

/* ---------- Ekran uživo ---------- */
function brojFaulova(igracId) {
  return utakmica.dogadjaji.filter(d => d.igrac === igracId && AKCIJE[d.t].faul).length;
}
function broj(igracId, tip) {
  return utakmica.dogadjaji.filter(d => d.igrac === igracId && d.t === tip).length;
}

async function prikaziUtakmicu() {
  if (!utakmica) return idiNa('utakmice');
  igraciMapa = new Map((await sve('igraci')).map(p => [p.id, p]));
  const u = utakmica;
  const { mi, oni } = rezultat(u);
  $('#golMi').textContent = mi;
  $('#golOni').textContent = oni;
  $('#imeProtivnika').textContent = u.protivnik;
  $$('#periodi button').forEach(b => b.classList.toggle('aktivan', Number(b.dataset.p) === u.period));

  // Igrači u sastavu, golmani prvi
  const sastav = u.sastav.map(id => igraciMapa.get(id) || { id, ime: 'obrisan igrač', kapa: '' });
  sortirajIgrace(sastav);

  // Golman u golu
  const golmani = sastav.filter(p => p.pozicija === 'Golman');
  const kandidati = [...golmani, ...sastav.filter(p => p.pozicija !== 'Golman')];
  if (!u.golman || !u.sastav.includes(u.golman)) u.golman = golmani[0]?.id || '';
  $('#golmanUGolu').innerHTML = `<option value="">— niko —</option>` +
    kandidati.map(p => `<option value="${esc(p.id)}" ${p.id === u.golman ? 'selected' : ''}>${p.kapa ? esc(p.kapa) + ' – ' : ''}${esc(p.ime)}</option>`).join('');

  $('#mrezaIgraca').innerHTML = sastav.map(p => {
    const f = brojFaulova(p.id);
    const van = f >= maxF();
    const golman = p.id === u.golman;
    const g = broj(p.id, 'gol');
    const stat = golman
      ? `🧤 ${broj(p.id, 'odbrana')}${g ? ` · ⚽ ${g}` : ''}`
      : `⚽ ${g}${broj(p.id, 'asist') ? ` · 🅰 ${broj(p.id, 'asist')}` : ''}`;
    const tackice = Array.from({ length: maxF() }, (_, i) => `<i class="${i < f ? 'pun' : ''}"></i>`).join('');
    return `<button class="plocica ${van ? 'van' : ''} ${golman ? 'u-golu' : ''}" data-id="${esc(p.id)}">
      <span class="pl-kapa ${p.pozicija === 'Golman' ? 'golman' : ''}">${p.kapa ? esc(p.kapa) : '–'}</span>
      <span class="pl-ime">${esc(prezime(p))}</span>
      <span class="pl-stat">${van ? 'VAN IGRE' : stat}</span>
      <span class="faulovi">${tackice}</span>
    </button>`;
  }).join('');

  prikaziTok();
}

function prikaziTok() {
  const u = utakmica;
  let mi = 0, oni = 0;
  const redovi = u.dogadjaji.map(d => {
    if (d.t === 'gol') mi++;
    if (d.t === 'golProtivnika') oni++;
    const a = AKCIJE[d.t];
    const p = d.igrac ? igraciMapa.get(d.igrac) : null;
    let ko = '';
    if (d.t === 'golProtivnika') ko = p ? `golman ${p.kapa || ''} ${prezime(p)}` : '';
    else if (d.igrac) ko = `${p?.kapa ? p.kapa + ' ' : ''}${prezime(p)}`;
    const skor = (d.t === 'gol' || d.t === 'golProtivnika') ? `<b>${mi}:${oni}</b>` : '';
    return `<li class="${d.t === 'golProtivnika' ? 'njihov' : ''} ${d.t === 'gol' ? 'nas-gol' : ''}">
      <span class="tok-period">${nazivPerioda(d.period)}</span>
      <span class="tok-tekst">${a.ikona} ${a.naziv}${ko ? ' — ' + esc(ko) : ''}</span>
      ${skor}
      <button class="tok-brisi" data-id="${esc(d.id)}" aria-label="Obriši">×</button>
    </li>`;
  });
  $('#tokUtakmice').innerHTML = redovi.reverse().join('') || '<li class="tok-prazno">Još nema događaja. Dodirni igrača da upišeš akciju.</li>';
}

async function sacuvajUtakmicuTiho() {
  await sacuvaj('utakmice', utakmica);
}

async function dodajDogadjaj(t, igrac) {
  const pre = igrac ? brojFaulova(igrac) : 0;
  utakmica.dogadjaji.push({ id: noviId(), t, igrac: igrac || null, period: utakmica.period, vreme: Date.now() });
  await sacuvajUtakmicuTiho();

  if (AKCIJE[t].faul && igrac) {
    const p = igraciMapa.get(igrac);
    const ime = `${p?.kapa ? 'Kapa ' + p.kapa + ' – ' : ''}${prezime(p)}`;
    if (pre + 1 === maxF()) poruka(`⛔ ${ime}: ${maxF()}. lična greška — van igre!`, 3500);
    else if (pre + 1 === maxF() - 1) poruka(`⚠️ ${ime}: još jedna greška do isključenja`, 2500);
    else poruka(`${AKCIJE[t].naziv} — ${ime}`);
    if (navigator.vibrate) navigator.vibrate(pre + 1 >= maxF() ? [200, 100, 200] : 100);
  } else {
    poruka(`${AKCIJE[t].ikona} ${AKCIJE[t].naziv}`);
  }
  prikaziUtakmicu();
}

function otvoriAkcije(igracId) {
  akcijaIgracId = igracId;
  const p = igraciMapa.get(igracId) || { ime: 'obrisan igrač' };
  const uGolu = igracId === utakmica.golman;
  const f = brojFaulova(igracId);
  $('#akcijaNaslov').textContent = `${p.kapa ? p.kapa + ' · ' : ''}${p.ime}`;
  $('#akcijaInfo').textContent = f >= maxF()
    ? `Van igre (${f} lične greške). Upis je i dalje moguć ako je greška.`
    : `Lične greške: ${f} od ${maxF()} · ${nazivPerioda(utakmica.period)}`;
  const lista = akcijeIgraca(uGolu);
  $('#akcijeDugmad').innerHTML = lista.map(t => {
    const a = AKCIJE[t];
    const kl = t === 'gol' ? 'glavno' : a.faul ? 'opasno' : '';
    return `<button class="dugme ${kl}" data-t="${t}">${a.ikona} ${a.naziv}</button>`;
  }).join('');
  $('#dlgAkcija').showModal();
}

async function ponistiPoslednje() {
  const d = utakmica.dogadjaji.at(-1);
  if (!d) return poruka('Nema šta da se poništi');
  utakmica.dogadjaji.pop();
  await sacuvajUtakmicuTiho();
  poruka(`Poništeno: ${AKCIJE[d.t].naziv}`);
  prikaziUtakmicu();
}

async function obrisiDogadjajUtakmice(id) {
  const d = utakmica.dogadjaji.find(x => x.id === id);
  if (!d || !confirm(`Obrisati „${AKCIJE[d.t].naziv}“ (${nazivPerioda(d.period)})?`)) return;
  utakmica.dogadjaji = utakmica.dogadjaji.filter(x => x.id !== id);
  await sacuvajUtakmicuTiho();
  prikaziUtakmicu();
}

async function obrisiUtakmicu() {
  if (!confirm(`Obrisati utakmicu protiv ${utakmica.protivnik} sa celom statistikom?`)) return;
  await obrisi('utakmice', utakmica.id);
  utakmica = null;
  poruka('Utakmica obrisana');
  idiNa('utakmice');
}

/* ---------- Zapisnik ---------- */
function napraviZapisnik() {
  const u = utakmica;
  const { mi, oni } = rezultat(u);
  const periodi = [...new Set([1, 2, 3, 4, ...u.dogadjaji.map(d => d.period)])].sort((a, b) => a - b);
  const poPeriodima = periodi.map(p => {
    const ds = u.dogadjaji.filter(d => d.period === p);
    return `${ds.filter(d => d.t === 'gol').length}:${ds.filter(d => d.t === 'golProtivnika').length}`;
  });

  const sastav = sortirajIgrace(u.sastav.map(id => igraciMapa.get(id) || { id, ime: 'obrisan igrač', kapa: '' }));
  const igraci = sastav.map(p => {
    const g = broj(p.id, 'gol'), pr = broj(p.id, 'promasaj');
    const sutevi = g + pr;
    return {
      p, g, sutevi, pct: sutevi ? Math.round((g / sutevi) * 100) : null,
      a: broj(p.id, 'asist'), isk: brojFaulova(p.id), izb: broj(p.id, 'izboreno'), pet: broj(p.id, 'peterac'),
    };
  });

  const golmani = sastav.map(p => {
    const odb = broj(p.id, 'odbrana');
    const prim = u.dogadjaji.filter(d => d.t === 'golProtivnika' && d.igrac === p.id).length;
    return { p, odb, prim, pct: odb + prim ? Math.round((odb / (odb + prim)) * 100) : null };
  }).filter(x => x.odb || x.prim || x.p.pozicija === 'Golman');

  return { mi, oni, poPeriodima, igraci, golmani };
}

function prikaziZapisnik() {
  const u = utakmica;
  const z = napraviZapisnik();
  $('#zapisnikNaslov').textContent = `Mi ${z.mi} : ${z.oni} ${u.protivnik}`;
  const zaglavlje = `<p class="info">${esc([lepDatum(u.datum), u.takmicenje, u.mesto].filter(Boolean).join(' · '))}<br>Po četvrtinama: ${z.poPeriodima.join(', ')}</p>`;

  const nula = v => (v ? v : '<span class="nula">0</span>');
  const tabela = `<div class="tabela-omot"><table>
    <thead><tr><th>#</th><th class="levo">Igrač</th><th title="Golovi">G</th><th title="Šutevi">Š</th><th>%</th><th title="Asistencije">A</th><th title="Lične greške">LG</th><th title="Izborena isključenja">II</th><th title="Izboreni peterci">IP</th></tr></thead>
    <tbody>${z.igraci.map(r => `<tr class="${r.isk >= maxF() ? 'van' : ''}">
      <td>${esc(r.p.kapa || '–')}</td><td class="levo">${esc(prezime(r.p))}</td>
      <td><b>${nula(r.g)}</b></td><td>${nula(r.sutevi)}</td><td>${r.pct === null ? '–' : r.pct}</td>
      <td>${nula(r.a)}</td><td>${nula(r.isk)}</td><td>${nula(r.izb)}</td><td>${nula(r.pet)}</td>
    </tr>`).join('')}</tbody></table></div>`;

  const golmani = z.golmani.length ? `<h3>Golmani</h3><div class="tabela-omot"><table>
    <thead><tr><th>#</th><th class="levo">Golman</th><th>Odbrane</th><th>Primljeni</th><th>%</th></tr></thead>
    <tbody>${z.golmani.map(r => `<tr><td>${esc(r.p.kapa || '–')}</td><td class="levo">${esc(prezime(r.p))}</td><td><b>${r.odb}</b></td><td>${r.prim}</td><td>${r.pct === null ? '–' : r.pct}</td></tr>`).join('')}</tbody>
  </table></div>` : '';

  const nepripisano = utakmica.dogadjaji.filter(d => d.t === 'golProtivnika' && !d.igrac).length;
  const napomena = nepripisano ? `<p class="info">Golova protivnika bez upisanog golmana: ${nepripisano}</p>` : '';

  $('#zapisnikSadrzaj').innerHTML = zaglavlje + tabela + golmani + napomena +
    '<p class="info">G gol · Š šutevi · A asistencije · LG lične greške · II izborena isključenja · IP izboreni peterci</p>';
  $('#dlgZapisnik').showModal();
}

function zapisnikKaoTekst() {
  const u = utakmica;
  const z = napraviZapisnik();
  const linije = [
    `🤽 Mi ${z.mi} : ${z.oni} ${u.protivnik}`,
    [kratakDatum(u.datum), u.takmicenje, u.mesto].filter(Boolean).join(' · '),
    `Po četvrtinama: ${z.poPeriodima.join(', ')}`,
    '',
  ];
  const strelci = z.igraci.filter(r => r.g).sort((a, b) => b.g - a.g);
  if (strelci.length) {
    linije.push('Strelci:');
    strelci.forEach(r => linije.push(`  ${r.p.kapa ? r.p.kapa + '. ' : ''}${r.p.ime} – ${r.g} (${r.g}/${r.sutevi})`));
  }
  z.golmani.filter(r => r.odb || r.prim).forEach(r => linije.push(`Golman ${r.p.ime}: ${r.odb} odbrana, ${r.prim} primljenih`));
  const van = z.igraci.filter(r => r.isk >= maxF());
  if (van.length) linije.push(`Van igre (${maxF()} LG): ${van.map(r => r.p.ime).join(', ')}`);
  return linije.join('\n');
}

/* ---------- Pokretanje ---------- */
function initUtakmice() {
  $('#novaUtakmica').addEventListener('click', () => otvoriFormuUtakmice());
  $('#listaUtakmica').addEventListener('click', e => { const li = e.target.closest('li[data-id]'); if (li) otvoriUtakmicu(li.dataset.id); });
  $('#formaUtakmica').addEventListener('submit', sacuvajUtakmicu);
  $('#sastavLista').addEventListener('click', e => {
    const li = e.target.closest('li[data-id]'); if (!li) return;
    li.classList.toggle('tu');
    li.querySelector('.kvacica').textContent = li.classList.contains('tu') ? '✓' : '';
    osveziBrojSastava();
  });

  $('#periodi').addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    utakmica.period = Number(b.dataset.p);
    await sacuvajUtakmicuTiho();
    prikaziUtakmicu();
  });
  $('#golmanUGolu').addEventListener('change', async e => {
    utakmica.golman = e.target.value;
    await sacuvajUtakmicuTiho();
    prikaziUtakmicu();
  });
  $('#mrezaIgraca').addEventListener('click', e => { const b = e.target.closest('.plocica'); if (b) otvoriAkcije(b.dataset.id); });
  $('#akcijeDugmad').addEventListener('click', e => {
    const b = e.target.closest('button[data-t]'); if (!b) return;
    $('#dlgAkcija').close();
    dodajDogadjaj(b.dataset.t, akcijaIgracId);
  });
  $('#golProtivnika').addEventListener('click', () => dodajDogadjaj('golProtivnika', utakmica.golman || null));
  $('#ponisti').addEventListener('click', ponistiPoslednje);
  $('#tokUtakmice').addEventListener('click', e => { const b = e.target.closest('.tok-brisi'); if (b) obrisiDogadjajUtakmice(b.dataset.id); });

  $('#otvoriZapisnik').addEventListener('click', prikaziZapisnik);
  $('#podeliZapisnik').addEventListener('click', () => podeliTekst('Zapisnik utakmice', zapisnikKaoTekst()));
  $('#izmeniUtakmicu').addEventListener('click', () => otvoriFormuUtakmice(utakmica.id));
  $('#obrisiUtakmicu').addEventListener('click', obrisiUtakmicu);
}
