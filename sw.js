// Marley Task Manager — Service Worker v2
// Supports iOS, Android, Samsung Internet, Samsung DeX
const CACHE = "marley-v2";

const ASSETS = [
  "/index.html",
  "/manifest.json",
  // Core icons
  "/icon-48.png",
  "/icon-72.png",
  "/icon-96.png",
  "/icon-144.png",
  "/icon-192.png",
  "/icon-256.png",
  "/icon-512.png",
  "/icon-maskable-192.png",
  "/icon-maskable-512.png",
  // Fonts
  "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Nunito:wght@600;700;800&display=swap"
];

// Install: cache core assets
self.addEventListener("install", function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(cache) {
      // Cache assets individually so one failure doesn't block all
      return Promise.allSettled(
        ASSETS.map(function(url) {
          return cache.add(url).catch(function(err) {
            console.warn("SW: Failed to cache", url, err);
          });
        })
      );
    })
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener("activate", function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE; })
            .map(function(k) {
              console.log("SW: Removing old cache", k);
              return caches.delete(k);
            })
      );
    })
  );
  self.clients.claim();
});

// Fetch strategy:
// - Google Sheets API: always network (never cache)
// - Splash/icon PNGs: cache first (long-lived assets)
// - Everything else: network first, fall back to cache
self.addEventListener("fetch", function(e) {
  var url = e.request.url;

  // Never intercept Google API calls
  if (url.indexOf("script.google.com") > -1 ||
      url.indexOf("googleapis.com") > -1 ||
      url.indexOf("googleusercontent.com") > -1) {
    return;
  }

  // Cache-first for static assets (icons, splashes, fonts)
  var isStatic = url.match(/\.(png|jpg|ico|woff2?|ttf)$/) ||
                 url.indexOf("fonts.gstatic.com") > -1 ||
                 url.indexOf("fonts.googleapis.com") > -1;

  if (isStatic) {
    e.respondWith(
      caches.match(e.request).then(function(cached) {
        if (cached) return cached;
        return fetch(e.request).then(function(response) {
          if (response && response.status === 200) {
            var clone = response.clone();
            caches.open(CACHE).then(function(cache) { cache.put(e.request, clone); });
          }
          return response;
        });
      })
    );
    return;
  }

  // Network-first for HTML and everything else
  e.respondWith(
    fetch(e.request).then(function(response) {
      if (e.request.method === "GET" && response && response.status === 200) {
        var clone = response.clone();
        caches.open(CACHE).then(function(cache) { cache.put(e.request, clone); });
      }
      return response;
    }).catch(function() {
      return caches.match(e.request).then(function(cached) {
        if (cached) return cached;
        // Offline fallback for navigation
        if (e.request.mode === "navigate") {
          return caches.match("/index.html");
        }
      });
    })
  );
});
