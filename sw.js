// Kad menjaš bilo koji fajl aplikacije, povećaj broj verzije
// da bi telefon preuzeo novu verziju.
const VERZIJA = 'vaterpolo-v4';

const FAJLOVI = [
  './',
  './index.html',
  './style.css',
  './js/osnova.js',
  './js/igraci.js',
  './js/utakmice.js',
  './js/raspored.js',
  './js/taktika.js',
  './js/testovi.js',
  './js/beleske.js',
  './js/podesavanja.js',
  './js/kopija.js',
  './js/start.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', e => {
  // cache: 'reload' = uzmi sveže fajlove sa servera, ne iz keša pretraživača
  e.waitUntil(caches.open(VERZIJA)
    .then(c => c.addAll(FAJLOVI.map(f => new Request(f, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(kljucevi => Promise.all(kljucevi.filter(k => k !== VERZIJA).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Prvo iz keša (radi bez interneta), u pozadini osveži keš ako ima mreže
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(izKesa => {
      const izMreze = fetch(e.request).then(odgovor => {
        if (odgovor.ok && new URL(e.request.url).origin === location.origin) {
          const kopija = odgovor.clone();
          caches.open(VERZIJA).then(c => c.put(e.request, kopija));
        }
        return odgovor;
      }).catch(() => izKesa);
      return izKesa || izMreze;
    })
  );
});
