'use strict';
/* =========================================================
   BELEŠKE: brzo beleženje glasom ili kucanjem
   ========================================================= */
EKRANI.beleske = { naslov: 'Beleške', roditelj: 'vise', prikazi: prikaziBeleske };

let izmenaBeleskeId = null;
let filterBeleski = 'ekipa';

/* ---------- Lista ---------- */
function vremeBeleske(iso) {
  const d = new Date(iso);
  const sat = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return sat;
}

async function prikaziBeleske() {
  $('#filterBeleski').value = filterBeleski;
  $('#filterBeleski').hidden = sveEkipe.length < 2;
  const pojam = $('#pretragaBeleski').value.trim().toLowerCase();
  const igraci = new Map((await sve('igraci')).map(p => [p.id, p]));

  let lista = (await sve('beleske'))
    .filter(b => filterBeleski === 'sve' || b.ekipaId === EKIPA.id)
    .sort((a, b) => b.vreme.localeCompare(a.vreme));
  if (pojam) {
    lista = lista.filter(b => b.tekst.toLowerCase().includes(pojam) ||
      (igraci.get(b.igracId)?.ime || '').toLowerCase().includes(pojam));
  }

  $('#nemaBeleski').hidden = lista.length > 0;
  $('#nemaBeleski').textContent = pojam ? 'Ništa nije pronađeno.' : 'Još nema beležaka. Dodirni 🎤 gore desno sa bilo kog ekrana.';

  // Grupisano po danima
  let html = '', poslednjiDan = '';
  for (const b of lista) {
    const dan = danasISO(new Date(b.vreme));
    if (dan !== poslednjiDan) {
      if (poslednjiDan) html += '</ul>';
      html += `<h2 class="podnaslov">${dan === danasISO() ? 'Danas' : dan === pomeriDan(danasISO(), -1) ? 'Juče' : esc(lepDatum(dan))}</h2><ul class="lista beleske-lista">`;
      poslednjiDan = dan;
    }
    const p = igraci.get(b.igracId);
    const ekipa = sveEkipe.find(e => e.id === b.ekipaId);
    const cipovi = [
      p ? `<span class="cip-igrac">${p.kapa ? esc(p.kapa) + ' · ' : ''}${esc(p.ime)}</span>` : '',
      filterBeleski === 'sve' && ekipa ? `<span class="cip-ekipa" style="--b:${esc(bojaEkipe(ekipa))}">${esc(nazivEkipe(ekipa))}</span>` : '',
    ].join('');
    html += `<li data-id="${esc(b.id)}">
      <div class="detalji">
        <div class="beleska-tekst">${esc(b.tekst)}</div>
        <div class="opis">${vremeBeleske(b.vreme)} ${cipovi}</div>
      </div>
    </li>`;
  }
  if (poslednjiDan) html += '</ul>';
  $('#listaBeleski').innerHTML = html;
}

/* ---------- Unos / izmena ---------- */
async function otvoriBelesku(id, igracId) {
  zaustaviDiktiranje();
  izmenaBeleskeId = id || null;
  const b = id ? await uzmi('beleske', id) : null;
  $('#belNaslov').textContent = b ? `Beleška · ${kratakDatum(danasISO(new Date(b.vreme)))} ${vremeBeleske(b.vreme)}` : 'Nova beleška';
  $('#belTekst').value = b?.tekst || '';
  $('#belObrisi').hidden = !b;
  const igraci = await igraciEkipe(b?.ekipaId || EKIPA.id);
  const izabran = b ? b.igracId : (igracId || '');
  $('#belIgrac').innerHTML = '<option value="">— opšta beleška —</option>' +
    igraci.map(p => `<option value="${esc(p.id)}" ${p.id === izabran ? 'selected' : ''}>${p.kapa ? esc(p.kapa) + ' – ' : ''}${esc(p.ime)}</option>`).join('');
  postaviStatus('');
  $('#dlgBeleska').showModal();
  // Nova beleška: odmah pokreni diktiranje (ako telefon podržava)
  if (!b && imaDiktiranje()) pokreniDiktiranje();
}

async function sacuvajBelesku(e) {
  e.preventDefault();
  zaustaviDiktiranje();
  // Sačekaj da stigne poslednja izgovorena reč
  await new Promise(r => setTimeout(r, 300));
  const tekst = $('#belTekst').value.trim();
  if (!tekst) { $('#belTekst').focus(); return; }
  const stara = izmenaBeleskeId ? await uzmi('beleske', izmenaBeleskeId) : null;
  await sacuvaj('beleske', {
    ...(stara || { id: noviId(), ekipaId: EKIPA.id, vreme: new Date().toISOString() }),
    tekst,
    igracId: $('#belIgrac').value || null,
  });
  $('#dlgBeleska').close();
  poruka(stara ? 'Beleška izmenjena' : '📝 Beleška sačuvana');
  if (trenutniEkran === 'beleske') prikaziBeleske();
  if (trenutniEkran === 'vise') prikaziVise();
}

