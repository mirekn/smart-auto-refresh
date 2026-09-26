/**
 * Firefox Tab Auto-Refresher - Background Script (Manifest V3)
 * Manages tab timers, persistence, active-tab pausing, bypass cache reloads, badge updates,
 * strict navigation disarming, and Exact / Domain / Prefix / Wildcard / Regex URL matching.
 */

// In-memory registry of active timers per tab ID
// Map<tabId, {
//   tabId: number,
//   url: string,
//   intervalSeconds: number,
//   remainingSeconds: number,
//   pauseWhenActive: boolean,
//   bypassCache: boolean,
//   isRunning: boolean,
//   isPaused: boolean,
//   ruleId?: string
// }>
const tabTimers = new Map();

// Active tab and window tracking
let activeTabId = null;
let activeWindowId = null;

// Storage keys
const STORAGE_KEY_RULES = 'refresh_rules';
const STORAGE_KEY_SETTINGS = 'refresh_global_settings';

// Default extension icon paths
const DEFAULT_ICON_PATHS = {
  16: 'icons/icon-16.png',
  32: 'icons/icon-32.png',
  48: 'icons/icon-48.png',
  128: 'icons/icon-128.png'
};

/* ==========================================================================
   Helper & Utility Functions
   ========================================================================== */

/**
 * Format seconds into concise badge text: "45s", "2m", "1h"
 */
function formatBadgeText(seconds) {
  if (isNaN(seconds) || seconds < 0) seconds = 0;
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const mins = Math.floor(seconds / 60);
  if (mins < 60) {
    return `${mins}m`;
  }
  const hours = Math.floor(mins / 60);
  return `${hours}h`;
}

/**
 * Update the extension native badge and icon for a specific tab
 */
async function updateTabBadge(tabId) {
  try {
    const timer = tabTimers.get(tabId);
    if (!timer || !timer.isRunning) {
      // Clear native badge text and ensure default static icons are active
      await browser.action.setBadgeText({ tabId, text: '' });
      await browser.action.setIcon({
        tabId,
        path: DEFAULT_ICON_PATHS
      });
      return;
    }

    const badgeText = formatBadgeText(timer.remainingSeconds);
    const badgeColor = timer.isPaused ? '#f59e0b' : '#10b981'; // Amber if paused, Emerald if running

    // Ensure default static icon is present
    await browser.action.setIcon({
      tabId,
      path: DEFAULT_ICON_PATHS
    });

    // Set native badge text and background color
    await browser.action.setBadgeText({ tabId, text: badgeText });
    await browser.action.setBadgeBackgroundColor({ tabId, color: badgeColor });

    // Set high-contrast badge text color if supported by the browser engine
    if (browser.action.setBadgeTextColor) {
      await browser.action.setBadgeTextColor({ tabId, color: '#ffffff' });
    }
  } catch (err) {
    // Tab might have closed or not ready
  }
}

/**
 * Safely compile a regular expression string
 */
function safeCompileRegExp(pattern) {
  if (!pattern) return null;
  try {
    return new RegExp(pattern, 'i');
  } catch (e) {
    return null;
  }
}

/**
 * Convert wildcard pattern (* and ?) to an anchored regular expression
 */
function wildcardToRegExp(pattern) {
  if (!pattern) return null;
  try {
    // Escape standard regex special characters except * and ?
    const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    // Replace * with .* and ? with .
    const regexString = '^' + escaped.replace(/\*/g, '.*').replace(/\?/g, '.') + '$';
    return new RegExp(regexString, 'i');
  } catch (e) {
    return null;
  }
}

/**
 * Normalize and match a URL against a rule pattern
 */
