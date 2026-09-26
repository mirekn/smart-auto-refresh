# Local Memory: Smart Auto Refresh (Firefox MV3 Extension)

## Architectural Constraints & Platform Details
- **Target Platform**: Desktop Mozilla Firefox Manifest V3 (`strict_min_version: 142.0`, Gecko ID `smart-auto-refresh@mirekn.dev` in [manifest.json](./manifest.json)). Deliberately Desktop Only (`gecko_android` omitted).
- **Background Architecture**: Uses Firefox MV3 background event script ([background.js](./background/background.js)).
- **Offline / Code Security Policy**: All scripts, styling, and assets must remain 100% self-contained and offline-capable without external libraries, CDNs, or bundlers. Strict zero-innerHTML policy in all extension JavaScript; all dynamic DOM manipulations must use safe native DOM creation APIs.

## Timer Engine & Badge Conventions
- **Timer Map**: In-memory `tabTimers` Map keyed by `tabId` managing interval, remaining countdown, and pause state.
- **Native Toolbar Badge Display**:
  - Uses Firefox's native badge engine (`browser.action.setBadgeText`, `browser.action.setBadgeBackgroundColor`, and `browser.action.setBadgeTextColor`) overlaid on default static icons for maximum typography sharpness, contrast, and subpixel anti-aliasing.
  - **Emerald (`#10b981`)**: Actively counting down.
  - **Amber (`#f59e0b`)**: Paused/frozen because the tab is currently active.
  - **Stopped / Restored**: Default static icons restored (`icons/icon-16.png`, etc.) with badge text cleared.

## URL Matching Rules
1. `exact`: Strict equality against normalized URL string.
2. `domain`: Matches base hostname, subdomains, and port variations.
3. `prefix`: Matches URLs starting with the given pattern prefix.
4. `wildcard`: Converts `*` and `?` patterns into anchored regular expressions (`^...$`).
5. `regex`: Safe RegExp compilation with case-insensitivity.

## Navigation & State Lifecycle
- Timers disarm immediately when a tab navigates away from matched URLs.
- Extension is strictly disabled on internal browser pages (`about:*`, `chrome:*`, `moz-extension:*`, `view-source:*), displaying a disabled notice in the popup.
- On browser startup or new tab loads, background scans existing rules to auto-start matched tabs.
- Active-tab focus switching (`tabs.onActivated`, `windows.onFocusChanged`) pauses/resumes timers without resetting the remaining second counter.

## Storage Keys
- `refresh_rules`: Array of rule objects containing `id`, `pattern`, `matchType`, `intervalSeconds`, `pauseWhenActive`, `bypassCache`, `enabled`, and `autoStart`.
- `refresh_global_settings`: Global extension settings object.

## Testing & Loading
- Load as a temporary add-on via `about:debugging#/runtime/this-firefox` pointing to [manifest.json](./manifest.json).

## Packaging & Distribution
- **Packaging Engine**: Standalone zero-dependency script [package.py](./package.py).
- **Build Execution**: Run via `python package.py` to package the 12 core runtime assets at the archive root with maximum compression.
- **Outputs (`dist/`)**:
  - `dist/smart-auto-refresh-v<version>.zip`: Ready for Mozilla AMO Developer Hub upload (both Listed and Unlisted).
  - `dist/smart-auto-refresh-v<version>.xpi`: Direct offline install for Developer Edition/ESR or signed backup.
  - `dist/checksums.txt`: SHA-256 integrity records.
