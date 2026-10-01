'use strict';
/* =========================================================
   TESTOVI (napredak) i ČLANARINE
   ========================================================= */

/* ---------- Testovi ---------- */
EKRANI.testovi = { naslov: 'Testovi', roditelj: 'vise', prikazi: prikaziTestove };

// manjeBolje: true = manje je bolje (vreme), false = više je bolje, null = bez ocene
const VRSTE_TESTOVA = [
  { id: '50sl',   naziv: '50 m slobodno',   jed: 'vreme', manjeBolje: true },
  { id: '100sl',  naziv: '100 m slobodno',  jed: 'vreme', manjeBolje: true },
  { id: '200sl',  naziv: '200 m slobodno',  jed: 'vreme', manjeBolje: true },
  { id: '400sl',  naziv: '400 m slobodno',  jed: 'vreme', manjeBolje: true },
  { id: '25lop',  naziv: '25 m sa loptom',  jed: 'vreme', manjeBolje: true },
  { id: 'visina', naziv: 'Visina',          jed: 'cm',    manjeBolje: false },
  { id: 'tezina', naziv: 'Težina',          jed: 'kg',    manjeBolje: null },
];
let izabraniTest = '50sl';
const vrstaTesta = id => VRSTE_TESTOVA.find(v => v.id === id);

// "32,5" -> 32.5 ; "1:05,3" -> 65.3
function procitajVrednost(tekst, jed) {
  const t = String(tekst).trim().replace(',', '.');
  if (!t) return null;
  if (jed === 'vreme' && t.includes(':')) {
    const [m, s] = t.split(':');
    const v = Number(m) * 60 + Number(s);
    return Number.isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : NaN;
  }
  const v = Number(t);
  return Number.isFinite(v) && v > 0 ? v : NaN;
}

function prikaziVrednost(v, jed) {
  const broj = n => String(Math.round(n * 100) / 100).replace('.', ',');
  if (jed === 'vreme') {
    if (v < 60) return `${broj(v)} s`;
    const m = Math.floor(v / 60);
    const s = v - m * 60;
    return `${m}:${s < 10 ? '0' : ''}${broj(s)}`;
  }
  return `${broj(v)} ${jed}`;
}

function promenaHTML(nova, stara, vrsta) {
  if (stara == null) return '';
  const razlika = Math.round((nova - stara) * 100) / 100;
  if (!razlika) return '<span class="promena">=</span>';
  let kl = '';
  if (vrsta.manjeBolje !== null) kl = (razlika < 0) === vrsta.manjeBolje ? 'bolje' : 'losije';
  const znak = razlika > 0 ? '+' : '−';
  const iznos = String(Math.abs(razlika)).replace('.', ',');
  return `<span class="promena ${kl}">${znak}${iznos}${vrsta.jed === 'vreme' ? ' s' : ''}</span>`;
}

async function prikaziTestove() {
  $('#vrstaTesta').innerHTML = VRSTE_TESTOVA.map(v => `<option value="${v.id}">${esc(v.naziv)}</option>`).join('');
  $('#vrstaTesta').value = izabraniTest;
  const vrsta = vrstaTesta(izabraniTest);
  const [igraci, svi] = await Promise.all([sve('igraci'), sve('testovi')]);
  sortirajIgrace(igraci);
  const rezultati = svi.filter(t => t.vrsta === izabraniTest);

  const redovi = igraci.map(p => {
    const moji = rezultati.filter(r => r.igracId === p.id).sort((a, b) => a.datum.localeCompare(b.datum));
    return { p, moji };
  });
  const sa = redovi.filter(r => r.moji.length), bez = redovi.filter(r => !r.moji.length);

  // Sortiraj po poslednjem rezultatu (najbolji prvi)
  if (vrsta.manjeBolje !== null) {
    sa.sort((a, b) => {
      const va = a.moji.at(-1).vrednost, vb = b.moji.at(-1).vrednost;
      return vrsta.manjeBolje ? va - vb : vb - va;
    });
  }

  const datumi = [...new Set(rezultati.map(r => r.datum))].sort();
  $('#testInfo').textContent = rezultati.length
    ? `Merenja: ${datumi.length} · poslednje ${kratakDatum(datumi.at(-1))}`
    : 'Još nema rezultata za ovaj test.';

  $('#listaTestova').innerHTML = [
    ...sa.map(({ p, moji }) => {
      const posl = moji.at(-1), pret = moji.at(-2);
      const vrednosti = moji.map(m => m.vrednost);
      const najbolji = vrsta.manjeBolje === null ? null : vrsta.manjeBolje ? Math.min(...vrednosti) : Math.max(...vrednosti);
      const rekord = najbolji !== null && posl.vrednost === najbolji && moji.length > 1;
      return `<li data-id="${esc(p.id)}">
        ${kapaHTML(p)}
        <div class="detalji">
          <div class="ime">${esc(p.ime)}</div>
          <div class="opis">${kratakDatum(posl.datum)}${najbolji !== null && moji.length > 1 ? ` · najbolje ${prikaziVrednost(najbolji, vrsta.jed)}` : ''}${rekord ? ' 🏅' : ''}</div>
        </div>
        <div class="vrednost"><b>${prikaziVrednost(posl.vrednost, vrsta.jed)}</b>${promenaHTML(posl.vrednost, pret?.vrednost, vrsta)}</div>
      </li>`;
    }),
    ...bez.map(({ p }) => `<li class="bledo">${kapaHTML(p)}<div class="detalji"><div class="ime">${esc(p.ime)}</div><div class="opis">nema rezultata</div></div></li>`),
  ].join('');
}

