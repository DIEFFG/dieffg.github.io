/* The ONLY settings file you edit in the web folder.
   Nothing secret goes in here: only the public web-app address and the public Firebase "web app" settings. */
window.CHURCH_CONFIG = {
  // Paste the Apps Script "Web app" URL that ends in /exec  (deployment guide, step 9)
  API_URL: 'https://script.google.com/macros/s/AKfycbya-d42b5a7KZ7A0UgXSPFohZI4_n-5RqILqeeZlmbTdUQfr2vrtV9FdmWnMOC2ey62/exec',

  // Public Firebase web-app settings (deployment guide, steps 11 and 12). Leave blank to run without push alerts.
  firebase: { apiKey: 'AIzaSyAIrFZ2bi7ZOxV6npc12_d3ebduCDtGoIA', authDomain: 'tcs-app-f5dd4.firebaseapp.com', projectId: 'tcs-app-f5dd4', messagingSenderId: '775499375756', appId: '1:775499375756:web:ae6f4b8a63cf27096447a9' },
  vapidKey: 'BG0QapQVvuMoLVZhYfB0yP9enTiRyTYvFE7nN8fV2EdCm69tWNFxtqGh7v9DRtguCfYq6mjfJo73sOpwCq5aIhk',

  // Where the app lives on GitHub Pages
  appPath: '/church/'
};
