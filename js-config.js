// Uygulama yapılandırması. Yayın öncesi değiştirilecek tek yer burasıdır.

export const APP = {
  name: 'Vekto',
  version: '1.0.0',
  privacyUrl: '', // Play Console için gizlilik politikası adresi (yayın öncesi doldurulacak)
};

// Global lig (Firebase Firestore + anonim giriş). Boşsa lig gizlenir, oyun yine çalışır.
export const FIREBASE = {
  apiKey: 'AIzaSyCIy9CO42XkWIhpDkkl7h3SOwjuW-enDLI',
  projectId: 'vekto-lig',
};
