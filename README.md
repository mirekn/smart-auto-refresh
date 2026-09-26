# Smart Auto Refresh - Mozilla Firefox Extension (Manifest V3)

A lightweight, powerful Mozilla Firefox extension built to automatically refresh website tabs at custom time intervals with smart active-tab pausing, bypass cache (hard reload) controls, and persistent per-URL configuration rules.

## Features

- **Live Countdown Display**: Digital countdown timer and real-time toolbar icon badge (e.g. `45s`, `2m` with green background when running, amber background when countdown is frozen/paused).
- **Smart Active-Tab Pause**: Configurable option to pause the countdown while you are actively viewing/interacting with the tab, automatically resuming once you switch tabs.
- **Bypass Cache (Hard Reload)**: Optional toggle to force the browser to reload the page without using cached assets.
- **Flexible Interval Configuration**: Quick preset pills (`5s`, `15s`, `30s`, `1m`, `5m`, `10m`) plus custom interval inputs (seconds, minutes, hours).
- **5 URL Matching Options**: Supports Exact URL, Whole Domain (`*.example.com`), Prefix matching, Wildcard (`*` and `?`), and JavaScript Regular Expressions (RegExp).
- **Navigation & History Safety**: Timers immediately disarm when navigating away to unconfigured pages or across history transitions.
- **Automatic Startup Detection**: Automatically scans and starts countdowns for open tabs when Firefox is launched or when navigating to configured URLs.
- **Full Options & Rule Manager**: Dedicated dashboard to view, add, edit, enable/disable, and search configured rules.
- **JSON Import / Export**: Easily export rules to `auto-refresh-rules.json` or import configuration files.
- **Fully Self-Contained**: 100% offline-capable with zero external dependencies.

---

## Extension Structure

```text
├── manifest.json            # Manifest V3 extension configuration
├── background/
│   └── background.js        # Background event script & timer engine
├── popup/
│   ├── popup.html           # Toolbar popup dialogue UI
│   ├── popup.css            # Popup stylesheet
│   └── popup.js             # Popup controller
├── options/
│   ├── options.html         # Rule manager dashboard UI
│   ├── options.css          # Options dashboard stylesheet
│   └── options.js           # Rule manager controller & JSON import/export
├── icons/
│   ├── icon-16.png          # 16x16 toolbar icon
│   ├── icon-32.png          # 32x32 icon
│   ├── icon-48.png          # 48x48 icon
│   └── icon-128.png         # 128x128 store/add-on manager icon
└── README.md                # Documentation & local testing guide
```

---

## How to Test Locally in Mozilla Firefox

Follow these quick steps to load and test the add-on temporarily in Firefox:

1. Open **Mozilla Firefox**.
2. In the address bar, navigate to:
   ```text
   about:debugging#/runtime/this-firefox
   ```
3. Click on the **"Load Temporary Add-on..."** button.
4. Browse to the extension directory and select the `manifest.json` file.
5. The extension **"Smart Auto Refresh"** will appear under **Temporary Extensions**.

---

## How to Use

### 1. Quick Refresh on Current Tab
1. Open any website in a tab (e.g. `https://example.com` or your dashboard).
2. Click the **Smart Auto Refresh** icon in the Firefox toolbar.
3. Select your desired interval (e.g. `15s` or custom number).
4. Configure options:
   - **Stop when tab is active**: Check if you want the countdown to pause while you are viewing this tab.
   - **Bypass cache**: Check to perform hard reloads.
   - **Rule Scope**: Choose between *Exact*, *Domain*, *Prefix*, *Wildcard*, or *RegExp*.
5. Click **"Start Auto Refresh"**.
6. The toolbar badge will display the live countdown.

### 2. Managing Rules & JSON Import/Export
1. Right-click the extension icon in the toolbar and select **"Manage Extension"** -> **"Options"**, or click the gear icon (⚙) inside the popup.
2. In the Rule Manager:
   - Click **"+ Add New Rule"** to create a rule for any domain, wildcard pattern, or regular expression.
   - Toggle rules on/off with the status switch.
   - Click **"Export JSON"** to backup your rules to a `.json` file.
   - Click **"Import JSON"** to load a saved rules file.

---

## JSON Configuration Format Example

When importing or exporting configurations, rules follow this JSON schema:

```json
[
  {
    "id": "rule_1739880000000",
    "pattern": "https://example.com/status",
    "matchType": "exact",
    "intervalSeconds": 15,
    "pauseWhenActive": true,
    "bypassCache": false,
    "enabled": true,
    "autoStart": true,
    "createdAt": 1739880000000
  },
  {
    "id": "rule_1739880001000",
    "pattern": "*example.com/*/dashboard?*",
    "matchType": "wildcard",
    "intervalSeconds": 30,
    "pauseWhenActive": true,
    "bypassCache": false,
    "enabled": true,
    "autoStart": true,
    "createdAt": 1739880001000
  },
  {
    "id": "rule_1739880002000",
    "pattern": "^https?:\\/\\/(.*\\.)?mycompany\\.org\\/(api|feed)",
    "matchType": "regex",
    "intervalSeconds": 60,
    "pauseWhenActive": true,
    "bypassCache": true,
    "enabled": true,
    "autoStart": true,
    "createdAt": 1739880002000
  }
]
```
