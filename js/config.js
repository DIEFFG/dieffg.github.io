/* RECON front-end configuration — edit these values after deployment (see README). */
(typeof self !== 'undefined' ? self : window).RECON_CONFIG = {
  // Apps Script Web App URL ending in /exec  (Deploy > Web app > Anyone)
  API_URL: 'https://script.google.com/macros/s/AKfycbzhuJ-3Z1Yc0ys2jk4P_N1oVPKxrq7xswPCc6_lSDbtsOxgcOAqIb-hk6BeqHZuYyeF/exec',
  // Firebase web app config (Firebase console > Project settings > Your apps > Web)
  FIREBASE: {
    apiKey: 'AIzaSyC6MTz1fqb_2aJaBN9D_aRvZFppduG4o9Q', authDomain: 'recon-41ece.firebaseapp.com', projectId: 'recon-41ece', storageBucket: 'recon-41ece.firebasestorage.app', messagingSenderId: '886297879332', appId: '1:886297879332:web:f2737ed361c56c58f249b1'
  },
  // Firebase console > Project settings > Cloud Messaging > Web Push certificates > Key pair
  VAPID_KEY: 'BH7Kbk5q5QoFTKqhvMhInGRUj0TmsKiy7WgS38oYUPcsT8GY3bAVaDFA5PHagOmzVdHDctZ9zPOmlisjZzPkqIM',
  APP_VERSION: '21.0.0'
};
