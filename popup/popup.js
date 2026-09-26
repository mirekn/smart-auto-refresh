/**
 * Smart Auto Refresh - Popup Controller
 */

document.addEventListener('DOMContentLoaded', async () => {
  // DOM Elements
  const tabUrlEl = document.getElementById('tab-url');
  const ruleBadgeEl = document.getElementById('rule-status-badge');
  const disabledNoticeEl = document.getElementById('disabled-notice');
  const heroTimerEl = document.querySelector('.hero-timer');
  const statusTextEl = document.getElementById('status-text');
  const countdownDisplayEl = document.getElementById('countdown-display');
  const progressBarEl = document.getElementById('progress-bar');
  const presetBtns = document.querySelectorAll('.preset-btn');
  const customValInput = document.getElementById('custom-interval-val');
  const customUnitSelect = document.getElementById('custom-interval-unit');
  const chkPauseActive = document.getElementById('chk-pause-active');
  const chkBypassCache = document.getElementById('chk-bypass-cache');
  const matchScopeRadios = document.querySelectorAll('input[name="match-scope"]');
  const customPatternRow = document.getElementById('custom-pattern-row');
  const customPatternInput = document.getElementById('custom-pattern-input');
  const patternValidationError = document.getElementById('pattern-validation-error');
  const btnToggle = document.getElementById('btn-toggle-timer');
  const btnToggleIcon = document.getElementById('btn-toggle-icon');
  const btnToggleText = document.getElementById('btn-toggle-text');
  const btnRefreshNow = document.getElementById('btn-refresh-now');
  const btnOpenOptions = document.getElementById('btn-open-options');

  let currentTab = null;
  let currentTimer = null;
  let matchingRule = null;
  let localRemaining = 0;
  let localTotal = 15;
  let localIntervalId = null;

  // Format seconds as MM:SS or HH:MM:SS
  function formatDigitalTime(totalSec) {
    if (isNaN(totalSec) || totalSec < 0) totalSec = 0;
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;

    const pad = (n) => String(n).padStart(2, '0');
    if (hrs > 0) {
      return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
    }
    return `${pad(mins)}:${pad(secs)}`;
  }

  // Get currently selected interval in seconds
  function getSelectedIntervalSeconds() {
    const val = Math.max(1, parseInt(customValInput.value, 10) || 15);
    const unit = parseInt(customUnitSelect.value, 10) || 1;
    return val * unit;
  }

  // Set interval UI elements based on total seconds
  function setIntervalUi(seconds) {
    seconds = Math.max(1, parseInt(seconds, 10) || 15);

    // Check presets
    presetBtns.forEach(btn => {
      const sec = parseInt(btn.getAttribute('data-sec'), 10);
      if (sec === seconds) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    if (seconds >= 3600 && seconds % 3600 === 0) {
      customValInput.value = seconds / 3600;
      customUnitSelect.value = '3600';
    } else if (seconds >= 60 && seconds % 60 === 0) {
      customValInput.value = seconds / 60;
      customUnitSelect.value = '60';
    } else {
      customValInput.value = seconds;
      customUnitSelect.value = '1';
    }
  }

  // Get selected match scope
  function getSelectedMatchScope() {
    const checked = document.querySelector('input[name="match-scope"]:checked');
    return checked ? checked.value : 'exact';
  }

  // Set match scope radio and update pattern input
  function setMatchScope(scope, customPattern = null) {
    matchScopeRadios.forEach(r => {
      r.checked = (r.value === scope);
    });
    updatePatternFieldForScope(scope, customPattern);
  }

  // Update custom pattern field based on selected scope
  function updatePatternFieldForScope(scope, overridePattern = null) {
    if (!currentTab || !currentTab.url) return;

    if (scope === 'exact' || scope === 'domain') {
      customPatternRow.classList.add('hidden');
      validateCurrentPattern();
      return;
    }

    customPatternRow.classList.remove('hidden');

    if (overridePattern) {
      customPatternInput.value = overridePattern;
    } else {
      try {
        const u = new URL(currentTab.url);
        if (scope === 'prefix') {
          customPatternInput.value = u.origin + u.pathname;
        } else if (scope === 'wildcard') {
          customPatternInput.value = `*${u.hostname}${u.pathname}*`;
        } else if (scope === 'regex') {
          const escapedHost = u.hostname.replace(/[.+^${}()|[\]\\]/g, '\\$&');
          customPatternInput.value = `^https?:\\/\\/(.*\\.)?${escapedHost}\\/.*$`;
        }
      } catch (e) {
        customPatternInput.value = currentTab.url;
      }
    }
    validateCurrentPattern();
  }

  // Real-time pattern validation
  function validateCurrentPattern() {
    const scope = getSelectedMatchScope();
    patternValidationError.classList.add('hidden');
    customPatternInput.classList.remove('invalid');
    btnToggle.disabled = false;

    if (scope === 'regex') {
      const pattern = customPatternInput.value.trim();
      try {
        new RegExp(pattern, 'i');
      } catch (e) {
        patternValidationError.textContent = 'Invalid RegExp: ' + e.message;
        patternValidationError.classList.remove('hidden');
        customPatternInput.classList.add('invalid');
        if (!currentTimer || !currentTimer.isRunning) {
          btnToggle.disabled = true;
        }
      }
    }
  }

  // Update hero countdown UI
  function updateHeroDisplay(remaining, total, isRunning, isPaused) {
    if (!isRunning) {
      heroTimerEl.className = 'hero-timer';
      statusTextEl.textContent = 'Stopped';
      const intervalSec = getSelectedIntervalSeconds();
      countdownDisplayEl.textContent = formatDigitalTime(intervalSec);
      progressBarEl.style.width = '0%';
      return;
    }

    if (isPaused) {
      heroTimerEl.className = 'hero-timer paused';
      statusTextEl.textContent = 'Paused (Tab Active)';
    } else {
      heroTimerEl.className = 'hero-timer running';
      statusTextEl.textContent = 'Running';
    }

    countdownDisplayEl.textContent = formatDigitalTime(remaining);
    const progress = total > 0 ? Math.min(100, Math.max(0, ((total - remaining) / total) * 100)) : 0;
    progressBarEl.style.width = `${progress}%`;
  }

  // Update the primary button state (Start vs Stop)
  function updateButtonState(isRunning) {
    if (isRunning) {
      btnToggle.className = 'btn-primary btn-stop';
      btnToggleIcon.textContent = '■';
      btnToggleText.textContent = 'Stop Auto Refresh';
      btnToggle.disabled = false;
    } else {
      btnToggle.className = 'btn-primary btn-start';
      btnToggleIcon.textContent = '▶';
      btnToggleText.textContent = 'Start Auto Refresh';
      validateCurrentPattern();
    }
  }

  // Local ticker for smooth 1-second countdown in popup
  function startLocalCountdown(remaining, total, isPaused) {
    if (localIntervalId) {
      clearInterval(localIntervalId);
      localIntervalId = null;
    }

    localRemaining = remaining;
    localTotal = total;

    updateHeroDisplay(localRemaining, localTotal, true, isPaused);

    localIntervalId = setInterval(() => {
      if (!isPaused && localRemaining > 0) {
        localRemaining -= 1;
      }
      if (localRemaining <= 0) {
        localRemaining = localTotal;
      }
      updateHeroDisplay(localRemaining, localTotal, true, isPaused);
    }, 1000);
  }

  function stopLocalCountdown() {
    if (localIntervalId) {
      clearInterval(localIntervalId);
      localIntervalId = null;
    }
    updateHeroDisplay(0, 0, false, false);
  }

  // Fetch current state from background
  async function refreshStatus() {
    if (!currentTab || !currentTab.id) return;

    try {
      const response = await browser.runtime.sendMessage({
        action: 'GET_STATUS',
        payload: { tabId: currentTab.id, url: currentTab.url }
      });

      if (!response) return;

      currentTimer = response.timer;
      matchingRule = response.matchingRule;

      // Handle matching rule indicators
      if (matchingRule) {
        ruleBadgeEl.classList.remove('hidden');
        ruleBadgeEl.textContent = `Rule: ${matchingRule.matchType.toUpperCase()} (${matchingRule.intervalSeconds}s)`;
        if (!currentTimer) {
          setIntervalUi(matchingRule.intervalSeconds);
          chkPauseActive.checked = matchingRule.pauseWhenActive;
          chkBypassCache.checked = matchingRule.bypassCache;
          setMatchScope(matchingRule.matchType, matchingRule.pattern);
        }
      } else {
        ruleBadgeEl.classList.add('hidden');
      }

      if (currentTimer && currentTimer.isRunning) {
        setIntervalUi(currentTimer.intervalSeconds);
        chkPauseActive.checked = currentTimer.pauseWhenActive;
        chkBypassCache.checked = currentTimer.bypassCache;
        updateButtonState(true);
        startLocalCountdown(currentTimer.remainingSeconds, currentTimer.intervalSeconds, currentTimer.isPaused);
      } else {
        updateButtonState(false);
        stopLocalCountdown();
      }
    } catch (err) {
      console.error('Failed to get status from background:', err);
    }
  }

  // Check if URL is an internal browser page
  function isInternalBrowserUrl(url) {
    if (!url) return true;
    const clean = url.trim().toLowerCase();
    return clean.startsWith('about:') ||
      clean.startsWith('chrome:') ||
      clean.startsWith('moz-extension:') ||
      clean.startsWith('view-source:');
  }

  // Set disabled state for internal browser pages
  function setInternalDisabledState() {
    disabledNoticeEl.classList.remove('hidden');
    heroTimerEl.className = 'hero-timer';
    statusTextEl.textContent = 'Disabled';
    countdownDisplayEl.textContent = '--:--';
    progressBarEl.style.width = '0%';
    btnToggle.disabled = true;
    btnRefreshNow.disabled = true;
    customValInput.disabled = true;
    customUnitSelect.disabled = true;
    chkPauseActive.disabled = true;
    chkBypassCache.disabled = true;
    presetBtns.forEach(btn => btn.disabled = true);
    matchScopeRadios.forEach(r => r.disabled = true);
    customPatternInput.disabled = true;
  }

  // Initialize
  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (tabs && tabs.length > 0) {
      currentTab = tabs[0];
      tabUrlEl.textContent = currentTab.url || 'No URL found';
      tabUrlEl.title = currentTab.url || '';

      if (isInternalBrowserUrl(currentTab.url)) {
        setInternalDisabledState();
      } else {
        await refreshStatus();
      }
    }
  } catch (err) {
    tabUrlEl.textContent = 'Error loading tab';
  }

  // Preset button clicks
  presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const sec = parseInt(btn.getAttribute('data-sec'), 10);
      setIntervalUi(sec);
      if (!currentTimer || !currentTimer.isRunning) {
        updateHeroDisplay(0, 0, false, false);
      }
    });
  });

  // Custom interval changes
  function onCustomIntervalChange() {
    const sec = getSelectedIntervalSeconds();
    presetBtns.forEach(btn => {
      const pSec = parseInt(btn.getAttribute('data-sec'), 10);
      btn.classList.toggle('active', pSec === sec);
    });
    if (!currentTimer || !currentTimer.isRunning) {
      updateHeroDisplay(0, 0, false, false);
    }
  }

  customValInput.addEventListener('input', onCustomIntervalChange);
  customUnitSelect.addEventListener('change', onCustomIntervalChange);

  // Scope radio change
  matchScopeRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      updatePatternFieldForScope(radio.value);
    });
  });

  customPatternInput.addEventListener('input', validateCurrentPattern);

  // Toggle Start / Stop
  btnToggle.addEventListener('click', async () => {
    if (!currentTab || !currentTab.id) return;

    if (currentTimer && currentTimer.isRunning) {
      // STOP
      await browser.runtime.sendMessage({
        action: 'STOP_TIMER',
        payload: { tabId: currentTab.id, disableRule: true }
      });
      currentTimer = null;
      updateButtonState(false);
      stopLocalCountdown();
      await refreshStatus();
    } else {
      // START
      const intervalSec = getSelectedIntervalSeconds();
      const pauseWhenActive = chkPauseActive.checked;
      const bypassCache = chkBypassCache.checked;
      const matchType = getSelectedMatchScope();
      const customPattern = ['prefix', 'wildcard', 'regex'].includes(matchType)
        ? customPatternInput.value.trim()
        : null;

      const response = await browser.runtime.sendMessage({
        action: 'START_TIMER',
        payload: {
          tabId: currentTab.id,
          url: currentTab.url,
          config: {
            intervalSeconds: intervalSec,
            pauseWhenActive,
            bypassCache,
            autoStart: true
          },
          saveRule: true,
          matchType,
          customPattern
        }
      });

      if (response && response.success) {
        currentTimer = response.timer;
        updateButtonState(true);
        startLocalCountdown(intervalSec, intervalSec, chkPauseActive.checked);
        await refreshStatus();
      }
    }
  });

  // Reload Now
  btnRefreshNow.addEventListener('click', async () => {
    if (!currentTab || !currentTab.id) return;
    btnRefreshNow.style.transform = 'rotate(180deg)';
    setTimeout(() => { btnRefreshNow.style.transform = 'none'; }, 300);

    await browser.runtime.sendMessage({
      action: 'RELOAD_NOW',
      payload: {
        tabId: currentTab.id,
        bypassCache: chkBypassCache.checked
      }
    });

    if (currentTimer && currentTimer.isRunning) {
      startLocalCountdown(currentTimer.intervalSeconds, currentTimer.intervalSeconds, currentTimer.isPaused);
    }
  });

  // Open Options page
  btnOpenOptions.addEventListener('click', (e) => {
    e.preventDefault();
    if (browser.runtime.openOptionsPage) {
      browser.runtime.openOptionsPage();
    } else {
      window.open(browser.runtime.getURL('options/options.html'));
    }
  });
});
