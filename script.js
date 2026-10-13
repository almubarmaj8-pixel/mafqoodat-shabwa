/* ==========================================================================
   مفقودات شبوة — script.js  (v2.0.0)
   • بحث عربي ذكي (تطبيع الهمزات والتاء المربوطة والأرقام العربية)
   • فلاتر وترتيب + روابط قابلة للمشاركة + رابط مباشر لكل إعلان
   • صور: ضغط تلقائي على الجهاز + صور مصغّرة + حتى 3 صور
   • «إعلاناتي»: تعديل وحذف آمن من نفس الجهاز فقط
   • Firebase اختياري (مزامنة لحظية + تخزين مؤقت للعمل دون إنترنت)
   • PWA: تثبيت، تحديث، وحالة الاتصال
   ========================================================================== */
(function () {
  'use strict';

  /* ===== 0) الإعدادات ===== */
  const APP_VERSION = '2.0.0';
  const SDK = 'https://www.gstatic.com/firebasejs/9.23.0/';
  const COLLECTION = 'posts';
  const REPORTS = 'reports';
  const PAGE_SIZE = 24;
  const CLOUD_TIMEOUT = 9000;

  const LS = {
    posts:   'mss_posts_v3',
    legacy:  'mafqoodat_shabwa_posts_v2',
    mine:    'mss_mine_v3',
    device:  'mss_device_v3',
    theme:   'mss_theme',
    views:   'mss_views_v3',
    reports: 'mss_reports_v3',
    profile: 'mss_profile_v3',
    cache:   'mss_cloud_cache_v3'
  };

  const IMG = {
    maxDim: 1280, quality: .72, maxBytes: 230 * 1024,
    thumbDim: 420, thumbQuality: .6, thumbBytes: 42 * 1024,
    count: 3, totalBytes: 720 * 1024, maxSource: 12 * 1024 * 1024
  };

  const CAT_ICONS = {
    'هواتف': '📱', 'مستندات': '📄', 'محافظ ونقود': '💰', 'مجوهرات': '💎',
    'مفاتيح': '🔑', 'ملابس': '👕', 'إلكترونيات': '💻', 'حيوانات': '🐾',
    'مركبات': '🚗'
  };
  const DEFAULT_GRADIENT = 8;

  /* ===== 1) أدوات ===== */
  const $  = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.prototype.slice.call((root || document).querySelectorAll(sel));

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  const escapeAttr = escapeHtml;

  function safeGet(key, fallback) {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
    catch (e) { return fallback; }
  }
  function safeSet(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { return false; }
  }
  function safeGetRaw(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
  function safeSetRaw(key, value) { try { localStorage.setItem(key, value); return true; } catch (e) { return false; } }

  /** تطبيع النص العربي: تشكيل، همزات، تاء مربوطة، ياء، أرقام عربية ← لاتينية */
  function normArabic(text) {
    return String(text == null ? '' : text)
      .toLowerCase()
      .replace(/[\u064B-\u0652\u0670\u0640]/g, '')
      .replace(/[\u0622\u0623\u0625\u0627\u0671]/g, '\u0627')
      .replace(/\u0629/g, '\u0647')
      .replace(/[\u0649\u064A\u0626]/g, '\u064A')
      .replace(/\u0624/g, '\u0648')
      .replace(/[\u0660-\u0669]/g, d => String(d.charCodeAt(0) - 0x0660))
      .replace(/[\u06F0-\u06F9]/g, d => String(d.charCodeAt(0) - 0x06F0))
      .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function debounce(fn, wait) {
    let timer;
    return function () {
      const args = arguments, ctx = this;
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(ctx, args), wait);
    };
  }

  function formatRelative(iso) {
    const date = new Date(iso);
    if (isNaN(date)) return '';
    const diff = Date.now() - date.getTime();
    const min = Math.floor(diff / 60000), hr = Math.floor(diff / 3600000), day = Math.floor(diff / 86400000);
    if (diff < 60000) return 'الآن';
    if (min < 60) return 'قبل ' + min + ' دقيقة';
    if (hr < 24) return 'قبل ' + hr + ' ساعة';
    if (day < 7) return 'قبل ' + day + ' يوم';
    if (day < 30) return 'قبل ' + Math.round(day / 7) + ' أسبوع';
    return formatDate(iso);
  }
  function formatDate(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return '';
    try { return d.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' }); }
    catch (e) { return String(iso).slice(0, 10); }
  }
  function formatDateTime(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return '';
    try { return d.toLocaleString('ar-EG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); }
    catch (e) { return String(iso); }
  }
  const formatCount = n => String(Number(n) || 0);
  const catIcon = cat => CAT_ICONS[cat] || '📦';
  function catGradient(cat) {
    const keys = Object.keys(CAT_ICONS);
    const i = keys.indexOf(cat);
    return i === -1 ? DEFAULT_GRADIENT : i;
  }

  /** توحيد أرقام الهاتف: يقبل 7XXXXXXXX أو 07XXXXXXXX أو +967… أو أي رقم دولي */
  function normalizePhone(raw) {
    let value = String(raw == null ? '' : raw).replace(/[\s\-()]/g, '').replace(/[\u0660-\u0669\u06F0-\u06F9]/g, function (ch) {
      const code = ch.charCodeAt(0);
      return String(code >= 0x06F0 ? code - 0x06F0 : code - 0x0660);
    });
    if (!/^\+?\d{7,15}$/.test(value)) return null;

    let digits = value.replace(/^\+/, '');
    if (/^00967\d{9}$/.test(digits)) digits = digits.slice(5);
    else if (/^967\d{9}$/.test(digits)) digits = digits.slice(3);
    else if (/^0\d{9}$/.test(digits)) digits = digits.replace(/^0+/, '');

    if (/^7\d{8}$/.test(digits)) {
      return {
        wa: '967' + digits,
        intl: '+967' + digits,
        local: digits,
        country: 'YE',
        pretty: '+967 ' + digits.slice(0, 3) + ' ' + digits.slice(3, 6) + ' ' + digits.slice(6)
      };
    }
    return { wa: digits, intl: '+' + digits, local: digits, country: 'INTL', pretty: '+' + digits };
  }
  function maskPhone(info) {
    if (!info) return '';
    if (info.country === 'YE') return '+967 7' + '•'.repeat(5) + info.local.slice(-2);
    return info.pretty.slice(0, 4) + ' •••••' + info.pretty.slice(-2);
  }
  const phoneInfo = post => normalizePhone(post && post.contactPhone);

  /* ===== 2) الحالة ===== */
  const state = {
    posts: [], cloud: [], cloudMore: [], cache: [], local: [],
    filter: 'all', category: '', sort: 'new', query: '', terms: [],
    visible: PAGE_SIZE, loading: true, cloudMode: false,
    cloudHasMore: false, cloudCursor: null, authReady: false,
    demo: false, detailId: null, editingId: null, images: [], type: 'missing'
  };

  let db = null, auth = null, unsubscribe = null;
  let installPrompt = null, userRequestedUpdate = false, pushedDetail = false, suppressPop = false;

  const deviceId = (function () {
    let id = safeGetRaw(LS.device);
    if (!id) {
      id = 'dev_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
      safeSetRaw(LS.device, id);
    }
    return id;
  })();

  let myIds = safeGet(LS.mine, []);
  if (!Array.isArray(myIds)) myIds = [];

  function isMine(post) {
    if (!post) return false;
    if (myIds.indexOf(String(post.id)) !== -1) return true;
    return !!(post.ownerId && post.ownerId === deviceId);
  }

  /* ===== 3) التنبيهات ===== */
  const TOAST_ICONS = { success: '#i-check', error: '#i-close', info: '#i-sparkle' };
  function toast(message, type, ms) {
    const box = $('#toasts');
    if (!box) return;
    const el = document.createElement('div');
    el.className = 'toast ' + (type || 'info');
    el.innerHTML = '<svg class="ic"><use href="' + (TOAST_ICONS[type] || TOAST_ICONS.info) + '"></use></svg><span>' + escapeHtml(message) + '</span>';
    box.appendChild(el);
    setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 260);
    }, ms || (type === 'error' ? 5200 : 3200));
  }

  /* ===== 4) شريط الحالة ===== */
  let bannerHandler = null;
  function showBanner(opts) {
    const el = $('#banner');
    if (!el) return;
    el.className = 'banner ' + (opts.type || '');
    el.hidden = false;
    $('#bannerIcon').innerHTML = '<use href="' + (opts.icon || '#i-sparkle') + '"></use>';
    $('#bannerMsg').innerHTML = opts.html || escapeHtml(opts.message || '');
    const btn = $('#bannerAction');
    if (opts.actionText) {
      btn.hidden = false;
      btn.textContent = opts.actionText;
      bannerHandler = opts.onAction || null;
    } else { btn.hidden = true; bannerHandler = null; }
  }
  function hideBanner() { const el = $('#banner'); if (el) el.hidden = true; }

  /* ===== 5) النوافذ ===== */
  let lastFocused = null, openCount = 0;

  function openModal(id) {
    const el = typeof id === 'string' ? document.getElementById(id) : id;
    if (!el || !el.hidden) return;
    lastFocused = document.activeElement;
    el.hidden = false;
    openCount++;
    document.body.classList.add('no-scroll');
    const focusable = el.querySelector('input:not([type=hidden]), textarea, select, button');
    if (focusable) setTimeout(() => focusable.focus({ preventScroll: true }), 70);
  }

  function closeModal(id) {
    const node = typeof id === 'string' ? document.getElementById(id) : (id || null);
    const targets = node ? [node] : $$('.overlay');
    let closed = 0;
    targets.forEach(el => { if (!el.hidden) { el.hidden = true; closed++; } });
    openCount = Math.max(0, openCount - closed);
    if (openCount === 0) document.body.classList.remove('no-scroll');
    if (closed && lastFocused && lastFocused.focus) {
      try { lastFocused.focus({ preventScroll: true }); } catch (e) {}
    }
  }

  function confirmDialog(opts) {
    return new Promise(resolve => {
      const overlay = $('#confirmModal');
      const yes = $('#confirmYes');
      const no = $('#confirmNo');

      $('#confirmIcon').textContent = opts.icon || '⚠️';
      $('#confirmTitle').textContent = opts.title || 'تأكيد';
      $('#confirmText').textContent = opts.text || 'هل أنت متأكد؟';
      yes.textContent = opts.yesText || 'تأكيد';
      no.textContent = opts.noText || 'إلغاء';
      yes.className = 'btn ' + (opts.danger === false ? 'btn-primary' : 'btn-danger');

      let settled = false;
      function finish(result) {
        if (settled) return;
        settled = true;
        yes.removeEventListener('click', onYes);
        no.removeEventListener('click', onNo);
        overlay.removeEventListener('click', onBackdrop);
        document.removeEventListener('keydown', onKey);
        closeModal(overlay);
        resolve(result);
      }
      function onYes() { finish(true); }
      function onNo() { finish(false); }
      function onBackdrop(e) { if (e.target === overlay) finish(false); }
      function onKey(e) { if (e.key === 'Escape') { e.stopPropagation(); finish(false); } }

      yes.addEventListener('click', onYes);
      no.addEventListener('click', onNo);
      overlay.addEventListener('click', onBackdrop);
      document.addEventListener('keydown', onKey, true);
      openModal(overlay);
    });
  }

  /* ===== 6) الوضع الليلي/النهاري ===== */
  function initTheme() {
    const btn = $('[data-action="toggle-theme"]');
    if (!btn) return;
    btn.addEventListener('click', function () {
      const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
      document.documentElement.dataset.theme = next;
      safeSetRaw(LS.theme, next);
      $$('meta[name="theme-color"]').forEach(meta => {
        meta.setAttribute('content', meta.getAttribute('media') && meta.getAttribute('media').indexOf('light') !== -1
          ? '#f4f7fd' : '#070b16');
      });
      toast(next === 'light' ? 'تم تشغيل الوضع النهاري' : 'تم تشغيل الوضع الليلي', 'info', 1700);
    });
  }

  /* ===== 7) تطبيع الإعلان ===== */
  function normalizePost(raw) {
    const images = Array.isArray(raw.images) ? raw.images.filter(Boolean) : (raw.image ? [raw.image] : []);
    const thumbs = Array.isArray(raw.thumbs) ? raw.thumbs.filter(Boolean) : [];
    return {
      id: String(raw.id),
      type: raw.type === 'found' ? 'found' : 'missing',
      title: String(raw.title || '').slice(0, 90),
      description: String(raw.description || '').slice(0, 700),
      category: String(raw.category || 'أخرى').slice(0, 30),
      location: String(raw.location || '').slice(0, 70),
      contactName: String(raw.contactName || '').slice(0, 45),
      contactPhone: String(raw.contactPhone || '').slice(0, 20),
      contactPref: raw.contactPref === 'call' ? 'call' : 'whatsapp',
      images: images,
      thumbs: thumbs.length ? thumbs : images.slice(0, 1),
      status: raw.status === 'returned' ? 'returned' : 'active',
      date: raw.date || new Date().toISOString(),
      eventDate: raw.eventDate || '',
      returnedDate: raw.returnedDate || '',
      views: Number(raw.views) || 0,
      ownerId: raw.ownerId || '',
      local: !!raw.local
    };
  }

  /* ===== 8) Firebase ===== */
  const hasFirebaseConfig = (typeof FIREBASE_ENABLED !== 'undefined') && FIREBASE_ENABLED === true &&
    (typeof FIREBASE_CONFIG !== 'undefined') && !!FIREBASE_CONFIG.apiKey;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const found = document.querySelector('script[src="' + src + '"]');
      if (found) {
        if (found.dataset.loaded === '1') return resolve();
        found.addEventListener('load', () => resolve());
        found.addEventListener('error', () => reject(new Error('فشل تحميل ' + src)));
        return;
      }
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = () => { s.dataset.loaded = '1'; resolve(); };
      s.onerror = () => reject(new Error('فشل تحميل ' + src));
      document.head.appendChild(s);
    });
  }

  async function initCloud() {
    if (!hasFirebaseConfig) return false;
    try {
      await loadScript(SDK + 'firebase-app-compat.js');
      await loadScript(SDK + 'firebase-firestore-compat.js');
      if (FIREBASE_CONFIG.useAnonymousAuth !== false) {
        try { await loadScript(SDK + 'firebase-auth-compat.js'); } catch (e) { /* اختياري */ }
      }
      if (!window.firebase.apps.length) window.firebase.initializeApp(FIREBASE_CONFIG);
      db = window.firebase.firestore();

      if (db.enablePersistence) {
        try { await db.enablePersistence({ synchronizeTabs: true }); }
        catch (e) { /* متصفح غير مدعوم أو تبويبات متعددة */ }
      }
      if (window.firebase.auth && FIREBASE_CONFIG.useAnonymousAuth !== false) {
        try {
          auth = window.firebase.auth();
          await auth.signInAnonymously();
          state.authReady = true;
        } catch (e) {
          console.warn('[مفقودات شبوة] المصادقة المجهولة غير مفعّلة:', e && e.code);
          toast('لتفعيل النشر للجميع: شغّل «Anonymous» من Authentication', 'info', 8000);
        }
      }
      state.cloudMode = true;
      subscribeCloud();
      return true;
    } catch (e) {
      console.error(e);
      state.loading = false;
      render();
      showBanner({
        type: 'warn', icon: '#i-offline',
        message: 'تعذّر الاتصال بقاعدة البيانات المشتركة — تُعرض الإعلانات المحفوظة على جهازك.',
        actionText: 'إعادة المحاولة', onAction: () => location.reload()
      });
      return false;
    }
  }

  function subscribeCloud() {
    const col = db.collection(COLLECTION);
    if (unsubscribe) { try { unsubscribe(); } catch (e) {} }
    unsubscribe = col.orderBy('date', 'desc').limit(PAGE_SIZE).onSnapshot(snapshot => {
      state.cloud = snapshot.docs.map(d => normalizePost(Object.assign({ id: d.id }, d.data())));
      state.cloudHasMore = snapshot.size >= PAGE_SIZE;
      if (snapshot.docs.length) state.cloudCursor = snapshot.docs[snapshot.docs.length - 1];
      state.loading = false;
      const badge = $('#liveBadge');
      if (badge) badge.hidden = false;
      if (snapshot.size) safeSet(LS.cache, state.cloud.slice(0, 50));
      mergeAndRender();
    }, error => {
      console.error(error);
      state.loading = false;
      const denied = error && error.code === 'permission-denied';
      showBanner({
        type: 'warn', icon: '#i-shield',
        html: denied
          ? 'قاعدة البيانات ترفض الوصول. تأكد من نشر <b>قواعد الأمان</b> الصحيحة (راجع دليل التفعيل).'
          : 'تعذّرت المزامنة مع السحابة — تُعرض البيانات المحلية.',
        actionText: 'دليل التفعيل', onAction: () => window.open('FIREBASE-SETUP.html', '_blank')
      });
      mergeAndRender();
    });
  }

  async function fetchNextCloudPage() {
    if (!state.cloudMode || !state.cloudHasMore || !state.cloudCursor) return;
    try {
      const snap = await db.collection(COLLECTION)
        .orderBy('date', 'desc').startAfter(state.cloudCursor).limit(PAGE_SIZE).get();
      state.cloudMore = state.cloudMore.concat(snap.docs.map(d => normalizePost(Object.assign({ id: d.id }, d.data()))));
      if (snap.docs.length) state.cloudCursor = snap.docs[snap.docs.length - 1];
      state.cloudHasMore = snap.size >= PAGE_SIZE;
    } catch (e) {
      console.warn('تعذّر تحميل المزيد:', e);
      state.cloudHasMore = false;
      toast('تعذّر تحميل المزيد من الإعلانات', 'error');
    }
  }

  /* ===== 9) التخزين المحلي ===== */
  function loadLocal() {
    let list = safeGet(LS.posts, null);
    if (!list) {
      const legacy = safeGet(LS.legacy, null);
      if (Array.isArray(legacy) && legacy.length) { list = legacy; safeSet(LS.posts, legacy); }
    }
    state.local = (Array.isArray(list) ? list : []).map(p => normalizePost(Object.assign({ local: true }, p)));

    if (!hasFirebaseConfig) {
      const cache = safeGet(LS.cache, null);
      state.cache = Array.isArray(cache) ? cache.map(normalizePost) : [];
      if (state.demo) {
        const seen = {};
        state.local.concat(state.cache).forEach(p => { seen[p.id] = 1; });
        demoPosts().forEach(p => { if (!seen[p.id]) state.local.push(normalizePost(Object.assign({ local: true }, p))); });
      }
      if (state.local.length || state.cache.length) state.loading = false;
    }
  }

  function persistLocal() {
    if (safeSet(LS.posts, state.local)) return true;
    toast('مساحة التخزين على الجهاز ممتلئة — احذف بعض الإعلانات القديمة أو صورها.', 'error', 7000);
    return false;
  }

  function demoPosts() {
    const now = Date.now();
    return [
      { id: 'demo1', type: 'missing', title: 'جوال سامسونج A54 أسود', description: 'فقدت جوالي سامسونج لون أسود بكفر شفاف في سوق عتق المركزي، يحتوي على صور مهمة وشريحة. من يجده أرجو التواصل، وله مكافأة.', category: 'هواتف', location: 'سوق عتق المركزي', contactName: 'أحمد', contactPhone: '+967770123456', status: 'active', views: 128, date: new Date(now - 10800000).toISOString(), local: true },
      { id: 'demo2', type: 'found', title: 'محفظة جلدية بنية بها بطاقات', description: 'وجدت محفظة جلدية بنية قرب مسجد السلام بعد صلاة العصر، بداخلها بطاقات وهوية. الرجاء التواصل لاستلامها مع وصف المحفظة للتأكد.', category: 'محافظ ونقود', location: 'قرب مسجد السلام - عتق', contactName: 'محمد', contactPhone: '+967770987654', status: 'active', views: 74, date: new Date(now - 32400000).toISOString(), local: true },
      { id: 'demo3', type: 'missing', title: 'بطاقة هوية شخصية وكرت جامعي', description: 'فقدت بطاقة الهوية الشخصية مع الكرت الجامعي بين مسجد النور والسوق القديم. من يجدها يتفضل بالتواصل وشكراً جزيلاً.', category: 'مستندات', location: 'مسجد النور - عتق', contactName: 'سعيد', contactPhone: '+967770555123', status: 'active', views: 41, date: new Date(now - 86400000).toISOString(), local: true },
      { id: 'demo4', type: 'found', title: 'مفتاح سيارة تويوتا مع ميدالية', description: 'وجدت مفتاح سيارة تويوتا مع ميدالية جلدية في الشارع العام أمام الصيدلية. صاحبه يمكنه التواصل لاستلامه في أي وقت.', category: 'مفاتيح', location: 'الشارع العام - عتق', contactName: 'علي', contactPhone: '+967770456789', status: 'active', views: 33, date: new Date(now - 172800000).toISOString(), local: true },
      { id: 'demo5', type: 'missing', title: 'ساعة يد سوداء ماركة كاسيو', description: 'ساعة كاسيو سوداء بسوار معدني، فقدتها أثناء تنقلاتي بين حبان وعتق. من يجدها أرجو التواصل.', category: 'مجوهرات', location: 'طريق عتق - حبان', contactName: 'فهد', contactPhone: '+967770333222', status: 'returned', returnedDate: new Date(now - 259200000).toISOString(), views: 96, date: new Date(now - 518400000).toISOString(), local: true }
    ];
  }

  /* ===== 10) الدمج والتصفية ===== */
  function mergeAndRender() {
    const seen = {};
    const all = [];
    const sources = state.cloudMode ? state.cloud.concat(state.cloudMore, state.local) : state.cache.concat(state.local);
    sources.forEach(post => {
      if (!post || seen[post.id]) return;
      seen[post.id] = 1;
      all.push(Array.isArray(post.images) && Array.isArray(post.thumbs) ? post : normalizePost(post));
    });
    state.posts = all;
    render();
  }

  function matchesFilters(post) {
    if (state.filter === 'missing' && !(post.type === 'missing' && post.status !== 'returned')) return false;
    if (state.filter === 'found' && !(post.type === 'found' && post.status !== 'returned')) return false;
    if (state.filter === 'returned' && post.status !== 'returned') return false;
    if (state.filter === 'mine' && !isMine(post)) return false;
    if (state.filter === 'all' && post.status === 'returned') return false;
    if (state.category && post.category !== state.category) return false;
    if (state.terms.length) {
      const hay = normArabic([post.title, post.description, post.location, post.category, post.contactName].join(' '));
      for (let i = 0; i < state.terms.length; i++) if (hay.indexOf(state.terms[i]) === -1) return false;
    }
    return true;
  }

  function relevance(post) {
    if (!state.terms.length) return 0;
    const title = normArabic(post.title), desc = normArabic(post.description);
    let score = 0;
    state.terms.forEach(t => {
      if (title.indexOf(t) !== -1) score += 6;
      if (desc.indexOf(t) !== -1) score += 2;
    });
    return score;
  }

  function getFiltered() {
    const list = state.posts.filter(matchesFilters);
    list.sort((a, b) => {
      if (state.terms.length) {
        const r = relevance(b) - relevance(a);
        if (r !== 0) return r;
      }
      if (state.sort === 'views') return (b.views || 0) - (a.views || 0) || new Date(b.date) - new Date(a.date);
      if (state.sort === 'old') return new Date(a.date) - new Date(b.date);
      return new Date(b.date) - new Date(a.date);
    });
    return list;
  }

  /* ===== 11) الرسم ===== */
  function skeletons(count) {
    let html = '';
    for (let i = 0; i < count; i++) {
      html += '<div class="skeleton"><div class="sk-media"></div><div class="sk-line w60"></div><div class="sk-line"></div><div class="sk-line w40"></div></div>';
    }
    return html;
  }

  function cardHtml(post, index) {
    const images = post.images || [];
    const thumbs = post.thumbs || [];
    const thumb = thumbs[0] || images[0] || '';
    const media = thumb
      ? '<img src="' + escapeAttr(thumb) + '" alt="' + escapeAttr(post.title) + '" loading="lazy" decoding="async">'
      : '<div class="ph" data-g="' + catGradient(post.category) + '"><span aria-hidden="true">' + catIcon(post.category) + '</span></div>';

    const typeBadge = post.type === 'missing'
      ? '<span class="badge missing">🔴 مفقود</span>'
      : '<span class="badge found">🟢 موجود</span>';
    const secondBadge = post.status === 'returned'
      ? '<span class="badge returned">✅ تم الإرجاع</span>'
      : (isMine(post) ? '<span class="badge owner">إعلانك</span>' : (post.local && !state.cloudMode ? '<span class="badge local">محلي</span>' : ''));

    const phone = phoneInfo(post);
    const waBtn = phone
      ? '<button class="btn btn-wa btn-sm" type="button" data-action="wa" data-id="' + escapeAttr(post.id) + '" title="تواصل عبر واتساب" aria-label="تواصل عبر واتساب"><svg class="ic"><use href="#i-whatsapp"></use></svg></button>'
      : '';

    return '<article class="card' + (post.status === 'returned' ? ' is-returned' : '') + '" data-id="' + escapeAttr(post.id) + '" tabindex="0" role="button" aria-label="' + escapeAttr(post.title) + '" style="animation-delay:' + Math.min(index * 35, 300) + 'ms">' +
        '<div class="card-media">' + media +
          '<div class="card-badges"><span>' + typeBadge + '</span><span>' + secondBadge + '</span></div>' +
        '</div>' +
        '<div class="card-body">' +
          '<h3 class="card-title">' + escapeHtml(post.title) + '</h3>' +
          '<p class="card-desc">' + escapeHtml(post.description) + '</p>' +
          '<div class="card-tags">' +
            '<span class="tag">' + catIcon(post.category) + ' ' + escapeHtml(post.category) + '</span>' +
            (post.location ? '<span class="tag"><svg class="ic"><use href="#i-pin"></use></svg>' + escapeHtml(post.location) + '</span>' : '') +
          '</div>' +
          '<div class="card-foot">' +
            '<div class="card-meta">' +
              '<span><svg class="ic"><use href="#i-calendar"></use></svg>' + formatRelative(post.date) + '</span>' +
              '<span><svg class="ic"><use href="#i-eye"></use></svg>' + formatCount(post.views) + '</span>' +
            '</div>' +
            '<div class="card-actions">' + waBtn +
              '<button class="btn btn-ghost btn-sm" type="button" data-action="open" data-id="' + escapeAttr(post.id) + '">التفاصيل</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</article>';
  }

  function render() {
    const grid = $('#grid');
    const empty = $('#empty');
    const list = getFiltered();
    const shown = list.slice(0, state.visible);

    if (state.loading && !list.length) {
      grid.setAttribute('aria-busy', 'true');
      grid.innerHTML = skeletons(6);
      empty.hidden = true;
      $('#resultCount').textContent = 'جارٍ تحميل الإعلانات…';
      return;
    }
    grid.setAttribute('aria-busy', 'false');

    if (!shown.length) {
      grid.innerHTML = '';
      empty.hidden = false;
      const hasAny = state.posts.length > 0;
      $('#emptyTitle').textContent = hasAny ? 'لا نتائج مطابقة' : 'لا توجد إعلانات بعد';
      $('#emptyText').textContent = hasAny
        ? 'جرّب كلمات بحث أخرى، أو امسح الفلاتر لعرض كل الإعلانات.'
        : 'كن أول من ينشر إعلاناً عن مفقود أو موجود في شبوة.';
      $('#emptyReset').hidden = !hasAny;
    } else {
      empty.hidden = true;
      grid.innerHTML = shown.map(cardHtml).join('');
    }

    $('#resultCount').textContent = list.length + ' إعلان' + (shown.length < list.length ? ' — يتم عرض ' + shown.length : '');
    $('#loadMore').hidden = shown.length >= list.length;

    const titles = { all: 'أحدث الإعلانات', missing: 'الإعلانات المفقودة', found: 'الإعلانات الموجودة', returned: 'إعلانات تم إرجاعها', mine: 'إعلاناتي' };
    $('#listTitle').textContent = titles[state.filter] || 'الإعلانات';

    const stats = state.posts.reduce((acc, p) => {
      acc.total++;
      if (p.status === 'returned') acc.returned++;
      else if (p.type === 'missing') acc.missing++;
      else acc.found++;
      return acc;
    }, { total: 0, missing: 0, found: 0, returned: 0 });
    $('#statTotal').textContent = formatCount(stats.total);
    $('#statMissing').textContent = formatCount(stats.missing);
    $('#statFound').textContent = formatCount(stats.found);
    $('#statReturned').textContent = formatCount(stats.returned);

    const mineCount = state.posts.filter(isMine).length;
    const pill = $('#mineCount');
    if (pill) { pill.textContent = mineCount; pill.hidden = mineCount === 0; }

    $('#resetFilters').hidden = !(state.filter !== 'all' || state.category || state.query || state.sort !== 'new');
    renderCategoryOptions();
    syncUrl();
  }

  function renderCategoryOptions() {
    const select = $('#catFilter');
    if (!select) return;
    const cats = [];
    state.posts.forEach(p => { if (p.category && cats.indexOf(p.category) === -1) cats.push(p.category); });
    cats.sort();
    const html = '<option value="">كل التصنيفات</option>' + cats.map(c =>
      '<option value="' + escapeAttr(c) + '">' + catIcon(c) + ' ' + escapeHtml(c) + '</option>').join('');
    if (select.dataset.signature !== html) {
      select.dataset.signature = html;
      select.innerHTML = html;
    }
    select.value = state.category;
  }

  /* ===== 12) مزامنة الرابط ===== */
  function syncUrl() {
    if (state.detailId) return;
    const params = new URLSearchParams();
    if (state.query) params.set('q', state.query);
    if (state.filter !== 'all') params.set('f', state.filter);
    if (state.category) params.set('cat', state.category);
    if (state.sort !== 'new') params.set('sort', state.sort);
    const qs = params.toString();
    try { history.replaceState(history.state, '', location.pathname + (qs ? '?' + qs : '') + location.hash); }
    catch (e) {}
  }
  function removeUrlParam(key) {
    const params = new URLSearchParams(location.search);
    params.delete(key);
    const qs = params.toString();
    try { history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash); }
    catch (e) {}
  }
  function readUrl() {
    const params = new URLSearchParams(location.search);
    state.query = params.get('q') || '';
    const f = params.get('f');
    if (['all', 'missing', 'found', 'returned', 'mine'].indexOf(f) !== -1) state.filter = f;
    state.category = params.get('cat') || '';
    const s = params.get('sort');
    if (['new', 'old', 'views'].indexOf(s) !== -1) state.sort = s;
    state.demo = params.get('demo') === '1';
  }
  function setTermsFromQuery() {
    state.terms = normArabic(state.query).split(' ').filter(t => t.length > 1);
  }

  /* ===== 13) التفاصيل ===== */
  const findPost = id => state.posts.filter(p => String(p.id) === String(id))[0] || null;

  function openDetail(id, push) {
    const post = findPost(id);
    if (!post) { toast('لم يُعثر على الإعلان', 'error'); return; }
    state.detailId = String(id);
    registerView(post);

    const phone = phoneInfo(post);
    const badges = '<span class="badge ' + (post.type === 'missing' ? 'missing' : 'found') + '">' +
        (post.type === 'missing' ? '🔴 مفقود' : '🟢 موجود') + '</span>' +
      (post.status === 'returned' ? '<span class="badge returned">✅ تم الإرجاع</span>' : '') +
      (isMine(post) ? '<span class="badge owner">إعلانك</span>' : '');

    let gallery;
    if (post.images.length) {
      gallery = '<div class="gallery">' +
        '<div class="gallery-main"><img id="galMain" src="' + escapeAttr(post.images[0]) + '" alt="' + escapeAttr(post.title) + '"></div>' +
        (post.images.length > 1
          ? '<div class="gallery-thumbs">' + post.images.map((src, i) =>
              '<button type="button" data-action="gallery" data-i="' + i + '" data-id="' + escapeAttr(post.id) + '" class="' + (i === 0 ? 'is-active' : '') + '" aria-label="عرض الصورة ' + (i + 1) + '">' +
              '<img src="' + escapeAttr(src) + '" alt="" loading="lazy"></button>').join('') + '</div>'
          : '') +
        '</div>';
    } else {
      gallery = '<div class="gallery"><div class="ph" data-g="' + catGradient(post.category) + '" style="aspect-ratio:16/9"><span aria-hidden="true">' + catIcon(post.category) + '</span></div></div>';
    }

    const notice = post.status === 'returned'
      ? '<div class="notice"><svg class="ic"><use href="#i-check"></use></svg><span>تم إرجاع هذا الشيء لصاحبه بتاريخ ' + escapeHtml(formatDate(post.returnedDate || post.date)) + ' — شكراً لكل من ساهم.</span></div>'
      : '<div class="notice"><svg class="ic"><use href="#i-shield"></use></svg><span>للأمان: قابل الطرف في مكان عام، ولا تحوّل أي مبلغ مالي قبل معاينة الشيء.</span></div>';

    const contact = post.status === 'returned' ? '' :
      '<div class="contact-row split">' +
        (phone ? '<button class="btn btn-wa btn-lg" type="button" data-action="wa" data-id="' + escapeAttr(post.id) + '"><svg class="ic"><use href="#i-whatsapp"></use></svg> واتساب</button>' : '') +
        (phone ? '<button class="btn btn-success btn-lg" type="button" data-action="call" data-id="' + escapeAttr(post.id) + '"><svg class="ic"><use href="#i-phone"></use></svg> اتصال</button>' : '') +
      '</div>' +
      (phone ? '<div class="phone-reveal"><span>رقم التواصل: <b id="phoneValue">' + escapeHtml(maskPhone(phone)) + '</b></span>' +
        '<button class="link-btn" type="button" data-action="reveal-phone" data-id="' + escapeAttr(post.id) + '">إظهار الرقم</button></div>' : '');

    const shareBtn = '<button class="btn btn-ghost" type="button" data-action="share" data-id="' + escapeAttr(post.id) + '"><svg class="ic"><use href="#i-share"></use></svg> مشاركة</button>';
    const copyBtn = '<button class="btn btn-ghost" type="button" data-action="copy-phone" data-id="' + escapeAttr(post.id) + '"><svg class="ic"><use href="#i-copy"></use></svg> نسخ الرقم</button>';

    const actions = isMine(post)
      ? '<div class="mini-actions">' + shareBtn +
          '<button class="btn btn-ghost" type="button" data-action="edit" data-id="' + escapeAttr(post.id) + '"><svg class="ic"><use href="#i-edit"></use></svg> تعديل</button>' +
          (post.status !== 'returned' ? '<button class="btn btn-success" type="button" data-action="returned" data-id="' + escapeAttr(post.id) + '"><svg class="ic"><use href="#i-check"></use></svg> تم الإرجاع</button>' : '') +
          '<button class="btn btn-danger" type="button" data-action="delete" data-id="' + escapeAttr(post.id) + '"><svg class="ic"><use href="#i-trash"></use></svg> حذف</button>' +
        '</div>'
      : '<div class="mini-actions">' + shareBtn +
          (phone ? copyBtn : '') +
          '<button class="btn btn-ghost" type="button" data-action="report" data-id="' + escapeAttr(post.id) + '"><svg class="ic"><use href="#i-flag"></use></svg> إبلاغ</button>' +
        '</div>';

    const timeline = '<div class="timeline">' +
      '<div class="tl-item"><span class="tl-dot"></span><div><b>نُشر الإعلان</b><small>' + escapeHtml(formatDateTime(post.date)) + '</small></div></div>' +
      (post.eventDate ? '<div class="tl-item"><span class="tl-dot"></span><div><b>تاريخ الفقد/الوجدان</b><small>' + escapeHtml(formatDate(post.eventDate)) + '</small></div></div>' : '') +
      (post.status === 'returned' ? '<div class="tl-item ok"><span class="tl-dot"></span><div><b>تم الإرجاع لصاحبه</b><small>' + escapeHtml(formatDateTime(post.returnedDate || post.date)) + '</small></div></div>' : '') +
      '</div>';

    $('#detailBody').innerHTML =
      gallery +
      '<div class="detail-hero">' + badges + '</div>' +
      '<h3 class="detail-h">' + escapeHtml(post.title) + '</h3>' +
      '<p class="detail-desc">' + escapeHtml(post.description) + '</p>' +
      '<div class="facts">' +
        fact('#i-tag', 'التصنيف', catIcon(post.category) + ' ' + post.category) +
        fact('#i-pin', 'المكان', post.location || 'غير محدد') +
        fact('#i-user', 'صاحب الإعلان', post.contactName || '—') +
        fact('#i-eye', 'المشاهدات', formatCount(post.views) + ' مشاهدة') +
      '</div>' + timeline + notice + contact + actions;

    openModal('detailModal');

    if (push !== false) {
      pushedDetail = true;
      try { history.pushState({ post: post.id }, '', location.pathname + '?post=' + encodeURIComponent(post.id)); }
      catch (e) { pushedDetail = false; }
    }
  }

  function closeDetail() {
    const wasOpen = !$('#detailModal').hidden;
    state.detailId = null;
    closeModal('detailModal');
    if (!wasOpen) return;
    if (pushedDetail) {
      pushedDetail = false;
      suppressPop = true;
      try { history.back(); return; } catch (e) {}
    }
    removeUrlParam('post');
  }

  function fact(icon, label, value) {
    return '<div class="fact"><svg class="ic"><use href="' + icon + '"></use></svg><div><label>' + escapeHtml(label) + '</label><span>' + escapeHtml(value) + '</span></div></div>';
  }

  function registerView(post) {
    const seen = safeGet(LS.views, {});
    if (seen[post.id]) return;
    seen[post.id] = Date.now();
    safeSet(LS.views, seen);
    post.views = (post.views || 0) + 1;
    if (state.cloudMode && !post.local && !/^demo/.test(post.id)) {
      try {
        db.collection(COLLECTION).doc(post.id)
          .update({ views: window.firebase.firestore.FieldValue.increment(1) })
          .catch(() => {});
      } catch (e) { /* تجاهل */ }
    }
  }

  /* ===== 14) النموذج ===== */
  function resetForm() {
    const form = $('#postForm');
    form.reset();
    $('#editId').value = '';
    state.editingId = null;
    state.images = [];
    state.type = 'missing';
    selectType('missing');
    renderThumbs();
    $$('.field').forEach(f => f.classList.remove('has-error'));
    $$('.err').forEach(e => { e.textContent = ''; });
    $('#fCustomCat').hidden = true;
    $('#fCustomCat').value = '';
    $('#descCount').textContent = '0';
    $('#formTitle').textContent = 'إضافة إعلان جديد';
    $('#submitBtn').innerHTML = '<svg class="ic"><use href="#i-check"></use></svg> نشر الإعلان';
    const today = new Date().toISOString().slice(0, 10);
    $('#fDate').max = today;
    $('#fDate').value = today;

    const profile = safeGet(LS.profile, null);
    if (profile) {
      if (profile.name) $('#fName').value = profile.name;
      if (profile.phone) $('#fPhone').value = profile.phone;
    }
  }

  function selectType(type) {
    state.type = type;
    $$('.type-card').forEach(card => {
      const on = card.dataset.type === type;
      card.classList.toggle('is-active', on);
      card.setAttribute('aria-checked', on ? 'true' : 'false');
    });
  }

  function renderThumbs() {
    const box = $('#thumbs');
    if (!box) return;
    box.innerHTML = state.images.map((img, i) =>
      '<div class="thumb"><img src="' + escapeAttr(img.thumb || img.src) + '" alt="صورة ' + (i + 1) + '">' +
      '<button type="button" data-action="remove-image" data-i="' + i + '" aria-label="حذف الصورة"><svg class="ic"><use href="#i-close"></use></svg></button></div>').join('');
    const drop = $('#dropZone');
    if (drop) drop.style.display = state.images.length >= IMG.count ? 'none' : '';
  }

  function loadBitmap(file) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const fallback = function () {
        if (settled) return;
        const objectUrl = URL.createObjectURL(file);
        const img = new Image();
        img.onload = function () { settled = true; URL.revokeObjectURL(objectUrl); resolve(img); };
        img.onerror = function () { settled = true; URL.revokeObjectURL(objectUrl); reject(new Error('صيغة الصورة غير مدعومة')); };
        img.src = objectUrl;
      };
      if (window.createImageBitmap) {
        createImageBitmap(file, { imageOrientation: 'from-image' })
          .then(bitmap => { if (!settled) { settled = true; resolve(bitmap); } })
          .catch(fallback);
      } else { fallback(); }
    });
  }

  function encodeCanvas(source, maxDim, quality, maxBytes) {
    const sourceW = source.width || source.naturalWidth;
    const sourceH = source.height || source.naturalHeight;
    const scale = Math.min(1, maxDim / Math.max(sourceW, sourceH));
    const width = Math.max(1, Math.round(sourceW * scale));
    const height = Math.max(1, Math.round(sourceH * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, 0, 0, width, height);

    return new Promise(resolve => {
      let q = quality;
      const attempt = function () {
        if (!canvas.toBlob) {
          const dataUrl = canvas.toDataURL('image/jpeg', q);
          resolve({ dataUrl: dataUrl, size: Math.round(dataUrl.length * 0.75), width: width, height: height });
          return;
        }
        canvas.toBlob(function (blob) {
          if (blob && (blob.size <= maxBytes || q <= 0.45)) {
            const reader = new FileReader();
            reader.onload = () => resolve({ dataUrl: String(reader.result), size: blob.size, width: width, height: height });
            reader.readAsDataURL(blob);
          } else {
            q -= 0.1;
            attempt();
          }
        }, 'image/jpeg', q);
      };
      attempt();
    });
  }

  async function handleFiles(fileList) {
    const files = Array.prototype.slice.call(fileList || []);
    if (!files.length) return;
    if (state.images.length >= IMG.count) {
      toast('الحد الأقصى ' + IMG.count + ' صور — احذف صورة لإضافة أخرى', 'error');
      return;
    }

    const room = IMG.count - state.images.length;
    for (let i = 0; i < Math.min(files.length, room); i++) {
      const file = files[i];
      if (!/^image\//.test(file.type)) { toast('الملف المختار ليس صورة', 'error'); continue; }
      if (file.size > IMG.maxSource) { toast('حجم الصورة كبير جداً (الحد 12 ميجا)', 'error'); continue; }
      try {
        const source = await loadBitmap(file);
        const full = await encodeCanvas(source, IMG.maxDim, IMG.quality, IMG.maxBytes);
        const thumb = await encodeCanvas(source, IMG.thumbDim, IMG.thumbQuality, IMG.thumbBytes);
        const total = state.images.reduce((sum, im) => sum + (im.size || 0), 0) + full.size;
        if (total > IMG.totalBytes) { toast('بلغتَ الحد الأقصى لحجم الصور — جرّب صوراً أصغر', 'error', 5000); break; }
        state.images.push({ src: full.dataUrl, thumb: thumb.dataUrl, size: full.size });
        if (source.close) { try { source.close(); } catch (e) {} }
      } catch (e) {
        toast(e.message || 'تعذّر معالجة الصورة', 'error');
      }
    }
    renderThumbs();
  }

  function fieldError(name, message) {
    const errEl = document.querySelector('[data-err="' + name + '"]');
    const field = errEl ? errEl.closest('.field') : null;
    if (field) field.classList.toggle('has-error', !!message);
    if (errEl) errEl.textContent = message || '';
    return !message;
  }

  function validateForm() {
    const title = $('#fTitle').value.trim();
    const description = $('#fDesc').value.trim();
    const category = $('#fCategory').value === '__custom__' ? $('#fCustomCat').value.trim() : $('#fCategory').value;
    const location = $('#fLocation').value.trim();
    const contactName = $('#fName').value.trim();
    const phone = normalizePhone($('#fPhone').value);
    const eventDate = $('#fDate').value;

    let ok = true;
    ok = fieldError('fTitle', title.length < 4 ? 'اكتب عنواناً واضحاً (4 أحرف على الأقل)' : '') && ok;
    ok = fieldError('fDesc', description.length < 12 ? 'اكتب وصفاً أوضح (12 حرفاً على الأقل)' : '') && ok;
    ok = fieldError('fCategory', !category ? 'اختر التصنيف' : '') && ok;
    ok = fieldError('fLocation', location.length < 2 ? 'اكتب المكان' : '') && ok;
    ok = fieldError('fName', contactName.length < 2 ? 'اكتب اسمك' : '') && ok;
    ok = fieldError('fPhone', !phone ? 'رقم غير صحيح — مثال: 77XXXXXXX أو +967…' : '') && ok;
    ok = fieldError('fDate', (eventDate && new Date(eventDate) > new Date(Date.now() + 86400000)) ? 'التاريخ في المستقبل؟' : '') && ok;
    const agreed = state.editingId || $('#fAgree').checked;
    ok = fieldError('fAgree', agreed ? '' : 'يجب الموافقة على النشر') && ok;

    if (!ok) {
      const first = $('.field.has-error');
      if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
      toast('راجع الحقول المظللة بالأحمر', 'error');
      return null;
    }

    return {
      type: state.type,
      title: title,
      description: description,
      category: category,
      location: location,
      contactName: contactName,
      contactPhone: phone.intl,
      contactPref: $('#fPref').value,
      eventDate: eventDate || ''
    };
  }

  async function submitForm(event) {
    event.preventDefault();
    const data = validateForm();
    if (!data) return;

    const btn = $('#submitBtn');
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<svg class="ic spin"><use href="#i-refresh"></use></svg> جارٍ الحفظ…';

    try {
      const images = state.images.map(i => i.src);
      const thumbs = state.images.map(i => i.thumb);

      if (state.editingId) {
        await updatePost(state.editingId, Object.assign({}, data, { images: images, thumbs: thumbs }));
        toast('تم تحديث الإعلان بنجاح', 'success');
      } else {
        const post = Object.assign({
          id: String(Date.now()) + Math.random().toString(36).slice(2, 6),
          images: images,
          thumbs: thumbs,
          status: 'active',
          views: 0,
          date: new Date().toISOString(),
          ownerId: (state.authReady && auth && auth.currentUser) ? auth.currentUser.uid : deviceId
        }, data);
        await savePost(post);
      }

      safeSet(LS.profile, { name: data.contactName, phone: data.contactPhone });
      closeModal('formModal');
      resetForm();
    } catch (e) {
      console.error(e);
      toast(e.message || 'تعذّر الحفظ، حاول مرة أخرى', 'error', 6000);
    } finally {
      btn.disabled = false;
      btn.innerHTML = original;
    }
  }

  /* ===== 15) عمليات البيانات ===== */
  function sanitizeForCloud(post) {
    const out = {};
    Object.keys(post).forEach(key => {
      if (key === 'local' || key === 'updatedAt') return;
      if (typeof post[key] === 'undefined') return;
      out[key] = post[key];
    });
    return out;
  }

  async function savePost(post) {
    if (myIds.indexOf(String(post.id)) === -1) { myIds.push(String(post.id)); safeSet(LS.mine, myIds); }
    state.local.unshift(normalizePost(Object.assign({ local: true }, post)));
    persistLocal();
    mergeAndRender();

    if (!state.cloudMode) {
      toast('تم نشر إعلانك على هذا الجهاز ✓', 'success');
      return;
    }
    try {
      await db.collection(COLLECTION).doc(post.id).set(sanitizeForCloud(post));
      state.local = state.local.filter(p => String(p.id) !== String(post.id));
      persistLocal();
      mergeAndRender();
      toast('تم نشر إعلانك بنجاح ✓ وظهر للجميع', 'success');
    } catch (e) {
      console.error(e);
      toast('حُفظ الإعلان على جهازك فقط — تعذّرت المزامنة مع السحابة', 'error', 6000);
    }
  }

  async function updatePost(id, patch) {
    const localIndex = state.local.map(p => String(p.id)).indexOf(String(id));
    if (localIndex !== -1) {
      state.local[localIndex] = normalizePost(Object.assign({}, state.local[localIndex], patch, { local: true }));
      persistLocal();
    }
    const cloudIndex = state.cloud.map(p => String(p.id)).indexOf(String(id));
    if (cloudIndex !== -1) state.cloud[cloudIndex] = normalizePost(Object.assign({}, state.cloud[cloudIndex], patch));
    mergeAndRender();

    if (state.cloudMode && cloudIndex !== -1) {
      try { await db.collection(COLLECTION).doc(String(id)).update(sanitizeForCloud(patch)); }
      catch (e) { console.error(e); toast('تعذّرت مزامنة التعديل مع السحابة', 'error'); }
    }
  }

  async function removePost(id) {
    state.local = state.local.filter(p => String(p.id) !== String(id));
    persistLocal();
    myIds = myIds.filter(x => x !== String(id));
    safeSet(LS.mine, myIds);
    state.cloud = state.cloud.filter(p => String(p.id) !== String(id));
    state.cloudMore = state.cloudMore.filter(p => String(p.id) !== String(id));
    mergeAndRender();

    if (state.cloudMode) {
      try { await db.collection(COLLECTION).doc(String(id)).delete(); }
      catch (e) { console.error(e); toast('تعذّر حذف الإعلان من السحابة', 'error'); }
    }
  }

  /* ===== 16) المشاركة والتواصل ===== */
  const postUrl = id => location.origin + location.pathname + '?post=' + encodeURIComponent(id);

  function shareText(post) {
    return (post.type === 'missing' ? 'مفقود: ' : 'موجود: ') + post.title + '\n' +
      post.description.slice(0, 140) + '\n' +
      (post.location ? '📍 ' + post.location + '\n' : '') +
      'عبر منصة مفقودات شبوة';
  }

  async function sharePost(post) {
    const url = postUrl(post.id);
    if (navigator.share) {
      try { await navigator.share({ title: post.title, text: shareText(post), url: url }); return; }
      catch (e) { if (e && e.name === 'AbortError') return; }
    }
    copyText(url, 'تم نسخ رابط الإعلان — شاركه في مجموعاتك');
  }

  function copyText(text, message) {
    const done = () => toast(message || 'تم النسخ', 'success');
    const fallback = function () {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { toast('تعذّر النسخ تلقائياً', 'error'); }
      ta.remove();
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(fallback);
    } else { fallback(); }
  }

  function openWhatsApp(post) {
    const phone = phoneInfo(post);
    if (!phone) { toast('رقم التواصل غير صالح', 'error'); return; }
    const message = 'مرحباً ' + post.contactName + '،\n' +
      'بخصوص إعلانك على «مفقودات شبوة»:\n' + post.title + '\n' +
      (post.type === 'missing' ? '(إعلان فقدان)' : '(شيء وجدته)') + '\n\n' +
      'رابط الإعلان:\n' + postUrl(post.id) + '\n\n' +
      'معك من المنصة 🌿';
    window.open('https://wa.me/' + phone.wa + '?text=' + encodeURIComponent(message), '_blank', 'noopener');
  }

  /* ===== 17) الإبلاغ ===== */
  let reportId = null;
  function openReport(id) {
    reportId = id;
    $('#reportForm').reset();
    openModal('reportModal');
  }
  function submitReport(event) {
    event.preventDefault();
    const post = findPost(reportId);
    if (!post) { closeModal('reportModal'); return; }
    const report = {
      postId: String(post.id),
      postTitle: post.title.slice(0, 90),
      reason: $('#reportReason').value,
      note: $('#reportNote').value.trim().slice(0, 300),
      date: new Date().toISOString(),
      by: deviceId
    };
    const list = safeGet(LS.reports, []);
    list.push(report);
    safeSet(LS.reports, list.slice(-100));

    if (state.cloudMode) {
      try {
        db.collection(REPORTS).add(Object.assign({}, report, {
          by: (state.authReady && auth && auth.currentUser) ? auth.currentUser.uid : deviceId
        })).catch(() => {});
      } catch (e) { /* محفوظ محلياً */ }
    }
    closeModal('reportModal');
    toast('تم إرسال البلاغ، شكراً لمساعدتك في تنقية المنصة 🙏', 'success', 4500);
  }

  /* ===== 18) الإجراءات ===== */
  function handleAction(action, el) {
    const id = el.getAttribute('data-id');
    const post = id ? findPost(id) : null;

    switch (action) {
      case 'home': location.href = location.pathname; break;
      case 'open-add': resetForm(); openModal('formModal'); break;
      case 'close-modal': {
        const overlay = el.closest('.overlay');
        if (overlay && overlay.id === 'detailModal') closeDetail();
        else closeModal(overlay);
        break;
      }
      case 'dismiss-banner': hideBanner(); break;
      case 'filter-mine': setFilter(state.filter === 'mine' ? 'all' : 'mine'); break;
      case 'clear-q': {
        const input = $('#q');
        input.value = ''; state.query = ''; state.terms = []; state.visible = PAGE_SIZE;
        $('#clearQ').hidden = true;
        render(); input.focus();
        break;
      }
      case 'reset-filters': resetFilters(); break;
      case 'open-about': openModal('aboutModal'); break;
      case 'open': openDetail(id); break;
      case 'wa': if (post) openWhatsApp(post); break;
      case 'call': {
        if (!post) break;
        const info = phoneInfo(post);
        if (info) location.href = 'tel:' + info.intl;
        break;
      }
      case 'copy-phone': {
        if (!post) break;
        const info = phoneInfo(post);
        if (info) copyText(info.intl, 'تم نسخ رقم التواصل: ' + info.pretty);
        break;
      }
      case 'reveal-phone': {
        if (!post) break;
        const info = phoneInfo(post);
        const value = $('#phoneValue');
        if (info && value) value.textContent = info.pretty;
        el.remove();
        break;
      }
      case 'share': if (post) sharePost(post); break;
      case 'edit': if (post) startEdit(post); break;
      case 'delete': if (post) askDelete(post); break;
      case 'returned': if (post) askReturned(post); break;
      case 'report': if (post) openReport(post.id); break;
      case 'gallery': {
        if (!post) break;
        const main = $('#galMain');
        const src = post.images[Number(el.dataset.i)];
        if (main && src) main.src = src;
        $$('.gallery-thumbs button').forEach(b => b.classList.remove('is-active'));
        el.classList.add('is-active');
        break;
      }
      case 'remove-image': state.images.splice(Number(el.dataset.i), 1); renderThumbs(); break;
      case 'install': promptInstall(); break;
      default: break;
    }
  }

  function setFilter(filter) {
    state.filter = filter;
    state.visible = PAGE_SIZE;
    $$('.chip').forEach(c => c.classList.toggle('is-active', c.dataset.filter === filter));
    render();
  }

  function resetFilters() {
    state.filter = 'all'; state.category = ''; state.query = ''; state.terms = [];
    state.sort = 'new'; state.visible = PAGE_SIZE;
    $('#q').value = ''; $('#sort').value = 'new'; $('#catFilter').value = '';
    $('#clearQ').hidden = true;
    $$('.chip').forEach(c => c.classList.toggle('is-active', c.dataset.filter === 'all'));
    render();
  }

  function startEdit(post) {
    closeDetail();
    resetForm();
    state.editingId = post.id;
    $('#formTitle').textContent = 'تعديل الإعلان';
    $('#editId').value = post.id;
    $('#fTitle').value = post.title;
    $('#fDesc').value = post.description;
    $('#descCount').textContent = post.description.length;
    $('#fLocation').value = post.location;
    $('#fName').value = post.contactName;
    $('#fPhone').value = post.contactPhone;
    $('#fPref').value = post.contactPref || 'whatsapp';
    $('#fDate').value = post.eventDate ? String(post.eventDate).slice(0, 10) : '';

    const known = $$('#fCategory option').map(o => o.value);
    if (known.indexOf(post.category) !== -1) {
      $('#fCategory').value = post.category;
      $('#fCustomCat').hidden = true;
    } else {
      $('#fCategory').value = '__custom__';
      $('#fCustomCat').value = post.category;
      $('#fCustomCat').hidden = false;
    }

    state.images = post.images.map((src, i) => ({ src: src, thumb: post.thumbs[i] || src, size: 0 }));
    renderThumbs();
    selectType(post.type);
    $('#fAgree').checked = true;
    $('#submitBtn').innerHTML = '<svg class="ic"><use href="#i-check"></use></svg> حفظ التعديلات';
    openModal('formModal');
  }

  async function askDelete(post) {
    const yes = await confirmDialog({
      icon: '🗑', title: 'حذف الإعلان',
      text: 'سيُحذف الإعلان نهائياً ولا يمكن التراجع عن ذلك.',
      yesText: 'حذف نهائي', noText: 'إلغاء'
    });
    if (!yes) return;
    await removePost(post.id);
    closeDetail();
    toast('تم حذف الإعلان', 'success');
  }

  async function askReturned(post) {
    const yes = await confirmDialog({
      icon: '✅', title: 'تأكيد الإرجاع',
      text: 'سيُعلَّم الإعلان كـ«تم الإرجاع» ويظهر للجميع أن الأمانة وصلت لصاحبها.',
      yesText: 'نعم، تم الإرجاع', danger: false
    });
    if (!yes) return;
    await updatePost(post.id, { status: 'returned', returnedDate: new Date().toISOString() });
    closeDetail();
    toast('تم تسجيل الإرجاع، جزاك الله خيراً 🌿', 'success');
  }

  /* ===== 19) PWA ===== */
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

  function setupInstall() {
    const btn = $('#installBtn');
    if (!btn || isStandalone()) return;
    if (isIOS) btn.hidden = false;
    window.addEventListener('beforeinstallprompt', event => {
      event.preventDefault();
      installPrompt = event;
      btn.hidden = false;
    });
    window.addEventListener('appinstalled', () => {
      installPrompt = null;
      btn.hidden = true;
      toast('تم تثبيت التطبيق على جهازك 🎉', 'success');
    });
  }

  async function promptInstall() {
    if (installPrompt) {
      installPrompt.prompt();
      try {
        const choice = await installPrompt.userChoice;
        if (choice && choice.outcome === 'accepted') toast('جارٍ تثبيت التطبيق…', 'success');
      } catch (e) {}
      installPrompt = null;
      return;
    }
    if (isIOS) toast('للتثبيت: اضغط زر المشاركة ⤴ ثم «إضافة إلى الشاشة الرئيسية»', 'info', 8000);
    else toast('من قائمة المتصفح اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية»', 'info', 7000);
  }

  function setupServiceWorker() {
    if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
    const hadController = !!navigator.serviceWorker.controller;

    navigator.serviceWorker.register('sw.js').then(registration => {
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            showBanner({
              type: 'success', icon: '#i-sparkle',
              message: 'يتوفر إصدار جديد من التطبيق.',
              actionText: 'تحديث الآن',
              onAction: () => {
                userRequestedUpdate = true;
                worker.postMessage({ type: 'SKIP_WAITING' });
              }
            });
          }
        });
      });
    }).catch(error => console.warn('تعذّر تسجيل العامل المخدوم:', error));

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (userRequestedUpdate || hadController) location.reload();
    });
  }

  function setupConnection() {
    const update = function () {
      const offline = !navigator.onLine;
      document.body.classList.toggle('offline-mode', offline);
      if (offline) {
        showBanner({ type: 'offline', icon: '#i-offline', message: 'أنت غير متصل بالإنترنت — تُعرض الإعلانات المحفوظة على جهازك.' });
      } else {
        const banner = $('#banner');
        if (banner && !banner.hidden && banner.classList.contains('offline')) {
          hideBanner();
          toast('تم استعادة الاتصال', 'success');
        }
      }
    };
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    update();
  }

  function checkConfigBanner() {
    if (hasFirebaseConfig || state.demo) return;
    showBanner({
      type: 'warn', icon: '#i-shield',
      html: 'وضع محلي: الإعلانات تُحفظ على هذا الجهاز فقط، لأن قاعدة البيانات المشتركة غير مُفعّلة بعد.',
      actionText: 'طريقة التفعيل',
      onAction: () => window.open('FIREBASE-SETUP.html', '_blank')
    });
  }

  /* ===== 20) ربط الأحداث ===== */
  function bind() {
    document.addEventListener('click', function (event) {
      const actionEl = event.target.closest('[data-action]');
      if (actionEl) { handleAction(actionEl.dataset.action, actionEl); return; }

      const filterEl = event.target.closest('[data-filter]');
      if (filterEl) { setFilter(filterEl.dataset.filter); return; }

      const card = event.target.closest('.card[data-id]');
      if (card) openDetail(card.dataset.id);
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' && event.target.classList && event.target.classList.contains('card')) {
        openDetail(event.target.dataset.id);
      }
    });

    // البحث
    const search = $('#q');
    if (search) {
      search.value = state.query;
      $('#clearQ').hidden = !state.query;
      const run = debounce(function () {
        state.query = search.value.trim();
        setTermsFromQuery();
        state.visible = PAGE_SIZE;
        render();
      }, 220);
      search.addEventListener('input', function () {
        run();
        $('#clearQ').hidden = !search.value;
      });
    }

    // الترتيب والتصنيف
    const sortSelect = $('#sort');
    if (sortSelect) {
      sortSelect.value = state.sort;
      sortSelect.addEventListener('change', () => { state.sort = sortSelect.value; state.visible = PAGE_SIZE; render(); });
    }
    const catSelect = $('#catFilter');
    if (catSelect) catSelect.addEventListener('change', () => { state.category = catSelect.value; state.visible = PAGE_SIZE; render(); });

    // تحميل المزيد
    const more = $('#loadMore');
    if (more) more.addEventListener('click', async function () {
      more.disabled = true;
      state.visible += PAGE_SIZE;
      await fetchNextCloudPage();
      render();
      more.disabled = false;
    });

    // النموذج
    const form = $('#postForm');
    if (form) form.addEventListener('submit', submitForm);
    $$('.type-card').forEach(card => card.addEventListener('click', () => selectType(card.dataset.type)));

    const categorySelect = $('#fCategory');
    if (categorySelect) categorySelect.addEventListener('change', function () {
      const custom = this.value === '__custom__';
      $('#fCustomCat').hidden = !custom;
      if (custom) $('#fCustomCat').focus();
      fieldError('fCategory', '');
    });

    const desc = $('#fDesc');
    if (desc) desc.addEventListener('input', () => { $('#descCount').textContent = desc.value.length; });

    ['fTitle', 'fDesc', 'fLocation', 'fName', 'fPhone', 'fCustomCat'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', () => fieldError(id, ''));
    });

    const fileInput = $('#fImages');
    if (fileInput) fileInput.addEventListener('change', function () { handleFiles(this.files); this.value = ''; });

    const drop = $('#dropZone');
    if (drop) {
      ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('is-over'); }));
      ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('is-over'); }));
      drop.addEventListener('drop', e => { if (e.dataTransfer && e.dataTransfer.files) handleFiles(e.dataTransfer.files); });
    }

    const reportForm = $('#reportForm');
    if (reportForm) reportForm.addEventListener('submit', submitReport);

    // الإغلاق: خلفية + ESC + حصر التركيز
    $$('.overlay').forEach(overlay => overlay.addEventListener('click', function (event) {
      if (event.target !== overlay) return;
      if (overlay.id === 'detailModal') closeDetail();
      else closeModal(overlay);
    }));

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        const open = $$('.overlay').filter(o => !o.hidden);
        if (open.length) {
          const top = open[open.length - 1];
          if (top.id === 'detailModal') closeDetail(); else closeModal(top);
        }
      }
      if (event.key === 'Tab') {
        const open = $$('.overlay').filter(o => !o.hidden);
        if (!open.length) return;
        const overlay = open[open.length - 1];
        const items = $$('a[href], button:not([disabled]), input:not([type=hidden]):not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])', overlay)
          .filter(el => el.offsetParent !== null);
        if (!items.length) return;
        const first = items[0], last = items[items.length - 1];
        if (event.shiftKey && (document.activeElement === first || !overlay.contains(document.activeElement))) {
          event.preventDefault(); last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault(); first.focus();
        }
      }
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName || '');
      if (!typing && (event.key === '/' || ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k'))) {
        event.preventDefault();
        const input = $('#q');
        if (input) { input.focus(); input.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
      }
    });

    // زر الصعود
    const toTop = $('#toTop');
    if (toTop) {
      toTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
      window.addEventListener('scroll', () => { toTop.hidden = window.scrollY < 700; }, { passive: true });
    }

    const bannerBtn = $('#bannerAction');
    if (bannerBtn) bannerBtn.addEventListener('click', () => { if (bannerHandler) bannerHandler(); });

    // أزرار الإحصاءات
    $$('.stat[data-filter]').forEach(btn => btn.addEventListener('click', () => setFilter(btn.dataset.filter)));

    // التنقل في السجل
    window.addEventListener('popstate', function () {
      if (suppressPop) { suppressPop = false; return; }
      const params = new URLSearchParams(location.search);
      const postId = params.get('post');
      if (postId) { if (findPost(postId)) openDetail(postId, false); }
      else if (state.detailId) { pushedDetail = false; state.detailId = null; closeModal('detailModal'); }
    });

    // مزامنة بين التبويبات
    window.addEventListener('storage', event => {
      if (event.key === LS.posts) {
        loadLocal();
        mergeAndRender();
      }
    });
  }

  /* ===== 21) التشغيل ===== */
  async function init() {
    readUrl();

    const yearEl = $('#year');
    if (yearEl) yearEl.textContent = String(new Date().getFullYear());
    const verEl = $('#appVersion');
    if (verEl) verEl.textContent = 'v' + APP_VERSION + (state.demo ? ' · وضع العرض' : '');

    setTermsFromQuery();
    if (state.filter !== 'all') $$('.chip').forEach(c => c.classList.toggle('is-active', c.dataset.filter === state.filter));

    initTheme();
    bind();
    setupInstall();
    setupServiceWorker();
    setupConnection();

    loadLocal();
    mergeAndRender();
    checkConfigBanner();

    if (hasFirebaseConfig) {
      const ok = await initCloud();
      if (!ok) { state.loading = false; mergeAndRender(); checkConfigBanner(); }
      // في حال بطء الشبكة: لا تُترك الهياكل ظاهرة للأبد
      setTimeout(() => {
        if (state.loading) {
          state.loading = false;
          mergeAndRender();
          toast('المزامنة تتأخر… تُعرض البيانات المتاحة حالياً', 'info', 4000);
        }
      }, CLOUD_TIMEOUT);
    } else {
      state.loading = false;
      mergeAndRender();
    }

    // إعلان من رابط مباشر
    const deepId = new URLSearchParams(location.search).get('post');
    if (deepId) {
      let tries = 0;
      const timer = setInterval(() => {
        tries++;
        if (findPost(deepId) || tries > 24) {
          clearInterval(timer);
          if (findPost(deepId)) openDetail(deepId, false);
          else toast('الإعلان المطلوب غير موجود أو تم حذفه', 'error');
        }
      }, 250);
    }

    // فتح نموذج الإضافة من اختصارات التطبيق المثبّت
    if (new URLSearchParams(location.search).get('action') === 'add') {
      setTimeout(() => { resetForm(); openModal('formModal'); }, 350);
    }

    // تحديث التوقيت النسبي كل دقيقة دون إعادة الحركات
    setInterval(() => {
      if (state.detailId || document.hidden) return;
      const grid = $('#grid');
      if (grid) grid.classList.add('no-anim');
      render();
    }, 60000);

    // تنظيف الإعلانات المحلية القديمة جداً (أكثر من سنة)
    try {
      const yearAgo = Date.now() - 365 * 86400000;
      const kept = state.local.filter(p => new Date(p.date).getTime() > yearAgo || p.status !== 'returned');
      if (kept.length !== state.local.length) { state.local = kept; persistLocal(); }
    } catch (e) {}
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  // واجهة مختصرة للاختبار والتصحيح
  window.MSS = {
    version: APP_VERSION,
    state: state,
    normalizePhone: normalizePhone,
    normArabic: normArabic,
    isMine: isMine,
    findPost: findPost,
    openDetail: openDetail,
    closeDetail: closeDetail,
    toast: toast
  };
})();
