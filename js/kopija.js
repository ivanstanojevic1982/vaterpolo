'use strict';
/* =========================================================
   REZERVNA KOPIJA i ekran "Više"
   ========================================================= */
EKRANI.kopija = { naslov: 'Rezervna kopija', roditelj: 'vise', prikazi: prikaziKopiju };
EKRANI.vise = { naslov: 'Više', prikazi: prikaziVise };

const TABELE_ZA_KOPIJU = Object.keys(TABELE);

// 1 beleška, 2–4 beleške, 5+ beležaka (11–14 beležaka)
function brojBeleski(n) {
  const d = n % 10, s = n % 100;
  if (d === 1 && s !== 11) return 'beleška';
  if (d >= 2 && d <= 4 && (s < 12 || s > 14)) return 'beleške';
  return 'beležaka';
}

async function prikaziVise() {
  const brBeleski = (await sve('beleske')).filter(b => b.ekipaId === EKIPA.id).length;
  $('#viseBeleskeOpis').textContent = brBeleski ? `${brBeleski} ${brojBeleski(brBeleski)} za ovu ekipu` : 'Brze beleške glasom ili kucanjem';
  const poslednja = await uzmiPodesavanje('poslednjaKopija', null);
  const el = $('#viseKopijaOpis');
  if (!poslednja) { el.textContent = 'Kopija još nije napravljena!'; el.classList.add('dug'); return; }
  const dana = Math.round((izISO(danasISO()) - izISO(poslednja)) / 86400000);
  el.textContent = dana === 0 ? 'Poslednja kopija: danas' : `Poslednja kopija pre ${dana} ${dana === 1 ? 'dan' : 'dana'}`;
  el.classList.toggle('dug', dana > 7);
}

async function prikaziKopiju() {
  const [igraci, treninzi, utakmice, testovi, poslednja] = await Promise.all([
    sve('igraci'), sve('treninzi'), sve('utakmice'), sve('testovi'), uzmiPodesavanje('poslednjaKopija', null),
  ]);
  $('#statistika').textContent = `U telefonu (svi klubovi): ${sviKlubovi.length} klub(a), ${sveEkipe.length} ekipa, ${igraci.length} igrača, ${treninzi.length} treninga, ${utakmice.length} utakmica, ${testovi.length} rezultata testova.`;
  $('#poslednjaKopija').textContent = poslednja ? `Poslednja kopija: ${lepDatum(poslednja)}` : 'Kopija još nije napravljena.';
}

async function izvezi() {
  const tabele = {};
  for (const t of TABELE_ZA_KOPIJU) tabele[t] = await sve(t);
  const podaci = { aplikacija: 'vaterpolo-trener', verzija: 3, napravljeno: new Date().toISOString(), tabele };
  const ime = `vaterpolo-kopija-${danasISO()}.json`;
  const fajl = new File([JSON.stringify(podaci)], ime, { type: 'application/json' });

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
  await sacuvajPodesavanje('poslednjaKopija', danasISO());
  poruka('Kopija napravljena');
  prikaziKopiju();
}

async function uvezi(e) {
  const fajl = e.target.files[0];
  e.target.value = '';
  if (!fajl) return;
  let tabele;
  let napravljeno;
  try {
    const p = JSON.parse(await fajl.text());
    if (p.aplikacija !== 'vaterpolo-trener') throw 0;
    napravljeno = p.napravljeno;
    if (p.verzija === 1) tabele = { igraci: p.igraci, treninzi: p.treninzi };   // stara kopija
    else tabele = p.tabele;
    if (!tabele || !Array.isArray(tabele.igraci)) throw 0;
    // Stare kopije (v1, v2): treninzi nemaju ekipu – dobiće je u popraviPodatke()
    if ((p.verzija || 1) < 3) {
      tabele.treninzi = (tabele.treninzi || []).map(t => ({ ...t, ekipaId: null, kljuc: 'bez|' + t.datum }));
    }
  } catch {
    alert('Ovo nije ispravan fajl rezervne kopije.');
    return;
  }
  const kad = napravljeno ? lepDatum(danasISO(new Date(napravljeno))) : 'nepoznato';
  const opis = `${(tabele.klubovi || []).length || 1} klub(a), ${tabele.igraci.length} igrača, ${(tabele.treninzi || []).length} treninga, ${(tabele.utakmice || []).length} utakmica`;
  if (!confirm(`Kopija od ${kad}: ${opis}.\n\nTrenutni podaci biće ZAMENJENI. Nastaviti?`)) return;

  await tx(TABELE_ZA_KOPIJU, 'readwrite', stores => {
    stores.forEach((s, i) => {
      const ime = TABELE_ZA_KOPIJU[i];
      if (ime === 'meta' && !tabele.meta) return;   // stara kopija nema podešavanja – zadrži postojeća
      s.clear();
      (tabele[ime] || []).forEach(r => s.put(r));
    });
  });
  $('#bazen').innerHTML = '';   // taktika će se ponovo učitati
  utakmica = null;
  await popraviPodatke();
  await ucitajPodesavanja();
  await ucitajKluboveIEkipe();
  poruka('Podaci vraćeni iz kopije');
  prikaziKopiju();
}

function initKopija() {
  $('#izvoz').addEventListener('click', izvezi);
  $('#uvozFajl').addEventListener('change', uvezi);
  $('#vise').addEventListener('click', e => { const li = e.target.closest('li[data-idi]'); if (li) idiNa(li.dataset.idi); });
}
