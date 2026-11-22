// web/tracking.js
(function () {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token') || 'demo';

  console.log('[FurgoKid Web Tracking] Initialized with share token:', token);

  function shareWhatsApp() {
    const currentUrl = window.location.href;
    const text = `🚌 *FurgoKid - Seguimiento en Vivo*\n\nSigue el recorrido de la furgoneta escolar en tiempo real sin instalar la app:\n\n👉 ${currentUrl}`;
    const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
  }

  window.shareWhatsApp = shareWhatsApp;
})();