async function otvoriUnosTesta() {
  const vrsta = vrstaTesta(izabraniTest);
  const igraci = sortirajIgrace(await sve('igraci'));
  if (!igraci.length) return alert('Prvo dodaj igrače.');
  const forma = $('#formaTest');
  forma.reset();
  forma.elements.datum.value = danasISO();
  $('#dlgTestNaslov').textContent = vrsta.naziv;
  $('#testUputstvo').textContent = vrsta.jed === 'vreme'
    ? 'Vreme upiši u sekundama (32,5) ili minutima (1:05,3). Prazno = nije radio test.'
    : `Upiši u ${vrsta.jed}. Prazno = nije mereno.`;
  const primer = vrsta.jed === 'vreme' ? '0:00,0' : vrsta.jed;
  $('#testUnos').innerHTML = igraci.map(p => `
    <label class="test-red">${kapaHTML(p)}<span>${esc(p.ime)}</span>
      <input data-id="${esc(p.id)}" inputmode="decimal" placeholder="${primer}" autocomplete="off">
    </label>`).join('');
  $('#dlgTest').showModal();
}

async function sacuvajTest(e) {
  e.preventDefault();
  const vrsta = vrstaTesta(izabraniTest);
  const datum = $('#formaTest').elements.datum.value;
  const unosi = [...$$('#testUnos input')];
  let greska = null;
  const za_cuvanje = [];
  for (const inp of unosi) {
    const v = procitajVrednost(inp.value, vrsta.jed);
    inp.classList.remove('pogresno');
    if (v === null) continue;
    if (Number.isNaN(v)) { inp.classList.add('pogresno'); greska = greska || inp; continue; }
    za_cuvanje.push({ igracId: inp.dataset.id, vrednost: v });
  }
  if (greska) { greska.focus(); return alert('Neki unos nije ispravan (označen crveno).'); }
  if (!za_cuvanje.length) return alert('Nije upisan nijedan rezultat.');

  const postojeci = (await sve('testovi')).filter(t => t.vrsta === izabraniTest && t.datum === datum);
  for (const r of za_cuvanje) {
    const isti = postojeci.find(t => t.igracId === r.igracId);
    await sacuvaj('testovi', { id: isti?.id || noviId(), vrsta: izabraniTest, datum, ...r });
  }
  $('#dlgTest').close();
  poruka(`Sačuvano rezultata: ${za_cuvanje.length}`);
  prikaziTestove();
}

let istorijaIgracId = null;
async function prikaziIstoriju(igracId) {
  istorijaIgracId = igracId;
  const vrsta = vrstaTesta(izabraniTest);
  const p = await uzmi('igraci', igracId);
  const moji = (await sve('testovi')).filter(t => t.vrsta === izabraniTest && t.igracId === igracId).sort((a, b) => b.datum.localeCompare(a.datum));
  $('#istorijaNaslov').textContent = `${p.ime} — ${vrsta.naziv}`;
  $('#istorijaLista').innerHTML = moji.map((m, i) => `
    <li><div class="detalji"><div class="ime">${prikaziVrednost(m.vrednost, vrsta.jed)} ${promenaHTML(m.vrednost, moji[i + 1]?.vrednost, vrsta)}</div><div class="opis">${lepDatum(m.datum)}</div></div>
    <button class="tok-brisi" data-id="${esc(m.id)}" aria-label="Obriši">×</button></li>`).join('');
  if (!$('#dlgIstorija').open) $('#dlgIstorija').showModal();
}

/* ---------- Članarine ---------- */
EKRANI.clanarine = { naslov: 'Članarine', roditelj: 'vise', prikazi: prikaziClanarine };
let izabraniMesec = danasISO().slice(0, 7);

