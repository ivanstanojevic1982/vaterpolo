'use strict';
/* =========================================================
   TABLA ZA TAKTIKU
   Bazen 20 x 30 m nacrtan uspravno (1 m = 10 jedinica).
   Mi napadamo GORNJI gol, branimo DONJI.
   ========================================================= */
EKRANI.taktika = { naslov: 'Taktika', roditelj: 'vise', prikazi: prikaziTaktiku };

const SVG_NS = 'http://www.w3.org/2000/svg';
const SIRINA = 200, VISINA = 320, VRH = 10, DNO = 310;

// Tokeni: m = mi (tamne kape), o = protivnik (bele kape), 1 = golman
const TOKENI = [
  ...[1, 2, 3, 4, 5, 6, 7].map(n => ({ id: 'm' + n, tim: 'mi', broj: n })),
  ...[1, 2, 3, 4, 5, 6, 7].map(n => ({ id: 'o' + n, tim: 'oni', broj: n })),
  { id: 'lopta', tim: 'lopta' },
];

// Gotove postavke: id tokena -> [x, y]
const POSTAVKE = {
  pocetna: {
    naziv: 'Početak (plivanje za loptu)',
    t: {
      m1: [100, 304], m2: [35, 302], m3: [62, 302], m4: [89, 302], m5: [111, 302], m6: [138, 302], m7: [165, 302],
      o1: [100, 16], o2: [35, 18], o3: [62, 18], o4: [89, 18], o5: [111, 18], o6: [138, 18], o7: [165, 18],
      lopta: [100, 160],
    },
  },
  napad: {
    naziv: 'Napad 6 na 6 (luk)',
    t: {
      m1: [100, 290], m2: [100, 34], m3: [28, 42], m4: [172, 42], m5: [52, 78], m6: [148, 78], m7: [100, 88],
      o1: [100, 16], o2: [100, 46], o3: [38, 50], o4: [162, 50], o5: [60, 66], o6: [140, 66], o7: [100, 74],
      lopta: [108, 86],
    },
  },
  igracVise: {
    naziv: 'Igrač više 6 na 5 (4-2)',
    t: {
      m1: [100, 280], m2: [72, 32], m3: [128, 32], m4: [30, 62], m5: [76, 64], m6: [124, 64], m7: [170, 62],
      o1: [100, 16], o2: [72, 44], o3: [128, 44], o4: [52, 52], o5: [148, 52], o6: [100, 54], o7: [192, 160],
      lopta: [36, 60],
    },
  },
  igracManje: {
    naziv: 'Igrač manje 5 na 6 (odbrana)',
    t: {
      m1: [100, 304], m2: [72, 276], m3: [128, 276], m4: [52, 268], m5: [148, 268], m6: [100, 266], m7: [192, 160],
      o1: [100, 40], o2: [72, 288], o3: [128, 288], o4: [30, 258], o5: [76, 256], o6: [124, 256], o7: [170, 258],
      lopta: [164, 260],
    },
  },
  kontra: {
    naziv: 'Kontranapad 3 na 2',
    t: {
      m1: [100, 290], m2: [60, 70], m3: [100, 62], m4: [140, 72], m5: [70, 190], m6: [130, 200], m7: [100, 230],
      o1: [100, 16], o2: [82, 52], o3: [122, 56], o4: [60, 130], o5: [140, 140], o6: [100, 170], o7: [100, 210],
      lopta: [106, 60],
    },
  },
};

let tacke = {};          // trenutni položaji
let crtez = [];          // nacrtane linije (SVG path "d")
let izabranaPostavka = 'napad';
let crtanje = false;
let vucenje = null;      // { id } ili { linija: <path> }

/* ---------- Crtanje bazena ---------- */
function el(ime, attrs = {}, roditelj) {
  const e = document.createElementNS(SVG_NS, ime);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (roditelj) roditelj.appendChild(e);
  return e;
}

