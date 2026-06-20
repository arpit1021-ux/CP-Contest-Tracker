const FETCH_ALARM = 'fetch-contests';
const REMINDER_PREFIX = 'reminder-';
const DEFAULT_REMINDER_MINUTES = 15;

const ALL_PLATFORMS = [
  'Codeforces', 'CodeChef', 'AtCoder', 'LeetCode'
];

const PLATFORM_URLS = {
  'Codeforces': 'https://codeforces.com/contests',
  'LeetCode': 'https://leetcode.com/contest/',
  'CodeChef': 'https://www.codechef.com/contests',
  'AtCoder': 'https://atcoder.jp/contests/'
};

function formatDuration(seconds) {
  if (seconds <= 0) return '0m';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function fetchWithTimeout(url, opts = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...opts, signal: controller.signal }).finally(() => clearTimeout(timer));
}

async function fetchCodeforces() {
  try {
    const res = await fetchWithTimeout('https://codeforces.com/api/contest.list?gym=false');
    if (!res.ok) return [];
    const json = await res.json();
    if (json.status !== 'OK') return [];
    const now = Math.floor(Date.now() / 1000);
    return json.result
      .filter(c => c.phase === 'BEFORE' && c.startTimeSeconds > now)
      .map(c => ({
        id: `Codeforces-${c.id}`,
        platform: 'Codeforces',
        name: c.name,
        startTime: c.startTimeSeconds * 1000,
        duration: c.durationSeconds,
        durationFormatted: formatDuration(c.durationSeconds),
        url: `https://codeforces.com/contest/${c.id}`
      }));
  } catch { return []; }
}

async function fetchCodeChef() {
  try {
    const res = await fetchWithTimeout('https://www.codechef.com/api/list/contests/all');
    if (!res.ok) return [];
    const json = await res.json();
    const now = Date.now();
    return (json.future_contests || []).map(c => {
      const startMs = new Date(c.contest_start_date_iso).getTime();
      const endMs = new Date(c.contest_end_date_iso).getTime();
      const durationSec = Math.round((endMs - startMs) / 1000);
      return {
        id: `CodeChef-${c.contest_code}`,
        platform: 'CodeChef',
        name: c.contest_name,
        startTime: startMs,
        duration: durationSec,
        durationFormatted: formatDuration(durationSec),
        url: `https://www.codechef.com/${c.contest_code}`
      };
    });
  } catch { return []; }
}

async function fetchAtCoder() {
  try {
    const res = await fetchWithTimeout('https://atcoder.jp/contests/');
    if (!res.ok) return [];
    const html = await res.text();
    const contests = [];
    const upcomingRegex = /(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}[^\s]*)\s*<\/time>[\s\S]*?<a\s+href="\/contests\/([^"]+)"[^>]*>([^<]+)<\/a>[\s\S]*?<td[^>]*>\s*([\d:]+)\s*<\/td>/g;
    let match;
    while ((match = upcomingRegex.exec(html)) !== null) {
      const timeStr = match[1].trim();
      const slug = match[2];
      const name = match[3].trim();
      const durationStr = match[4];
      const startMs = new Date(timeStr).getTime();
      const dParts = durationStr.split(':').map(Number);
      const durationSec = (dParts[0] || 0) * 3600 + (dParts[1] || 0) * 60 + (dParts[2] || 0);
      if (!isNaN(startMs)) {
        contests.push({
          id: `AtCoder-${slug}`,
          platform: 'AtCoder',
          name,
          startTime: startMs,
          duration: durationSec,
          durationFormatted: formatDuration(durationSec),
          url: `https://atcoder.jp/contests/${slug}`
        });
      }
    }
    return contests;
  } catch { return []; }
}

async function fetchLeetCode() {
  try {
    const res = await fetchWithTimeout('https://leetcode.com/graphql/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `{ brightTitle allContests { title titleSlug startTime duration } }`
      })
    });
    if (!res.ok) return [];
    const json = await res.json();
    const now = Math.floor(Date.now() / 1000);
    return (json.data?.allContests || [])
      .filter(c => c.startTime > now)
      .map(c => ({
        id: `LeetCode-${c.titleSlug}`,
        platform: 'LeetCode',
        name: c.title,
        startTime: c.startTime * 1000,
        duration: c.duration,
        durationFormatted: formatDuration(c.duration),
        url: `https://leetcode.com/contest/${c.titleSlug}/`
      }));
  } catch { return []; }
}

