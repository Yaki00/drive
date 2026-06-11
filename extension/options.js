import { pingApi } from './lib/api.js';
import { getApiUrl, setApiUrl } from './lib/storage.js';

const input = document.getElementById('api-url');
const status = document.getElementById('status');
const saveBtn = document.getElementById('save');

async function init() {
  input.value = await getApiUrl();
}

saveBtn.addEventListener('click', async () => {
  status.textContent = 'Testing connection…';
  status.className = 'status';

  try {
    await setApiUrl(input.value);
    await pingApi();
    status.textContent = 'Saved. Connection OK.';
    status.className = 'status ok';
  } catch (error) {
    status.textContent = error.message || 'Connection failed.';
    status.className = 'status error';
  }
});

void init();
