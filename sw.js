/* ==========================================================================
   Service Worker — مفقودات شبوة
   استراتيجيات:
   • التنقل: الشبكة أولاً (مع مهلة) ثم النسخة المحفوظة، ثم صفحة «غير متصل».
   • الملفات الثابتة: من الذاكرة المؤقتة فوراً مع تحديثها في الخلفية (SWR).
   • الملفات الخارجية (الخطوط/Firebase): لا تُدخَل في الذاكرة المؤقتة.
   ========================================================================== */
const VERSION = 'v2.0.0';
const CACHE = 'mss-' + VERSION;
const RUNTIME = 'mss-runtime-' + VERSION;
const SCOPE = self.registration.scope;
const url = p => new URL(p, SCOPE).href;

const PRECACHE = [
  url('./'),
  url('./index.html'),
  url('./offline.html'),
  url('./style.css'),
  url('./script.js'),
  url('./firebase-config.js'),
  url('./manifest.json'),
  url('./FIREBASE-SETUP.html'),
  url('./icon-192.png'),
  url('./icon-512.png')
];

/* ===== التثبيت: تحضير الملفات الأساسية ===== */
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.allSettled(PRECACHE.map(u => cache.add(new Request(u, { cache: 'reload' }))));
    // لا نستدعي skipWaiting تلقائياً: التحديث يحدث عندما يضغط المستخدم «تحديث الآن»،
    // وهذا يمنع إعادة تحميل الصفحة فجأة أثناء الكتابة.
  })());
});

/* ===== التنشيط: حذف النسخ القديمة ===== */
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE && k !== RUNTIME).map(k => caches.delete(k)));
    if (self.registration.navigationPreload) {
      try { await self.registration.navigationPreload.disable(); } catch (e) {}
    }
    await self.clients.claim();
  })());
});

/* ===== جلب بمساعدة مهلة زمنية ===== */
function fetchWithTimeout(request, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    fetch(request).then(res => { clearTimeout(timer); resolve(res); },
      err => { clearTimeout(timer); reject(err); });
  });
}

/* ===== الاستراتيجيات ===== */
async function handleNavigation(request) {
  try {
    const fresh = await fetchWithTimeout(request, 4000);
    if (fresh && fresh.ok) {
      const cache = await caches.open(CACHE);
      cache.put(url('./index.html'), fresh.clone());
    }
    return fresh;
  } catch (e) {
    const cached = await caches.match(url('./index.html')) || await caches.match(url('./'));
    if (cached) return cached;
    const offline = await caches.match(url('./offline.html'));
    if (offline) return offline;
    return new Response('<h1 dir="rtl">لا يوجد اتصال بالإنترنت</h1>', {
      status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME);
  const cached = await caches.match(request);
  const network = fetch(request).then(response => {
    if (response && response.ok && response.type === 'basic') cache.put(request, response.clone());
    return response;
  }).catch(() => null);
  return cached || (await network) || new Response('', { status: 504, statusText: 'غير متاح دون اتصال' });
}

/* ===== معالج الجلب ===== */
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== self.location.origin) return; // الملفات الخارجية كما هي
  if (requestUrl.pathname.indexOf('/__') === 0) return;

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
    return;
  }

  const isShell = PRECACHE.some(u => new URL(u).pathname === requestUrl.pathname);
  if (isShell) {
    event.respondWith((async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      try { return await fetch(request); }
      catch (e) { return new Response('', { status: 504 }); }
    })());
    return;
  }

  event.respondWith(staleWhileRevalidate(request));
});

/* ===== الرسائل من الصفحة ===== */
self.addEventListener('message', event => {
  const data = event.data || {};
  if (data.type === 'SKIP_WAITING') self.skipWaiting();
  if (data.type === 'GET_VERSION' && event.source) {
    event.source.postMessage({ type: 'VERSION', version: VERSION });
  }
  if (data.type === 'CLEAR_CACHE') {
    event.waitUntil(caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))));
  }
});

/* ===== إشعار المتصفح عند حذف ذاكرة قديمة ===== */
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow(url('./')));
});
