'use strict';
/* =========================================================
   RASPORED: treninzi, utakmice, turniri
   ========================================================= */
EKRANI.raspored = { naslov: 'Raspored', prikazi: prikaziRaspored };

let izmenaDogadjajaId = null;
let filterRasporeda = 'sve';
const bojaTipa = tip => PODESAVANJA.tipoviDogadjaja.find(t => t.naziv === tip)?.boja || '#6b7d8f';

function opcijeEkipa(izabrana, saOpstim) {
  return (saOpstim ? `<option value="" ${izabrana === '' ? 'selected' : ''}>Opšte (sve ekipe)</option>` : '') +
    sviKlubovi.map(k => {
      const ekipe = sveEkipe.filter(e => e.klubId === k.id);
      return ekipe.length ? `<optgroup label="${esc(k.naziv)}">${ekipe.map(e =>
        `<option value="${esc(e.id)}" ${e.id === izabrana ? 'selected' : ''}>${esc(e.naziv)}</option>`).join('')}</optgroup>` : '';
    }).join('');
}

function stavkaRasporeda(d, danas) {
  const dt = izISO(d.datum);
  const naslov = d.naziv ? `${d.tip}: ${d.naziv}` : d.tip;
  const opis = [d.vreme, d.mesto].filter(Boolean).join(' · ');
  const ekipa = sveEkipe.find(e => e.id === d.ekipaId);
  const cip = `<span class="cip-ekipa" style="--b:${esc(ekipa ? bojaEkipe(ekipa) : '#6b7d8f')}">${esc(ekipa ? nazivEkipe(ekipa) : 'Opšte')}</span>`;
  return `<li data-id="${esc(d.id)}" class="${d.datum === danas ? 'danas' : ''}">
    <div class="datum-znak" style="background:${esc(bojaTipa(d.tip))}">
      <span class="dz-dan">${DANI_KRATKO[dt.getDay()]}</span>
      <span class="dz-broj">${dt.getDate()}</span>
      <span class="dz-mesec">${MESECI_KRATKO[dt.getMonth()]}</span>
    </div>
    <div class="detalji">
      <div class="ime">${esc(naslov)}${d.datum === danas ? ' <span class="znacka">danas</span>' : ''}</div>
      ${opis ? `<div class="opis">${esc(opis)}</div>` : ''}
      ${sveEkipe.length > 1 ? cip : ''}
      ${d.napomena ? `<div class="opis">${esc(d.napomena)}</div>` : ''}
    </div>
    <div class="desno">›</div>
  </li>`;
}

async function prikaziRaspored() {
  const danas = danasISO();
  $('#filterRasporeda').innerHTML = `<option value="sve">Sve ekipe</option>` + opcijeEkipa(filterRasporeda, false);
  $('#filterRasporeda').value = filterRasporeda;
  $('#filterRasporeda').closest('label').hidden = sveEkipe.length < 2;
  const svi = (await sve('raspored'))
    .filter(d => filterRasporeda === 'sve' || d.ekipaId === filterRasporeda || !d.ekipaId)
    .sort((a, b) => (a.datum + (a.vreme || '')).localeCompare(b.datum + (b.vreme || '')));
  const predstoji = svi.filter(d => d.datum >= danas);
  const proslo = svi.filter(d => d.datum < danas).reverse().slice(0, 20);

  $('#nemaDogadjaja').hidden = svi.length > 0;

  // Predstojeće grupisano po mesecima
  let html = '';
  let poslednjiMesec = '';
  if (predstoji.length) {
    html += '<ul class="lista raspored-lista">';
    for (const d of predstoji) {
      const m = d.datum.slice(0, 7);
      if (m !== poslednjiMesec) {
        const dt = izISO(d.datum);
        html += `<li class="mesec-naslov">${MESECI[dt.getMonth()]} ${dt.getFullYear()}.</li>`;
        poslednjiMesec = m;
      }
      html += stavkaRasporeda(d, danas);
    }
    html += '</ul>';
  } else if (svi.length) {
    html += '<p class="prazno">Nema predstojećih događaja.</p>';
  }
  if (proslo.length) {
    html += `<details class="proslo"><summary>Prošlo (${proslo.length})</summary>
      <ul class="lista raspored-lista">${proslo.map(d => stavkaRasporeda(d, danas)).join('')}</ul></details>`;
  }
  $('#rasporedSadrzaj').innerHTML = html;
}

