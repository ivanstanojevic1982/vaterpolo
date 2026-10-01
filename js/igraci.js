'use strict';
/* =========================================================
   IGRAČI, TRENING, DOLASCI
   ========================================================= */

/* ---------- Igrači ---------- */
EKRANI.igraci = { naslov: 'Igrači', prikazi: prikaziIgrace };

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

let izmenaIgracaId = null;

async function otvoriFormuIgraca(id) {
  const forma = $('#formaIgrac');
  forma.reset();
  izmenaIgracaId = id || null;
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

  const postojeci = izmenaIgracaId ? await uzmi('igraci', izmenaIgracaId) : null;
  const igrac = {
    ...(postojeci || {}),
    id: izmenaIgracaId || noviId(),
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
  poruka(izmenaIgracaId ? 'Izmene sačuvane' : 'Igrač dodat');
  prikaziIgrace();
}

async function obrisiIgraca() {
  const id = izmenaIgracaId;
  const p = await uzmi('igraci', id);
  if (!confirm(`Obrisati igrača ${p.ime}?\nBiće uklonjen iz treninga, testova i članarina. U zapisnicima utakmica ostaje kao „obrisan“.`)) return;
  await obrisi('igraci', id);
  for (const t of await sve('treninzi')) {
    if (t.prisutni.includes(id)) { t.prisutni = t.prisutni.filter(x => x !== id); await sacuvaj('treninzi', t); }
  }
  for (const t of await sve('testovi')) if (t.igracId === id) await obrisi('testovi', t.id);
  for (const c of await sve('clanarine')) if (c.igracId === id) await obrisi('clanarine', c.kljuc);
  $('#dlgIgrac').close();
  poruka('Igrač obrisan');
  prikaziIgrace();
}

/* ---------- Trening ---------- */
EKRANI.trening = { naslov: 'Trening', prikazi: prikaziTrening };
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

/* ---------- Dolasci ---------- */
EKRANI.dolasci = { naslov: 'Dolasci', roditelj: 'vise', prikazi: prikaziDolaske };

function pocetakPerioda(vrednost) {
  if (vrednost === 'sve') return '0000-00-00';
  if (vrednost === 'sezona') return pocetakSezone();
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

function initIgraci() {
  $('#dodajIgraca').addEventListener('click', () => otvoriFormuIgraca());
  $('#listaIgraca').addEventListener('click', e => { const li = e.target.closest('li'); if (li) otvoriFormuIgraca(li.dataset.id); });
  $('#formaIgrac').addEventListener('submit', sacuvajIgraca);
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
}
