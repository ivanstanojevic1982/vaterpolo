'use strict';
/* =========================================================
   POKRETANJE APLIKACIJE
   ========================================================= */
async function start() {
  try {
    db = await otvoriBazu();
  } catch (e) {
    document.body.innerHTML = '<p style="padding:20px">Baza ne može da se otvori. Ako koristiš privatni režim u Safariju, isključi ga.</p>';
    return;
  }

  // Zamoli pretraživač da ne briše podatke
  if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});

  $$('nav.dole button').forEach(b => b.addEventListener('click', () => idiNa(b.dataset.ekran)));
  $('#nazad').addEventListener('click', () => { const r = EKRANI[trenutniEkran]?.roditelj; if (r) idiNa(r); });
  // Svako dugme sa data-zatvori zatvara svoj dijalog
  $$('[data-zatvori]').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));

  initIgraci();
  initUtakmice();
  initRaspored();
  initTaktika();
  initTestovi();
  initKopija();

  idiNa('igraci');

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
    // Kad stigne nova verzija, osveži stranicu jednom
    let osvezeno = false;
    const imaoStaru = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (osvezeno || !imaoStaru) return;
      osvezeno = true;
      poruka('Stigla je nova verzija aplikacije');
    });
  }
}

start();
