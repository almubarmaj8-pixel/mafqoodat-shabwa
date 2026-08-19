// ===== إعدادات Firebase =====
// لتفعيل قاعدة البيانات المشتركة:
// 1. اذهب إلى https://console.firebase.google.com
// 2. أنشئ مشروعاً جديداً (Create Project)
// 3. من القائمة: Build > Firestore Database > Create Database > Start in test mode
// 4. من الإعدادات: Project Settings > Add app > Web (</>)
// 5. انسخ بيانات التطبيق واستبدلها أدناه

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

let db = null;
let firebaseReady = false;

try {
  if (typeof firebase !== 'undefined' && firebaseConfig.apiKey !== "YOUR_API_KEY") {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    firebaseReady = true;
    console.log('Firebase متصل - الإعلانات مشتركة بين كل المستخدمين');
  } else {
    console.warn('Firebase غير مُعد - البيانات محلية فقط. راجع firebase-config.js');
  }
} catch(e) {
  console.error('خطأ Firebase:', e);
}