async function otvoriFormuDogadjaja(id) {
  const forma = $('#formaDogadjaj');
  forma.reset();
  izmenaDogadjajaId = id || null;
  const d = id ? await uzmi('raspored', id) : null;
  $('#dlgDogadjajNaslov').textContent = d ? 'Izmeni događaj' : 'Novi događaj';
  $('#obrisiDogadjaj').hidden = !d;
  forma.elements.datum.value = d?.datum || danasISO();
  const tipovi = PODESAVANJA.tipoviDogadjaja.map(t => t.naziv);
  if (d?.tip && !tipovi.includes(d.tip)) tipovi.push(d.tip);
  forma.elements.tip.innerHTML = tipovi.map(t => `<option>${esc(t)}</option>`).join('');
  forma.elements.ekipaId.innerHTML = opcijeEkipa(d ? (d.ekipaId || '') : (filterRasporeda !== 'sve' ? filterRasporeda : EKIPA.id), true);
  if (d) for (const polje of ['tip', 'naziv', 'vreme', 'mesto', 'napomena']) forma.elements[polje].value = d[polje] || '';
  // Ponavljanje samo pri dodavanju
  forma.querySelector('.cek-red').hidden = !!d;
  $('#dlgDogadjaj').showModal();
}

async function sacuvajDogadjaj(e) {
  e.preventDefault();
  const f = $('#formaDogadjaj').elements;
  const osnova = {
    tip: f.tip.value,
    ekipaId: f.ekipaId.value,
    naziv: f.naziv.value.trim(),
    datum: f.datum.value,
    vreme: f.vreme.value,
    mesto: f.mesto.value.trim(),
    napomena: f.napomena.value.trim(),
  };
  if (!osnova.datum) return;

  if (izmenaDogadjajaId) {
    const stari = await uzmi('raspored', izmenaDogadjajaId);
    await sacuvaj('raspored', { ...stari, ...osnova });
    poruka('Izmene sačuvane');
  } else if (f.ponavljaj.checked) {
    const doDatuma = f.doDatuma.value;
    if (!doDatuma || doDatuma < osnova.datum) { alert('Upiši datum do kog se ponavlja.'); return; }
    const grupa = noviId();
    let datum = osnova.datum, n = 0;
    while (datum <= doDatuma && n < 60) {
      await sacuvaj('raspored', { ...osnova, id: noviId(), datum, grupa });
      datum = pomeriDan(datum, 7); n++;
    }
    poruka(`Dodato ${n} termina`);
  } else {
    await sacuvaj('raspored', { ...osnova, id: noviId() });
    poruka('Dodato u raspored');
  }
  $('#dlgDogadjaj').close();
  prikaziRaspored();
}

async function obrisiDogadjaj() {
  const d = await uzmi('raspored', izmenaDogadjajaId);
  if (d.grupa) {
    const ostali = (await sve('raspored')).filter(x => x.grupa === d.grupa && x.datum > d.datum);
    if (ostali.length && confirm(`Ovo je termin koji se ponavlja.\n\nOK = obriši ovaj i svih ${ostali.length} narednih\nOtkaži = samo ovaj`)) {
      for (const x of ostali) await obrisi('raspored', x.id);
    } else if (!confirm('Obrisati samo ovaj termin?')) return;
  } else if (!confirm('Obrisati ovaj događaj?')) return;
  await obrisi('raspored', d.id);
  $('#dlgDogadjaj').close();
  poruka('Obrisano');
  prikaziRaspored();
}

function initRaspored() {
  $('#noviDogadjaj').addEventListener('click', () => otvoriFormuDogadjaja());
  $('#rasporedSadrzaj').addEventListener('click', e => { const li = e.target.closest('li[data-id]'); if (li) otvoriFormuDogadjaja(li.dataset.id); });
  $('#formaDogadjaj').addEventListener('submit', sacuvajDogadjaj);
  $('#filterRasporeda').addEventListener('change', e => { filterRasporeda = e.target.value; prikaziRaspored(); });
  $('#obrisiDogadjaj').addEventListener('click', obrisiDogadjaj);
  $('#formaDogadjaj').elements.ponavljaj.addEventListener('change', e => {
    const f = $('#formaDogadjaj').elements;
    if (e.target.checked && !f.doDatuma.value) f.doDatuma.value = pomeriDan(f.datum.value || danasISO(), 7 * 8);
  });
}