function isUrlMatchingRule(url, rule) {
  if (!url || !rule || !rule.pattern || !rule.enabled) {
    return false;
  }

  // Skip browser internal URLs
  if (/^(about:|chrome:|moz-extension:|view-source:)/i.test(url)) {
    return false;
  }

  const rawUrl = url.trim();
  const rawPattern = rule.pattern.trim();
  const cleanUrl = rawUrl.toLowerCase();
  const cleanPattern = rawPattern.toLowerCase();
  const matchType = rule.matchType || 'exact';

  // 1. Regular Expression matching
  if (matchType === 'regex') {
    const regex = safeCompileRegExp(rawPattern);
    return regex ? regex.test(rawUrl) : false;
  }

  // 2. Wildcard matching (* and ?)
  if (matchType === 'wildcard') {
    const regex = wildcardToRegExp(cleanPattern);
    return regex ? (regex.test(cleanUrl) || regex.test(rawUrl)) : false;
  }

  // 3. Domain matching
  if (matchType === 'domain') {
    try {
      let targetHost = cleanPattern
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .replace(/^\*\./, '')
        .split('/')[0]
        .split(':')[0]
        .trim();

      if (!targetHost) return false;

      let currentHost = '';
      if (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://')) {
        currentHost = new URL(cleanUrl).hostname.replace(/^www\./, '');
      } else {
        currentHost = cleanUrl.split('/')[0].split(':')[0];
      }

      return currentHost === targetHost || currentHost.endsWith('.' + targetHost);
    } catch (e) {
      return false;
    }
  }

  // 4. Prefix matching
  if (matchType === 'prefix') {
    const prefix = cleanPattern.replace(/\*$/, '');
    return prefix.length > 0 && cleanUrl.startsWith(prefix);
  }

  // 5. Exact URL matching
  const u1 = cleanUrl.replace(/#.*$/, '').replace(/\/$/, '');
  const u2 = cleanPattern.replace(/#.*$/, '').replace(/\/$/, '');
  return u1 === u2;
}

/**
 * Find the best matching rule from saved rules for a URL
 */
async function findMatchingRule(url) {
  if (!url) return null;
  const { [STORAGE_KEY_RULES]: rules = [] } = await browser.storage.local.get(STORAGE_KEY_RULES);
  return rules.find(r => isUrlMatchingRule(url, r)) || null;
}

/**
 * Load all saved rules from storage
 */
async function getAllRules() {
  const { [STORAGE_KEY_RULES]: rules = [] } = await browser.storage.local.get(STORAGE_KEY_RULES);
  return rules;
}

/**
 * Save all rules to storage
 */
async function saveAllRules(rules) {
  await browser.storage.local.set({ [STORAGE_KEY_RULES]: rules });
}

/* ==========================================================================
   Timer & Lifecycle Engine
   ========================================================================== */

/**
 * Start or update an auto-refresh timer on a tab
 */
function startTabTimer(tabId, url, config, ruleId = null) {
  const intervalSeconds = Math.max(1, parseInt(config.intervalSeconds, 10) || 15);
  const pauseWhenActive = Boolean(config.pauseWhenActive);
  const bypassCache = Boolean(config.bypassCache);

  const isCurrentActiveTab = (tabId === activeTabId);
  const isPaused = pauseWhenActive && isCurrentActiveTab;

  const timer = {
    tabId,
    url,
    intervalSeconds,
    remainingSeconds: intervalSeconds,
    pauseWhenActive,
    bypassCache,
    isRunning: true,
    isPaused,
    ruleId
  };

  tabTimers.set(tabId, timer);
  updateTabBadge(tabId);
}

/**
 * Stop the timer on a tab
 */
function stopTabTimer(tabId) {
  tabTimers.delete(tabId);
  updateTabBadge(tabId);
}

/**
 * Evaluate if a tab should pause or resume based on active status
 */
function reevaluateTabPauseStates() {
  for (const [tabId, timer] of tabTimers.entries()) {
    if (!timer.isRunning) continue;

    const isCurrentActiveTab = (tabId === activeTabId);
    const shouldBePaused = timer.pauseWhenActive && isCurrentActiveTab;

    if (timer.isPaused !== shouldBePaused) {
      timer.isPaused = shouldBePaused;
      updateTabBadge(tabId);
    }
  }
}

/**
 * Trigger reload for a tab
 */
async function executeTabReload(tabId, bypassCache) {
  try {
    await browser.tabs.reload(tabId, { bypassCache: Boolean(bypassCache) });
  } catch (err) {
    // Tab could have been closed or detached
    stopTabTimer(tabId);
  }
}

/**
 * Master Clock Tick - runs once every second
 */
async function onMasterTick() {
  for (const [tabId, timer] of tabTimers.entries()) {
    if (!timer.isRunning) continue;

    // Check if tab still exists
    try {
      const tab = await browser.tabs.get(tabId);
      if (!tab) {
        stopTabTimer(tabId);
        continue;
      }
    } catch (e) {
      stopTabTimer(tabId);
      continue;
    }

    if (timer.isPaused) {
      updateTabBadge(tabId);
      continue;
    }

    timer.remainingSeconds -= 1;

    if (timer.remainingSeconds <= 0) {
      timer.remainingSeconds = timer.intervalSeconds;
      executeTabReload(tabId, timer.bypassCache);
    }

    updateTabBadge(tabId);
  }
}

// Start master 1-second interval timer
setInterval(onMasterTick, 1000);

/* ==========================================================================
   Tab and Window Event Listeners
   ========================================================================== */

// Track tab activation
browser.tabs.onActivated.addListener(async (activeInfo) => {
  activeTabId = activeInfo.tabId;
  activeWindowId = activeInfo.windowId;
  reevaluateTabPauseStates();
});

// Track window focus changes
browser.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === browser.windows.WINDOW_ID_NONE) {
    // Browser lost focus; tabs are not actively being interacted with
    activeTabId = null;
  } else {
    activeWindowId = windowId;
    try {
      const [tab] = await browser.tabs.query({ active: true, windowId });
      if (tab) {
        activeTabId = tab.id;
      }
    } catch (e) {
      // Ignore
    }
  }
  reevaluateTabPauseStates();
});

