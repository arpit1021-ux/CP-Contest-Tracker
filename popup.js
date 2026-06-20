const ALL_PLATFORMS = [
  'Codeforces', 'CodeChef', 'AtCoder', 'LeetCode'
];

let settingsOpen = false;

function $(id) { return document.getElementById(id); }

function formatLocalTime(timestamp) {
  return new Date(timestamp).toLocaleString(undefined, {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function formatCountdown(ms) {
  if (ms <= 0) return 'Started';
  const totalSec = Math.floor(ms / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0 || parts.length === 0) parts.push(`${m}m`);
  return parts.join(' ');
}

function formatDuration(seconds) {
  if (seconds <= 0) return '0m';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function showView(view) {
  $('loading').classList.add('hidden');
  $('error').classList.add('hidden');
  $('empty').classList.add('hidden');
  $('contest-list').classList.add('hidden');
  $('settings-panel').classList.add('hidden');
  $('status-bar').classList.add('hidden');

  if (view === 'loading') $('loading').classList.remove('hidden');
  else if (view === 'error') $('error').classList.remove('hidden');
  else if (view === 'empty') $('empty').classList.remove('hidden');
  else if (view === 'contests') $('contest-list').classList.remove('hidden');
  else if (view === 'settings') $('settings-panel').classList.remove('hidden');
}

function renderContests(contests) {
  const list = $('contest-list');
  list.innerHTML = '';

  if (contests.length === 0) {
    showView('empty');
    return;
  }

  const now = Date.now();
  contests.forEach(contest => {
    const card = document.createElement('div');
    card.className = 'contest-card';
    card.addEventListener('click', () => {
      chrome.tabs.create({ url: contest.url });
    });

    const countdownMs = contest.startTime - now;
    const isSoon = countdownMs > 0 && countdownMs < 3600000;

    card.innerHTML = `
      <div class="contest-top">
        <span class="platform-badge platform-${contest.platform}">
          <span class="dot"></span>
          ${contest.platform}
        </span>
      </div>
      <div class="contest-name" title="${contest.name}">${contest.name}</div>
      <div class="contest-details">
        <span class="contest-time">${formatLocalTime(contest.startTime)}</span>
        <span class="contest-duration">${contest.durationFormatted}</span>
        <span class="countdown${isSoon ? ' soon' : ''}">${formatCountdown(countdownMs)}</span>
      </div>
    `;
    list.appendChild(card);
  });

  showView('contests');
}

function showStatus(text) {
  $('status-text').textContent = text;
  $('status-bar').classList.remove('hidden');
}

async function triggerRefresh() {
  return new Promise(resolve => {
    chrome.runtime.sendMessage({ action: 'refresh' }, () => resolve());
  });
}

async function loadContests() {
  showView('loading');
  try {
    const { contests = [], lastFetch = 0 } = await chrome.storage.local.get(['contests', 'lastFetch']);
    const { enabledPlatforms = ALL_PLATFORMS } = await chrome.storage.local.get('enabledPlatforms');

    if (contests.length === 0) {
      showView('empty');
      return;
    }

    const filtered = contests.filter(c => enabledPlatforms.includes(c.platform));
    const now = Date.now();
    const upcoming = filtered.filter(c => c.startTime > now);
    upcoming.sort((a, b) => a.startTime - b.startTime);

    if (lastFetch > 0) {
      const age = Math.round((now - lastFetch) / 60000);
      if (age < 2) showStatus('Data is up to date');
      else if (age < 60) showStatus(`Last updated ${age}m ago`);
      else showStatus(`Data may be stale (updated ${Math.round(age / 60)}h ago)`);
    }

    renderContests(upcoming);
  } catch (err) {
    $('error-msg').textContent = err.message;
    showView('error');
  }
}

async function loadSettings() {
  const { enabledPlatforms = ALL_PLATFORMS, reminderMinutes = 15 } =
    await chrome.storage.local.get(['enabledPlatforms', 'reminderMinutes']);

  const toggles = $('platform-toggles');
  toggles.innerHTML = '';
  ALL_PLATFORMS.forEach(platform => {
    const row = document.createElement('div');
    row.className = 'platform-toggle';
    row.innerHTML = `
      <label for="toggle-${platform}">${platform}</label>
      <div class="toggle-switch">
        <input type="checkbox" id="toggle-${platform}" data-platform="${platform}"
               ${enabledPlatforms.includes(platform) ? 'checked' : ''}>
        <label class="toggle-slider" for="toggle-${platform}"></label>
      </div>
    `;
    const input = row.querySelector('input');
    input.addEventListener('change', async () => {
      const { enabledPlatforms: current = ALL_PLATFORMS } =
        await chrome.storage.local.get('enabledPlatforms');
      let updated;
      if (input.checked) {
        updated = current.includes(platform) ? current : [...current, platform];
      } else {
        updated = current.filter(p => p !== platform);
      }
      await chrome.storage.local.set({ enabledPlatforms: updated });
      chrome.runtime.sendMessage({ action: 'updateBadge' });
    });
    toggles.appendChild(row);
  });

  $('reminder-select').value = String(reminderMinutes);
  $('reminder-select').addEventListener('change', async () => {
    await chrome.storage.local.set({ reminderMinutes: parseInt($('reminder-select').value) });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  loadContests();

  $('settings-btn').addEventListener('click', () => {
    settingsOpen = true;
    loadSettings();
    showView('settings');
  });

  $('back-btn').addEventListener('click', () => {
    settingsOpen = false;
    loadContests();
  });

  $('retry-btn').addEventListener('click', () => loadContests());

  $('refresh-btn').addEventListener('click', async () => {
    showView('loading');
    await triggerRefresh();
    await loadContests();
  });

  setInterval(() => {
    if (!settingsOpen) loadContests();
  }, 60000);
});