function pomeriMesec(m, n) {
  const [g, mm] = m.split('-').map(Number);
  const d = new Date(g, mm - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function nazivMeseca(m) {
  const [g, mm] = m.split('-').map(Number);
  return `${MESECI[mm - 1]} ${g}.`;
}

async function prikaziClanarine() {
  $('#mesecNaziv').textContent = nazivMeseca(izabraniMesec);
  $('#iznosClanarine').value = await uzmiPodesavanje('clanarinaIznos', '') || '';
  const [igraci, uplate] = await Promise.all([sve('igraci'), sve('clanarine')]);
  sortirajIgrace(igraci);
  const ovogMeseca = new Map(uplate.filter(u => u.mesec === izabraniMesec).map(u => [u.igracId, u]));
  const zbir = [...ovogMeseca.values()].reduce((s, u) => s + (Number(u.iznos) || 0), 0);

  $('#clanarineInfo').textContent = igraci.length
    ? `Platilo ${ovogMeseca.size} od ${igraci.length}${zbir ? ` · ukupno ${zbir.toLocaleString('sr-RS')} din` : ''}. Dodirni igrača da označiš uplatu.`
    : 'Prvo dodaj igrače.';

  // Dugovanja: meseci od početka sezone (ili od dolaska igrača) do danas bez uplate
  const tekuci = danasISO().slice(0, 7);
  const sezona = pocetakSezone().slice(0, 7);
  const dugovanja = p => {
    let m = [sezona, (p.dodat || '0000-00').slice(0, 7)].sort().at(-1);
    const nije = [];
    while (m <= tekuci) {
      if (!uplate.some(u => u.igracId === p.id && u.mesec === m)) nije.push(MESECI_KRATKO[Number(m.slice(5)) - 1]);
      m = pomeriMesec(m, 1);
    }
    return nije;
  };

  $('#listaClanarina').innerHTML = igraci.map(p => {
    const u = ovogMeseca.get(p.id);
    const duguje = dugovanja(p);
    const opis = u
      ? `plaćeno ${kratakDatum(u.datum)}${u.iznos ? ` · ${Number(u.iznos).toLocaleString('sr-RS')} din` : ''}`
      : '';
    return `<li data-id="${esc(p.id)}" class="${u ? 'tu' : ''}">
      ${kapaHTML(p)}
      <div class="detalji"><div class="ime">${esc(p.ime)}</div>
        ${opis ? `<div class="opis">${opis}</div>` : ''}
        ${duguje.length ? `<div class="opis dug">nije platio: ${duguje.join(', ')}</div>` : ''}
      </div>
      <div class="kvacica">${u ? '✓' : ''}</div>
    </li>`;
  }).join('');
}

async function prebaciUplatu(igracId) {
  const kljuc = `${igracId}|${izabraniMesec}`;
  const postoji = await uzmi('clanarine', kljuc);
  if (postoji) {
    if (!confirm('Poništiti uplatu za ovaj mesec?')) return;
    await obrisi('clanarine', kljuc);
  } else {
    const iznos = await uzmiPodesavanje('clanarinaIznos', '');
    await sacuvaj('clanarine', { kljuc, igracId, mesec: izabraniMesec, iznos: iznos ? Number(iznos) : null, datum: danasISO() });
  }
  prikaziClanarine();
}

function initTestovi() {
  $('#vrstaTesta').addEventListener('change', e => { izabraniTest = e.target.value; prikaziTestove(); });
  $('#unesiTest').addEventListener('click', otvoriUnosTesta);
  $('#formaTest').addEventListener('submit', sacuvajTest);
  $('#listaTestova').addEventListener('click', e => { const li = e.target.closest('li[data-id]'); if (li) prikaziIstoriju(li.dataset.id); });
  $('#istorijaLista').addEventListener('click', async e => {
    const b = e.target.closest('.tok-brisi'); if (!b) return;
    if (!confirm('Obrisati ovaj rezultat?')) return;
    await obrisi('testovi', b.dataset.id);
    await prikaziIstoriju(istorijaIgracId);
    prikaziTestove();
  });

  $('#mesecNazad').addEventListener('click', () => { izabraniMesec = pomeriMesec(izabraniMesec, -1); prikaziClanarine(); });
  $('#mesecNapred').addEventListener('click', () => { izabraniMesec = pomeriMesec(izabraniMesec, 1); prikaziClanarine(); });
  $('#iznosClanarine').addEventListener('change', async e => { await sacuvajPodesavanje('clanarinaIznos', e.target.value); poruka('Iznos sačuvan'); });
  $('#listaClanarina').addEventListener('click', e => { const li = e.target.closest('li[data-id]'); if (li) prebaciUplatu(li.dataset.id); });
}
