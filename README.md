# CP Contest Tracker

A Chrome extension that tracks upcoming competitive programming contests from multiple platforms and sends desktop notifications before they start.

## Supported Platforms

- **Codeforces**
- **LeetCode**
- **CodeChef**
- **AtCoder**
- **HackerEarth**
- **HackerRank**
- **TopCoder**

## Features

- Upcoming contest list sorted by start time
- Platform badges with color coding
- Countdown timers for each contest
- Desktop notifications before contests (configurable: 5/15/30/60 min)
- Platform filtering (toggle which platforms to track)
- Dark/light theme matching system preference
- Badge icon showing today's contest count
- Keyboard shortcut: `Ctrl+Shift+1` / `Cmd+Shift+1`
- Data caching for offline/error resilience

## Installation (Unpacked)

1. Open `chrome://extensions` in Chrome
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select this directory (`chrome_extension`)
5. The extension icon appears in your toolbar

## Permissions

| Permission | Why |
|-----------|-----|
| `alarms` | Periodic data refresh (every 30 min) and scheduling reminder alarms |
| `notifications` | Desktop notification alerts before contests start |
| `storage` | Cache contest data and store user preferences locally |

No data is sent to any server. All data stays on your device.

## API

Uses the free public [kontests.net](https://kontests.net) API. No API key required.

## Files

```
manifest.json       - Extension manifest (Manifest V3)
background.js       - Service worker: fetch, alarms, notifications
popup.html          - Popup UI markup
popup.css           - Popup styles (dark/light themes)
popup.js            - Popup logic
icons/              - Extension icons (16, 48, 128px)
```

## How It Works

1. On install and every 30 minutes, `background.js` fetches contests from kontests.net
2. Contest data is stored in `chrome.storage.local`
3. Reminder alarms are scheduled for each upcoming contest
4. When an alarm fires, a desktop notification appears with a "View Contest" button
5. The popup displays upcoming contests with countdown timers, filtered by your platform preferences