async function obrisiBelesku() {
  if (!confirm('Obrisati ovu belešku?')) return;
  zaustaviDiktiranje();
  await obrisi('beleske', izmenaBeleskeId);
  $('#dlgBeleska').close();
  poruka('Beleška obrisana');
  prikaziBeleske();
}

/* ---------- Diktiranje (prepoznavanje govora) ----------
   Koristi prepoznavanje govora iz pretraživača, na srpskom.
   Na iPhoneu ume da ne radi (posebno sa početnog ekrana) –
   tada trener koristi mikrofon na tastaturi. */
const Prepoznavanje = window.SpeechRecognition || window.webkitSpeechRecognition;
const imaDiktiranje = () => !!Prepoznavanje;
let prepoznavanje = null;
let diktiram = false;

function postaviStatus(tekst, greska) {
  const el = $('#belStatus');
  el.textContent = tekst || (imaDiktiranje()
    ? 'Dodirni 🎤 i govori. Dodirni ponovo da staneš.'
    : 'Dodirni polje, pa 🎤 na tastaturi telefona i govori.');
  el.classList.toggle('dug', !!greska);
}

function pokreniDiktiranje() {
  if (!imaDiktiranje()) {
    postaviStatus('Ovaj telefon ne dozvoljava diktiranje u aplikaciji. Dodirni polje, pa 🎤 na tastaturi i govori.', true);
    $('#belTekst').focus();
    return;
  }
  const polje = $('#belTekst');
  const pocetak = polje.value.trim() ? polje.value.trim() + ' ' : '';
  let konacno = '';

  prepoznavanje = new Prepoznavanje();
  prepoznavanje.lang = 'sr-RS';
  prepoznavanje.continuous = true;
  prepoznavanje.interimResults = true;

  prepoznavanje.onresult = e => {
    let privremeno = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) konacno += r[0].transcript.trim() + ' ';
      else privremeno += r[0].transcript;
    }
    let tekst = pocetak + konacno + privremeno;
    tekst = tekst.charAt(0).toUpperCase() + tekst.slice(1);
    polje.value = tekst;
    polje.scrollTop = polje.scrollHeight;
  };
  prepoznavanje.onerror = e => {
    const poruke = {
      'not-allowed': 'Mikrofon nije dozvoljen. Dozvoli ga u podešavanjima telefona, ili koristi 🎤 na tastaturi.',
      'service-not-allowed': 'Diktiranje ovde nije dostupno. Dodirni polje, pa 🎤 na tastaturi i govori.',
      'network': 'Za diktiranje treba internet. Bez interneta koristi 🎤 na tastaturi.',
      'no-speech': 'Nisam ništa čuo. Dodirni 🎤 i pokušaj ponovo.',
      'language-not-supported': 'Srpski nije podržan za diktiranje ovde. Koristi 🎤 na tastaturi.',
    };
    if (e.error !== 'aborted') postaviStatus(poruke[e.error] || 'Diktiranje nije uspelo. Koristi 🎤 na tastaturi.', true);
  };
  prepoznavanje.onend = () => {
    diktiram = false;
    $('#belMikrofon').classList.remove('snima');
    if ($('#belStatus').textContent.startsWith('🔴')) postaviStatus('');
  };

  try {
    prepoznavanje.start();
    diktiram = true;
    $('#belMikrofon').classList.add('snima');
    postaviStatus('🔴 Slušam… dodirni 🎤 da staneš.');
  } catch {
    postaviStatus('Diktiranje nije uspelo. Koristi 🎤 na tastaturi.', true);
  }
}

function zaustaviDiktiranje() {
  if (prepoznavanje && diktiram) { try { prepoznavanje.stop(); } catch {} }
  diktiram = false;
  $('#belMikrofon')?.classList.remove('snima');
}

/* ---------- Pokretanje ---------- */
function initBeleske() {
  $('#brzaBeleska').addEventListener('click', () => otvoriBelesku());
  $('#novaBeleska').addEventListener('click', () => otvoriBelesku());
  $('#listaBeleski').addEventListener('click', e => { const li = e.target.closest('li[data-id]'); if (li) otvoriBelesku(li.dataset.id); });
  $('#formaBeleska').addEventListener('submit', sacuvajBelesku);
  $('#belObrisi').addEventListener('click', obrisiBelesku);
  $('#belOdustani').addEventListener('click', () => { zaustaviDiktiranje(); $('#dlgBeleska').close(); });
  $('#dlgBeleska').addEventListener('close', zaustaviDiktiranje);
  $('#belMikrofon').addEventListener('click', () => (diktiram ? zaustaviDiktiranje() : pokreniDiktiranje()));
  // Kucanje prekida diktiranje, da se tekst ne pomeša
  $('#belTekst').addEventListener('keydown', () => { if (diktiram) zaustaviDiktiranje(); });
  $('#pretragaBeleski').addEventListener('input', prikaziBeleske);
  $('#filterBeleski').addEventListener('change', e => { filterBeleski = e.target.value; prikaziBeleske(); });
}
