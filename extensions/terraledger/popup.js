const API_URL = 'https://terra-ledger.vercel.app';

document.addEventListener('DOMContentLoaded', () => {
  checkHealth();
});

async function checkHealth() {
  const dot = document.getElementById('statusDot');
  const text = document.getElementById('statusText');
  const versionEl = document.getElementById('apiVersion');
  const parcelEl = document.getElementById('parcelCount');

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(`${API_URL}/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      dot.classList.add('online');
      text.innerHTML = 'API <span>Online</span> &middot; ' + data.environment;
      versionEl.textContent = data.version || '1.0';
    } else {
      dot.classList.add('offline');
      text.innerHTML = 'API <span>Error</span> &middot; Status ' + res.status;
      versionEl.textContent = '--';
    }
  } catch (err) {
    dot.classList.add('offline');
    text.innerHTML = 'API <span>Offline</span>';
    versionEl.textContent = '--';
  }

  // Try to get parcel count from public endpoint
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(`${API_URL}/api/public/stats`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      parcelEl.textContent = data.totalParcels ?? data.parcels ?? '--';
    } else {
      parcelEl.textContent = '--';
    }
  } catch {
    parcelEl.textContent = '--';
  }
}
