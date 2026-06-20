# CP Contest Tracker

A Chrome extension to track upcoming competitive programming contests with desktop notifications.

## Platforms

- Codeforces
- CodeChef
- AtCoder
- LeetCode

## Features

- Upcoming contest list sorted by start time
- Countdown timers for each contest
- Desktop notifications before contests (configurable: 5/15/30/60 min)
- Platform filtering to toggle which platforms to show

## Installation

### Option 1: Download ZIP (Recommended)

1. Click the **Code** button above and select **Download ZIP**
2. Extract the downloaded `CP-Contest-Tracker.zip` file
3. You will see a folder containing `manifest.json`, `popup.html`, etc.
4. Open Chrome and go to `chrome://extensions`
5. Enable **Developer mode** (toggle in the top-right corner)
6. Click **Load unpacked** and select the **extracted folder** (the one that contains `manifest.json`)
7. The extension icon will appear in your toolbar — click it to start!

### Option 2: Clone the Repository

```bash
git clone https://github.com/arpit1021-ux/CP-Contest-Tracker.git
```

Then follow steps 3–6 above, selecting the cloned folder.

## Permissions

| Permission     | Purpose                                      |
| -------------- | -------------------------------------------- |
| `alarms`       | Schedule periodic contest checks             |
| `notifications`| Send desktop notifications before contests   |
| `storage`      | Save user preferences (platforms, notify time)|

## Built by Arpit Singh