// Track tab closure
browser.tabs.onRemoved.addListener((tabId) => {
  stopTabTimer(tabId);
});

// Track tab navigation and updates (including BFCache / History / URL changes)
browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  const currentUrl = changeInfo.url || tab.url;

  // 1. Navigation started or URL changed: immediately evaluate and disarm if not matching
  if (changeInfo.url || changeInfo.status === 'loading') {
    if (currentUrl) {
      const rule = await findMatchingRule(currentUrl);
      if (!rule || !rule.autoStart || !rule.enabled) {
        const existingTimer = tabTimers.get(tabId);
        if (existingTimer && existingTimer.url !== currentUrl) {
          stopTabTimer(tabId);
        }
      }
    }
  }

  // 2. Navigation completed: sync timer state with active rule
  if (changeInfo.status === 'complete' && tab.url) {
    const existingTimer = tabTimers.get(tabId);
    const rule = await findMatchingRule(tab.url);

    if (rule && rule.autoStart && rule.enabled) {
      // If timer is already running for the exact same URL and rule, keep ticking
      if (existingTimer && existingTimer.isRunning && existingTimer.url === tab.url && existingTimer.ruleId === rule.id) {
        return;
      }
      startTabTimer(tabId, tab.url, rule, rule.id);
    } else {
      // No matching active rule; ensure timer is stopped
      if (existingTimer) {
        stopTabTimer(tabId);
      }
    }
  }
});

/**
 * Scan all open tabs on startup and initialize matching auto-refresh rules
 */
async function initializeAllTabs() {
  try {
    const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (activeTab) {
      activeTabId = activeTab.id;
      activeWindowId = activeTab.windowId;
    }

    const allTabs = await browser.tabs.query({});
    for (const tab of allTabs) {
      if (!tab.url) continue;
      const rule = await findMatchingRule(tab.url);
      if (rule && rule.autoStart && rule.enabled) {
        startTabTimer(tab.id, tab.url, rule, rule.id);
      }
    }
  } catch (err) {
    console.error('Error initializing tabs on startup:', err);
  }
}

// Run on extension startup / installation
browser.runtime.onStartup.addListener(initializeAllTabs);
browser.runtime.onInstalled.addListener(initializeAllTabs);

// Initial call on background script load
initializeAllTabs();

