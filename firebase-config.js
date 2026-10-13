/* ==========================================================================
   إعدادات Firebase — ملف التهيئة الوحيد الذي تحتاج لتعديله
   ==========================================================================

   خطوات التفعيل (5 دقائق تقريباً):
   1) اذهب إلى: https://console.firebase.google.com  ثم «Create project»
   2) من القائمة الجانبية: Build > Authentication > Sign-in method
      فعّل خيار «Anonymous» (المصادقة المجهولة) — بدونها لا يمكن حماية الإعلانات.
   3) من القائمة الجانبية: Build > Firestore Database > Create database
      اختر «Start in production mode» ثم أنشئ قاعدة البيانات.
   4) من تبويب Rules في Firestore: انسخ محتوى الملف firestore.rules والصقه ثم Publish.
   5) من Project settings > General > Your apps > Web (</>) أضف تطبيقاً وانسخ القيم
      واستبدل القيم التالية (YOUR_...) بقيمك الحقيقية، ثم ارفع الملف.

   ملاحظة: هذه القيم عامة بطبيعتها (تُرسل للمتصفح)، والحماية الحقيقية تتم عبر
   قواعد الأمان في firestore.rules وليس بإخفاء هذه المفاتيح.
   ========================================================================== */

const FIREBASE_CONFIG = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",

  // اتركها true لتفعيل تسجيل الدخول المجهول تلقائياً (يُنصح بشدة).
  // يجعل كل جهاز «مالكاً» لإعلاناته فقط، فلا يستطيع أحد حذف إعلان غيره.
  useAnonymousAuth: true
};

/* ---------------------------------------------------------------------------
   لا حاجة لتعديل ما بعد هذا السطر:
   يكتشف الملف تلقائياً ما إذا كانت القيم مُعدّة أم لا.
   عند عدم الإعداد يعمل التطبيق في «الوضع المحلي» (التخزين على الجهاز فقط).
--------------------------------------------------------------------------- */
const FIREBASE_ENABLED = (function () {
  try {
    const placeholders = ['YOUR_API_KEY', 'YOUR_PROJECT_ID', 'YOUR_APP_ID'];
    return !!(FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.projectId &&
      placeholders.indexOf(FIREBASE_CONFIG.apiKey) === -1 &&
      String(FIREBASE_CONFIG.projectId).indexOf('YOUR_') === -1);
  } catch (e) {
    return false;
  }
})();

if (!FIREBASE_ENABLED) {
  console.warn('[مفقودات شبوة] قاعدة البيانات المشتركة غير مُفعّلة — راجع FIREBASE-SETUP.html');
}
