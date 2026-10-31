const api = globalThis.browser ?? globalThis.chrome;
const checkbox = document.querySelector('#prefetch');
const status = document.querySelector('#status');
checkbox.disabled = true;
api.storage.local.get('prefetchNearby').then(({ prefetchNearby }) => {
  checkbox.checked = prefetchNearby !== false;
  checkbox.disabled = false;
}).catch(() => { status.textContent = 'Could not load settings.'; });
checkbox.addEventListener('change', async () => {
  checkbox.disabled = true;
  try {
    await api.storage.local.set({ prefetchNearby: checkbox.checked });
    status.textContent = 'Saved.';
  } catch {
    checkbox.checked = !checkbox.checked;
    status.textContent = 'Could not save settings.';
  } finally {
    checkbox.disabled = false;
  }
});