/* ==========================================================================
   Message Routing (Popup & Options Communication)
   ========================================================================== */

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { action, payload } = message;

  switch (action) {
    case 'GET_STATUS': {
      const { tabId, url } = payload;
      const timer = tabTimers.get(tabId) || null;
      findMatchingRule(url).then(matchingRule => {
        sendResponse({
          timer,
          matchingRule,
          isCurrentActive: tabId === activeTabId
        });
      });
      return true; // Async response
    }

    case 'START_TIMER': {
      const { tabId, url, config, saveRule, matchType, customPattern } = payload;
      if (!url || /^(about:|chrome:|moz-extension:|view-source:)/i.test(url) || url.startsWith('about:')) {
        sendResponse({ success: false, error: 'Cannot refresh internal browser pages (about:*)' });
        return false;
      }
      (async () => {
        let ruleId = null;
        if (saveRule) {
          const rules = await getAllRules();
          let pattern = customPattern || url;

          if (!customPattern) {
            if (matchType === 'domain') {
              try {
                pattern = new URL(url).hostname;
              } catch (e) {
                pattern = url;
              }
            } else if (matchType === 'prefix') {
              pattern = url.split('?')[0] + '*';
            } else if (matchType === 'wildcard') {
              try {
                const u = new URL(url);
                pattern = `*${u.hostname}${u.pathname}*`;
              } catch (e) {
                pattern = url + '*';
              }
            } else if (matchType === 'regex') {
              try {
                const u = new URL(url);
                const escapedHost = u.hostname.replace(/[.+^${}()|[\]\\]/g, '\\$&');
                pattern = `^https?:\\/\\/(.*\\.)?${escapedHost}\\/.*$`;
              } catch (e) {
                pattern = '^' + url.replace(/[.+^${}()|[\]\\]/g, '\\$&') + '$';
              }
            }
          }

          let existingIndex = rules.findIndex(r => r.pattern === pattern && r.matchType === matchType);
          const ruleData = {
            id: existingIndex >= 0 ? rules[existingIndex].id : 'rule_' + Date.now(),
            pattern,
            matchType: matchType || 'exact',
            intervalSeconds: config.intervalSeconds,
            pauseWhenActive: config.pauseWhenActive,
            bypassCache: config.bypassCache,
            enabled: true,
            autoStart: config.autoStart !== undefined ? config.autoStart : true,
            updatedAt: Date.now()
          };

          if (existingIndex >= 0) {
            rules[existingIndex] = ruleData;
          } else {
            rules.push(ruleData);
          }
          await saveAllRules(rules);
          ruleId = ruleData.id;
        }

        startTabTimer(tabId, url, config, ruleId);
        sendResponse({ success: true, timer: tabTimers.get(tabId) });
      })();
      return true;
    }

    case 'STOP_TIMER': {
      const { tabId, disableRule } = payload;
      (async () => {
        const timer = tabTimers.get(tabId);
        if (timer && timer.ruleId && disableRule) {
          const rules = await getAllRules();
          const rule = rules.find(r => r.id === timer.ruleId);
          if (rule) {
            rule.enabled = false;
            await saveAllRules(rules);
          }
        }
        stopTabTimer(tabId);
        sendResponse({ success: true });
      })();
      return true;
    }

    case 'RELOAD_NOW': {
      const { tabId, bypassCache } = payload;
      executeTabReload(tabId, bypassCache);
      const timer = tabTimers.get(tabId);
      if (timer) {
        timer.remainingSeconds = timer.intervalSeconds;
        updateTabBadge(tabId);
      }
      sendResponse({ success: true });
      return false;
    }

    case 'GET_ALL_RULES': {
      getAllRules().then(rules => sendResponse({ rules }));
      return true;
    }

    case 'SAVE_RULE': {
      (async () => {
        const { rule } = payload;
        const rules = await getAllRules();
        const index = rules.findIndex(r => r.id === rule.id);
        if (index >= 0) {
          rules[index] = { ...rules[index], ...rule, updatedAt: Date.now() };
        } else {
          rules.push({ ...rule, id: rule.id || 'rule_' + Date.now(), createdAt: Date.now() });
        }
        await saveAllRules(rules);
        sendResponse({ success: true, rules });
      })();
      return true;
    }

    case 'DELETE_RULE': {
      (async () => {
        const { ruleId } = payload;
        let rules = await getAllRules();
        rules = rules.filter(r => r.id !== ruleId);
        await saveAllRules(rules);

        // Disarm any active timers using this rule
        for (const [tabId, timer] of tabTimers.entries()) {
          if (timer.ruleId === ruleId) {
            stopTabTimer(tabId);
          }
        }
        sendResponse({ success: true, rules });
      })();
      return true;
    }

    case 'IMPORT_RULES': {
      (async () => {
        const { importedRules, overwrite } = payload;
        if (!Array.isArray(importedRules)) {
          sendResponse({ success: false, error: 'Invalid format. Expected an array of rules.' });
          return;
        }

        const validTypes = ['exact', 'domain', 'prefix', 'wildcard', 'regex'];
        let rules = overwrite ? [] : await getAllRules();
        for (const imp of importedRules) {
          if (!imp.pattern) continue;
          const newRule = {
            id: imp.id || 'rule_' + Math.random().toString(36).substr(2, 9),
            pattern: imp.pattern,
            matchType: validTypes.includes(imp.matchType) ? imp.matchType : 'exact',
            intervalSeconds: Math.max(1, parseInt(imp.intervalSeconds, 10) || 15),
            pauseWhenActive: imp.pauseWhenActive !== undefined ? Boolean(imp.pauseWhenActive) : true,
            bypassCache: Boolean(imp.bypassCache),
            enabled: imp.enabled !== undefined ? Boolean(imp.enabled) : true,
            autoStart: imp.autoStart !== undefined ? Boolean(imp.autoStart) : true,
            createdAt: imp.createdAt || Date.now()
          };

          const existingIdx = rules.findIndex(r => r.pattern === newRule.pattern && r.matchType === newRule.matchType);
          if (existingIdx >= 0) {
            rules[existingIdx] = newRule;
          } else {
            rules.push(newRule);
          }
        }

        await saveAllRules(rules);
        sendResponse({ success: true, rules });
      })();
      return true;
    }

    default:
      sendResponse({ error: 'Unknown action' });
      return false;
  }
});
