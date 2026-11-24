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

// Fallback service settings.
const providerSelect = document.querySelector('#fallback-provider');
const fields = {
  dataforseo: document.querySelector('#dataforseo-fields'),
  cloro: document.querySelector('#cloro-fields')
};
const dataforseoLogin = document.querySelector('#dataforseo-login');
const dataforseoPassword = document.querySelector('#dataforseo-password');
const cloroKey = document.querySelector('#cloro-key');
const saveButton = document.querySelector('#fallback-save');
const fallbackStatus = document.querySelector('#fallback-status');

function showFields() {
  for (const [provider, element] of Object.entries(fields)) element.hidden = providerSelect.value !== provider;
}
providerSelect.addEventListener('change', showFields);

api.storage.local.get(['fallbackProvider', 'dataforseoLogin', 'dataforseoPassword', 'cloroApiKey']).then((stored) => {
  providerSelect.value = stored.fallbackProvider ?? 'none';
  dataforseoLogin.value = stored.dataforseoLogin ?? '';
  dataforseoPassword.value = stored.dataforseoPassword ?? '';
  cloroKey.value = stored.cloroApiKey ?? '';
  showFields();
}).catch(() => { fallbackStatus.textContent = 'Could not load fallback settings.'; });

// Firefox asks the user to agree before an extension sends browsing data elsewhere.
async function allowSendingLinks() {
  if (typeof api.permissions?.request !== 'function') return true;
  try {
    return await api.permissions.request({ data_collection: ['browsingActivity'] });
  } catch {
    // Browsers without data-collection permissions reject the unknown key.
    return true;
  }
}

saveButton.addEventListener('click', async () => {
  const provider = providerSelect.value;
  const values = {
    fallbackProvider: provider,
    dataforseoLogin: dataforseoLogin.value.trim(),
    dataforseoPassword: dataforseoPassword.value.trim(),
    cloroApiKey: cloroKey.value.trim()
  };
  if (provider === 'dataforseo' && (!values.dataforseoLogin || !values.dataforseoPassword)) {
    fallbackStatus.textContent = 'Enter both the DataForSEO login and password.';
    return;
  }
  if (provider === 'cloro' && !values.cloroApiKey) {
    fallbackStatus.textContent = 'Enter a cloro API key.';
    return;
  }
  saveButton.disabled = true;
  try {
    if (provider !== 'none' && !(await allowSendingLinks())) {
      fallbackStatus.textContent = 'Not saved: permission to send links to the service was declined.';
      return;
    }
    await api.storage.local.set(values);
    fallbackStatus.textContent = provider === 'none' ? 'Saved. No fallback service is used.' : 'Saved.';
  } catch {
    fallbackStatus.textContent = 'Could not save fallback settings.';
  } finally {
    saveButton.disabled = false;
  }
});