function nacrtajTeren() {
  const svg = $('#bazen');
  svg.innerHTML = '';
  const defs = el('defs', {}, svg);
  const marker = el('marker', { id: 'strelica', viewBox: '0 0 10 10', refX: '8', refY: '5', markerWidth: '5', markerHeight: '5', orient: 'auto-start-reverse' }, defs);
  el('path', { d: 'M0,0 L10,5 L0,10 z', fill: '#ffffff' }, marker);

  const teren = el('g', { id: 'teren' }, svg);
  el('rect', { x: 0, y: 0, width: SIRINA, height: VISINA, fill: '#0b5e8f', rx: 6 }, teren);
  el('rect', { x: 0, y: VRH, width: SIRINA, height: DNO - VRH, fill: '#1784c4' }, teren);
  // Linije: gol (bela), 2 m (crvena), 5 m (žuta), sredina (bela)
  const linija = (y, boja, crt) => el('line', { x1: 0, x2: SIRINA, y1: y, y2: y, stroke: boja, 'stroke-width': 1.4, 'stroke-dasharray': crt || '' }, teren);
  linija(VRH, '#ffffff'); linija(DNO, '#ffffff');
  linija(VRH + 20, '#e53935', '5 4'); linija(DNO - 20, '#e53935', '5 4');
  linija(VRH + 50, '#fdd835', '5 4'); linija(DNO - 50, '#fdd835', '5 4');
  linija(VISINA / 2, '#ffffff', '2 4');
  // Golovi (3 m široki)
  el('rect', { x: 85, y: 2, width: 30, height: VRH - 2, fill: 'none', stroke: '#fff', 'stroke-width': 1.5 }, teren);
  el('rect', { x: 85, y: DNO, width: 30, height: VRH - 2, fill: 'none', stroke: '#fff', 'stroke-width': 1.5 }, teren);
  // Natpisi
  const natpis = (y, tekst) => { const t = el('text', { x: 4, y, fill: 'rgba(255,255,255,.7)', 'font-size': 7 }, teren); t.textContent = tekst; };
  natpis(VRH + 18, '2 m'); natpis(VRH + 48, '5 m'); natpis(DNO - 22, '2 m'); natpis(DNO - 52, '5 m');

  el('g', { id: 'crtez' }, svg);
  const g = el('g', { id: 'tokeni' }, svg);
  for (const tk of TOKENI) {
    const grupa = el('g', { class: 'token', 'data-id': tk.id }, g);
    if (tk.tim === 'lopta') {
      el('circle', { r: 5.5, fill: '#f2b705', stroke: '#7a5b00', 'stroke-width': 1 }, grupa);
      continue;
    }
    const golman = tk.broj === 1;
    const boja = tk.tim === 'mi' ? (golman ? '#c8372d' : '#0b2e4f') : (golman ? '#c8372d' : '#ffffff');
    const tekstBoja = tk.tim === 'mi' || golman ? '#ffffff' : '#0b2e4f';
    el('circle', { r: 9, fill: boja, stroke: tk.tim === 'mi' ? '#ffffff' : '#0b2e4f', 'stroke-width': 1.5 }, grupa);
    const t = el('text', { class: 'broj', 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': 10, 'font-weight': 700, fill: tekstBoja }, grupa);
    t.textContent = tk.broj;
    if (tk.tim === 'mi') {
      // Prezime ispod kape (sa tamnom ivicom da se čita na vodi)
      el('text', { class: 'oznaka', y: 16, 'text-anchor': 'middle', 'font-size': 6.5, 'font-weight': 700, fill: '#ffffff',
        stroke: '#0b2e4f', 'stroke-width': 2, 'paint-order': 'stroke' }, grupa);
    }
  }
}

/* ---------- Naši igrači na kapama ----------
   sastavTaktike[i] = id igrača na kapi "m(i+1)"; kapa m1 je golman.
   Čuva se posebno za svaku ekipu. 'brojevi' = samo brojevi 1–7. */
let sastavTaktike = [];
let igraciTaktike = new Map();

function podrazumevaniSastav(igraci) {
  const golmani = igraci.filter(p => p.pozicija === 'Golman');
  const ostali = igraci.filter(p => p.pozicija !== 'Golman');
  return [golmani[0], ...ostali, ...golmani.slice(1)].filter(Boolean).slice(0, 7).map(p => p.id);
}

async function ucitajSastavTaktike() {
  const igraci = EKIPA ? await igraciEkipe() : [];
  igraciTaktike = new Map(igraci.map(p => [p.id, p]));
  const sacuvan = EKIPA ? await uzmiPodesavanje(`taktikaSastav|${EKIPA.id}`, null) : null;
  if (sacuvan === 'brojevi') sastavTaktike = [];
  else if (Array.isArray(sacuvan)) sastavTaktike = sacuvan.map(id => (igraciTaktike.has(id) ? id : null));
  else sastavTaktike = podrazumevaniSastav(igraci);
}

function oznaciKape() {
  for (let n = 1; n <= 7; n++) {
    const g = $(`#tokeni .token[data-id="m${n}"]`);
    if (!g) continue;
    const p = igraciTaktike.get(sastavTaktike[n - 1]);
    const samoBrojevi = !sastavTaktike.length;
    // Prazna kapa među pravim igračima je bez broja, da se ne pomeša sa nečijom kapom
    g.querySelector('.broj').textContent = p ? (p.kapa || '–') : samoBrojevi ? n : '';
    g.querySelector('.oznaka').textContent = p ? prezime(p).slice(0, 10) : '';
    g.style.opacity = p || samoBrojevi ? '' : '.45';
  }
}

async function izaberiSastavTaktike() {
  const igraci = [...igraciTaktike.values()];
  if (!igraci.length) return alert('Izabrana ekipa nema igrača. Kape ostaju sa brojevima 1–7.');
  const opcije = [{ vrednost: '', naziv: '— prazno —' },
    ...igraci.map(p => ({ vrednost: p.id, naziv: `${p.kapa ? p.kapa + ' – ' : ''}${p.ime}` }))];
  const polja = Array.from({ length: 7 }, (_, i) => ({
    ime: 'k' + i, tip: 'select', opcije,
    label: i === 0 ? 'Kapa 1 – golman (crvena)' : `Kapa ${i + 1}`,
    vrednost: sastavTaktike[i] || '',
  }));
  const r = await pitaj({
    naslov: `Na tabli – ${EKIPA.naziv}`,
    opis: 'Ko je na kojoj tamnoj kapi. Protivnik ostaje sa brojevima.',
    polja, obrisi: 'Samo brojevi 1–7',
  });
  if (!r) return;
  if (r === 'obrisi') {
    sastavTaktike = [];
    await sacuvajPodesavanje(`taktikaSastav|${EKIPA.id}`, 'brojevi');
  } else {
    const ids = polja.map(p => r[p.ime] || null);
    const dupli = ids.filter(Boolean).find((id, i, a) => a.indexOf(id) !== i);
    if (dupli) return alert(`${igraciTaktike.get(dupli).ime} je izabran na dve kape.`);
    sastavTaktike = ids;
    await sacuvajPodesavanje(`taktikaSastav|${EKIPA.id}`, ids);
  }
  oznaciKape();
}

function postaviTokene() {
  $$('#tokeni .token').forEach(g => {
    const [x, y] = tacke[g.dataset.id] || [100, 160];
    g.setAttribute('transform', `translate(${x} ${y})`);
  });
  const sloj = $('#crtez');
  sloj.innerHTML = '';
  for (const d of crtez) el('path', { d, fill: 'none', stroke: '#ffffff', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'marker-end': 'url(#strelica)' }, sloj);
}

/* ---------- Postavke ---------- */
async function popuniIzborPostavki() {
  const sacuvane = (await sve('taktike')).sort((a, b) => a.naziv.localeCompare(b.naziv, 'sr'));
  $('#izborPostavke').innerHTML =
    `<optgroup label="Gotove postavke">${Object.entries(POSTAVKE).map(([id, p]) => `<option value="g:${id}">${esc(p.naziv)}</option>`).join('')}</optgroup>` +
    (sacuvane.length ? `<optgroup label="Moje postavke">${sacuvane.map(p => `<option value="s:${esc(p.id)}">${esc(p.naziv)}</option>`).join('')}</optgroup>` : '');
  $('#izborPostavke').value = izabranaPostavka;
  $('#obrisiPostavku').hidden = !izabranaPostavka.startsWith('s:');
}

async function ucitajPostavku(vrednost) {
  izabranaPostavka = vrednost;
  if (vrednost.startsWith('g:')) {
    tacke = structuredClone(POSTAVKE[vrednost.slice(2)].t);
    crtez = [];
  } else {
    const p = await uzmi('taktike', vrednost.slice(2));
    if (!p) return ucitajPostavku('g:napad');
    tacke = structuredClone(p.tacke);
    crtez = [...(p.crtez || [])];
  }
  $('#obrisiPostavku').hidden = !vrednost.startsWith('s:');
  postaviTokene();
  zapamtiRadno();
}

function zapamtiRadno() {
  sacuvajPodesavanje('taktikaRadna', { izabranaPostavka, tacke, crtez });
}

async function sacuvajPostavku() {
  const postojeca = izabranaPostavka.startsWith('s:') ? await uzmi('taktike', izabranaPostavka.slice(2)) : null;
  const naziv = prompt('Naziv postavke:', postojeca?.naziv || '');
  if (!naziv || !naziv.trim()) return;
  const ista = (await sve('taktike')).find(p => p.naziv.toLowerCase() === naziv.trim().toLowerCase());
  const id = ista?.id || (postojeca && postojeca.naziv === naziv.trim() ? postojeca.id : noviId());
  await sacuvaj('taktike', { id, naziv: naziv.trim(), tacke, crtez });
  izabranaPostavka = 's:' + id;
  await popuniIzborPostavki();
  zapamtiRadno();
  poruka('Postavka sačuvana');
}

async function obrisiPostavku() {
  if (!izabranaPostavka.startsWith('s:')) return;
  const p = await uzmi('taktike', izabranaPostavka.slice(2));
  if (!p || !confirm(`Obrisati postavku „${p.naziv}“?`)) return;
  await obrisi('taktike', p.id);
  await popuniIzborPostavki();
  await ucitajPostavku('g:napad');
  $('#izborPostavke').value = 'g:napad';
  poruka('Postavka obrisana');
}

/* ---------- Prevlačenje i crtanje ---------- */
function tackaUSvg(e) {
  const svg = $('#bazen');
  const pt = svg.createSVGPoint();
  pt.x = e.clientX; pt.y = e.clientY;
  const p = pt.matrixTransform(svg.getScreenCTM().inverse());
  return [Math.max(4, Math.min(SIRINA - 4, Math.round(p.x))), Math.max(4, Math.min(VISINA - 4, Math.round(p.y)))];
}

function pocni(e) {
  const svg = $('#bazen');
  const token = e.target.closest('.token');
  if (!crtanje && token) {
    vucenje = { id: token.dataset.id };
    token.classList.add('vuce');
  } else if (crtanje) {
    const [x, y] = tackaUSvg(e);
    const putanja = el('path', { d: `M${x} ${y}`, fill: 'none', stroke: '#ffffff', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'marker-end': 'url(#strelica)' }, $('#crtez'));
    vucenje = { linija: putanja, d: `M${x} ${y}`, poslednja: [x, y] };
  } else return;
  svg.setPointerCapture(e.pointerId);
  e.preventDefault();
}

function pomeri(e) {
  if (!vucenje) return;
  const [x, y] = tackaUSvg(e);
  if (vucenje.id) {
    tacke[vucenje.id] = [x, y];
    $(`#tokeni .token[data-id="${vucenje.id}"]`).setAttribute('transform', `translate(${x} ${y})`);
  } else {
    const [px, py] = vucenje.poslednja;
    if (Math.hypot(x - px, y - py) < 3) return;   // ne pamti sitne pokrete
    vucenje.d += ` L${x} ${y}`;
    vucenje.poslednja = [x, y];
    vucenje.linija.setAttribute('d', vucenje.d);
  }
}

function zavrsi() {
  if (!vucenje) return;
  if (vucenje.id) $(`#tokeni .token[data-id="${vucenje.id}"]`)?.classList.remove('vuce');
  else if (vucenje.d.includes('L')) crtez.push(vucenje.d);
  else vucenje.linija.remove();
  vucenje = null;
  zapamtiRadno();
}

function prebaciCrtanje() {
  crtanje = !crtanje;
  $('#crtajDugme').classList.toggle('ukljuceno', crtanje);
  $('#taktikaUputstvo').textContent = crtanje
    ? 'Crtanje uključeno: povuci prstom strelicu. Ponovo ✏️ za pomeranje kapa.'
    : 'Prevuci kape prstom. 👥 bira igrače, ✏️ uključuje crtanje.';
}

async function prikaziTaktiku() {
  if (!$('#tokeni')) {
    nacrtajTeren();
    const radna = await uzmiPodesavanje('taktikaRadna', null);
    if (radna) {
      izabranaPostavka = radna.izabranaPostavka; tacke = radna.tacke; crtez = radna.crtez || [];
    } else {
      izabranaPostavka = 'g:napad'; tacke = structuredClone(POSTAVKE.napad.t); crtez = [];
    }
  }
  await popuniIzborPostavki();
  postaviTokene();
  await ucitajSastavTaktike();   // svaki put, jer je ekipa mogla da se promeni
  oznaciKape();
}

function initTaktika() {
  const svg = $('#bazen');
  svg.addEventListener('pointerdown', pocni);
  svg.addEventListener('pointermove', pomeri);
  svg.addEventListener('pointerup', zavrsi);
  svg.addEventListener('pointercancel', zavrsi);
  $('#izborPostavke').addEventListener('change', e => ucitajPostavku(e.target.value));
  $('#crtajDugme').addEventListener('click', prebaciCrtanje);
  $('#sastavDugme').addEventListener('click', izaberiSastavTaktike);
  $('#brisiCrtez').addEventListener('click', () => { crtez = []; postaviTokene(); zapamtiRadno(); });
  $('#sacuvajPostavku').addEventListener('click', sacuvajPostavku);
  $('#obrisiPostavku').addEventListener('click', obrisiPostavku);
}
