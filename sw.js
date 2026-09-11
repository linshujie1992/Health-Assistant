// App-shell cache only. Personal records live in localStorage, never in a network response.
const CACHE = 'baby-agent-shell-v7';
const ASSETS = ['./','./index.html','./manifest.webmanifest','./css/style.css','./css/baby.css',
 './js/app.js','./js/ui.js','./js/journey/app.mjs','./js/journey/content.mjs',
 './js/journey/dates.mjs','./js/journey/model.mjs','./js/journey/schedule.mjs','./js/journey/storage.mjs',
 './js/foods.js','./js/journey/care.mjs','./js/journey/nutrition.mjs','./js/journey/extras.mjs',
 './icons/icon-192.png','./icons/icon-512.png','./icons/apple-touch-icon.png'];
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))); });
// No skipWaiting: do not replace scripts under a form currently being edited.
self.addEventListener('activate', event => {
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>(k.startsWith('health-assistant-')||k.startsWith('baby-agent-shell-'))&&k!==CACHE).map(k=>caches.delete(k)))));
});
self.addEventListener('fetch', event => {
 if(event.request.method!=='GET')return;
 const url=new URL(event.request.url);
 if(url.origin!==location.origin)return;
 const known=ASSETS.some(asset=>new URL(asset,self.registration.scope).pathname===url.pathname);
 if(!known)return;
 event.respondWith(caches.open(CACHE).then(async cache=>{
   const cached=await cache.match(url.pathname);
   if(cached)return cached;
   return fetch(event.request);
 }));
});
