// web/tracking.js
(function () {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');

  const liveBadge = document.getElementById('liveBadge');
  const schoolSubtitle = document.getElementById('schoolSubtitle');
  const tripStatus = document.getElementById('tripStatus');
  const lastUpdated = document.getElementById('lastUpdated');
  const passengerSummary = document.getElementById('passengerSummary');

  if (!token) {
    if (liveBadge) {
      liveBadge.textContent = 'ERROR';
      liveBadge.style.background = '#FFEBEE';
      liveBadge.style.color = '#C62828';
    }
    if (tripStatus) tripStatus.textContent = 'Enlace no válido (falta token)';
    return;
  }

  console.log('[FurgoKid Web Tracking] Initialized with share token:', token);

  // In production, tracking.html connects to Firebase Functions HTTP endpoint or client SDK
  // Here we simulate snapshot fetch or gracefully handle token states
  if (tripStatus) tripStatus.textContent = 'Conectando con servidor seguro...';

  function shareWhatsApp() {
    const currentUrl = window.location.href;
    const text = `🚌 *FurgoKid - Seguimiento en Vivo*\n\nSigue el recorrido de la furgoneta escolar en tiempo real sin instalar la app:\n\n👉 ${currentUrl}`;
    const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
  }

  window.shareWhatsApp = shareWhatsApp;
})();