async function fetchContests() {
  const results = await Promise.allSettled([
    fetchCodeforces(),
    fetchCodeChef(),
    fetchAtCoder(),
    fetchLeetCode()
  ]);

  let all = [];
  for (const r of results) {
    if (r.status === 'fulfilled') all = all.concat(r.value);
  }

  const now = Date.now();
  const upcoming = all.filter(c => c.startTime > now);
  upcoming.sort((a, b) => a.startTime - b.startTime);
  return upcoming;
}

async function storeContests(contests) {
  await chrome.storage.local.set({ contests, lastFetch: Date.now() });
}

async function getPrefs() {
  return chrome.storage.local.get({
    enabledPlatforms: ALL_PLATFORMS,
    reminderMinutes: DEFAULT_REMINDER_MINUTES
  });
}

function filterContests(contests, prefs) {
  return contests.filter(c => prefs.enabledPlatforms.includes(c.platform));
}

async function updateBadge(contests) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const todayCount = contests.filter(c =>
    c.startTime >= todayStart.getTime() && c.startTime < todayEnd.getTime()
  ).length;

  await chrome.action.setBadgeText({ text: todayCount > 0 ? String(todayCount) : '' });
  await chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
}

async function scheduleReminders(contests, reminderMinutes) {
  const existing = await chrome.alarms.getAll();
  const reminderAlarms = existing.filter(a => a.name.startsWith(REMINDER_PREFIX));
  for (const alarm of reminderAlarms) {
    await chrome.alarms.clear(alarm.name);
  }

  const now = Date.now();
  for (const contest of contests) {
    const reminderTime = contest.startTime - (reminderMinutes * 60 * 1000);
    if (reminderTime > now) {
      await chrome.alarms.create(`${REMINDER_PREFIX}${contest.id}`, { when: reminderTime });
    }
  }
}

async function doRefresh() {
  try {
    const contests = await fetchContests();
    if (contests.length === 0) {
      const { contests: existing = [] } = await chrome.storage.local.get('contests');
      if (existing.length > 0) {
        console.log(`CP Tracker: fetch returned 0 contests, keeping ${existing.length} cached`);
        return;
      }
    }
    await storeContests(contests);
    const prefs = await getPrefs();
    const filtered = filterContests(contests, prefs);
    await updateBadge(filtered);
    await scheduleReminders(filtered, prefs.reminderMinutes);
    console.log(`CP Tracker: fetched ${contests.length} contests`);
  } catch (err) {
    console.error('CP Tracker fetch error:', err);
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  await doRefresh();
  await chrome.alarms.create(FETCH_ALARM, { periodInMinutes: 30 });
});

chrome.runtime.onStartup.addListener(async () => {
  await doRefresh();
  const existing = await chrome.alarms.get(FETCH_ALARM);
  if (!existing) {
    await chrome.alarms.create(FETCH_ALARM, { periodInMinutes: 30 });
  }
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === FETCH_ALARM) {
    await doRefresh();
    return;
  }

  if (alarm.name.startsWith(REMINDER_PREFIX)) {
    const contestId = alarm.name.slice(REMINDER_PREFIX.length);
    const { contests = [] } = await chrome.storage.local.get('contests');
    const contest = contests.find(c => c.id === contestId);
    if (!contest) return;

    const now = Date.now();
    if (contest.startTime <= now) return;

    const minutesUntil = Math.round((contest.startTime - now) / 60000);

    await chrome.notifications.create(`notify-${contestId}`, {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: `${contest.platform} — Starting in ${minutesUntil}m`,
      message: `${contest.name}\nDuration: ${contest.durationFormatted}`,
      priority: 2,
      requireInteraction: true,
      buttons: [{ title: 'View Contest' }]
    });
  }
});

chrome.notifications.onClicked.addListener(async (notifId) => {
  if (notifId.startsWith('notify-')) {
    const contestId = notifId.slice(7);
    const { contests = [] } = await chrome.storage.local.get('contests');
    const contest = contests.find(c => c.id === contestId);
    if (contest?.url) chrome.tabs.create({ url: contest.url });
    await chrome.notifications.clear(notifId);
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'refresh') {
    doRefresh().then(() => sendResponse({ ok: true }));
    return true;
  }
});

chrome.notifications.onButtonClicked.addListener(async (notifId, buttonIndex) => {
  if (notifId.startsWith('notify-') && buttonIndex === 0) {
    const contestId = notifId.slice(7);
    const { contests = [] } = await chrome.storage.local.get('contests');
    const contest = contests.find(c => c.id === contestId);
    if (contest?.url) chrome.tabs.create({ url: contest.url });
    await chrome.notifications.clear(notifId);
  }
});
