/**
 * Smart Auto Refresh - Options & Rule Manager Controller
 */

document.addEventListener('DOMContentLoaded', async () => {
  // DOM Elements
  const rulesTbody = document.getElementById('rules-tbody');
  const emptyState = document.getElementById('empty-state');
  const searchInput = document.getElementById('search-input');
  const filterStatusSelect = document.getElementById('filter-status');

  const btnAddRule = document.getElementById('btn-add-rule');
  const btnExportJson = document.getElementById('btn-export-json');
  const btnImportJson = document.getElementById('btn-import-json');
  const fileImportInput = document.getElementById('file-import');

  // Modal Elements
  const ruleModal = document.getElementById('rule-modal');
  const modalTitle = document.getElementById('modal-title');
  const btnModalClose = document.getElementById('btn-modal-close');
  const btnModalCancel = document.getElementById('btn-modal-cancel');
  const btnModalSubmit = document.getElementById('btn-modal-submit');
  const ruleForm = document.getElementById('rule-form');
  const modalRuleId = document.getElementById('modal-rule-id');
  const modalPattern = document.getElementById('modal-pattern');
  const modalMatchType = document.getElementById('modal-match-type');
  const modalIntervalVal = document.getElementById('modal-interval-val');
  const modalIntervalUnit = document.getElementById('modal-interval-unit');
  const modalPauseActive = document.getElementById('modal-pause-active');
  const modalBypassCache = document.getElementById('modal-bypass-cache');
  const modalAutoStart = document.getElementById('modal-auto-start');
  const modalRegexError = document.getElementById('modal-regex-error');

  // Toast
  const toast = document.getElementById('toast');
  let toastTimer = null;

  let allRules = [];

  function showToast(message, isError = false) {
    if (toastTimer) clearTimeout(toastTimer);
    toast.textContent = message;
    toast.style.borderColor = isError ? 'var(--color-danger)' : 'var(--color-accent)';
    toast.classList.remove('hidden');

    toastTimer = setTimeout(() => {
      toast.classList.add('hidden');
    }, 3500);
  }

  function formatInterval(seconds) {
    if (seconds >= 3600 && seconds % 3600 === 0) {
      return `${seconds / 3600}h`;
    }
    if (seconds >= 60 && seconds % 60 === 0) {
      return `${seconds / 60}m`;
    }
    return `${seconds}s`;
  }

  // Render Rules Table
  function renderRules() {
    const query = (searchInput.value || '').trim().toLowerCase();
    const filterStatus = filterStatusSelect.value;

    const filtered = allRules.filter(rule => {
      const matchQuery = !query || rule.pattern.toLowerCase().includes(query);
      const matchFilter = (filterStatus === 'all') ||
        (filterStatus === 'enabled' && rule.enabled) ||
        (filterStatus === 'disabled' && !rule.enabled);
      return matchQuery && matchFilter;
    });

    rulesTbody.textContent = '';

    if (filtered.length === 0) {
      emptyState.classList.remove('hidden');
    } else {
      emptyState.classList.add('hidden');

      filtered.forEach(rule => {
        const tr = document.createElement('tr');

        // Status switch
        const tdStatus = document.createElement('td');
        const switchLabel = document.createElement('label');
        switchLabel.className = 'switch-status';
        switchLabel.title = rule.enabled ? 'Enabled' : 'Disabled';

        const switchInput = document.createElement('input');
        switchInput.type = 'checkbox';
        switchInput.dataset.id = rule.id;
        switchInput.className = 'chk-rule-enable';
        if (rule.enabled) {
          switchInput.checked = true;
        }

        const switchSlider = document.createElement('span');
        switchSlider.className = 'switch-slider';

        switchLabel.appendChild(switchInput);
        switchLabel.appendChild(switchSlider);
        tdStatus.appendChild(switchLabel);

        // Pattern
        const tdPattern = document.createElement('td');
        tdPattern.className = 'pattern-cell';
        tdPattern.textContent = rule.pattern;
        tdPattern.title = rule.pattern;

        // Match Scope
        const matchType = rule.matchType || 'exact';
        const tdScope = document.createElement('td');
        const badgeScope = document.createElement('span');
        badgeScope.className = `badge-scope ${matchType}`;
        badgeScope.textContent = matchType;
        tdScope.appendChild(badgeScope);

        // Interval
        const tdInterval = document.createElement('td');
        tdInterval.textContent = formatInterval(rule.intervalSeconds);
        tdInterval.style.fontWeight = '600';

        // Pause when active
        const tdPause = document.createElement('td');
        const badgePause = document.createElement('span');
        if (rule.pauseWhenActive) {
          badgePause.className = 'badge-tag yes';
          badgePause.textContent = 'Active Pause';
        } else {
          badgePause.className = 'badge-tag no';
          badgePause.textContent = 'No';
        }
        tdPause.appendChild(badgePause);

        // Bypass cache
        const tdBypass = document.createElement('td');
        const badgeBypass = document.createElement('span');
        if (rule.bypassCache) {
          badgeBypass.className = 'badge-tag yes';
          badgeBypass.textContent = 'Hard Reload';
        } else {
          badgeBypass.className = 'badge-tag no';
          badgeBypass.textContent = 'Soft';
        }
        tdBypass.appendChild(badgeBypass);

        // Actions (Edit, Delete)
        const tdActions = document.createElement('td');
        const actionBtns = document.createElement('div');
        actionBtns.className = 'action-btns';

        const btnEdit = document.createElement('button');
        btnEdit.type = 'button';
        btnEdit.className = 'icon-btn btn-edit-rule';
        btnEdit.dataset.id = rule.id;
        btnEdit.title = 'Edit Rule';

        const svgEdit = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svgEdit.setAttribute('width', '14');
        svgEdit.setAttribute('height', '14');
        svgEdit.setAttribute('viewBox', '0 0 24 24');
        svgEdit.setAttribute('fill', 'none');
        svgEdit.setAttribute('stroke', 'currentColor');
        svgEdit.setAttribute('stroke-width', '2');

        const editPath1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        editPath1.setAttribute('d', 'M12 20h9');
        const editPath2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        editPath2.setAttribute('d', 'M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z');
        svgEdit.appendChild(editPath1);
        svgEdit.appendChild(editPath2);
        btnEdit.appendChild(svgEdit);

        const btnDelete = document.createElement('button');
        btnDelete.type = 'button';
        btnDelete.className = 'icon-btn delete btn-delete-rule';
        btnDelete.dataset.id = rule.id;
        btnDelete.title = 'Delete Rule';

        const svgDelete = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svgDelete.setAttribute('width', '14');
        svgDelete.setAttribute('height', '14');
        svgDelete.setAttribute('viewBox', '0 0 24 24');
        svgDelete.setAttribute('fill', 'none');
        svgDelete.setAttribute('stroke', 'currentColor');
        svgDelete.setAttribute('stroke-width', '2');

        const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        polyline.setAttribute('points', '3 6 5 6 21 6');
        const deletePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        deletePath.setAttribute('d', 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2');
        svgDelete.appendChild(polyline);
        svgDelete.appendChild(deletePath);
        btnDelete.appendChild(svgDelete);

        actionBtns.appendChild(btnEdit);
        actionBtns.appendChild(btnDelete);
        tdActions.appendChild(actionBtns);

        tr.appendChild(tdStatus);
        tr.appendChild(tdPattern);
        tr.appendChild(tdScope);
        tr.appendChild(tdInterval);
        tr.appendChild(tdPause);
        tr.appendChild(tdBypass);
        tr.appendChild(tdActions);

        rulesTbody.appendChild(tr);
      });
    }
  }

  // Fetch Rules from background
  async function loadRules() {
    try {
      const response = await browser.runtime.sendMessage({ action: 'GET_ALL_RULES' });
      if (response && response.rules) {
        allRules = response.rules;
        renderRules();
      }
    } catch (err) {
      console.error('Failed to load rules:', err);
    }
  }

  // Real-time validate modal regex
  function validateModalPattern() {
    modalRegexError.classList.add('hidden');
    modalPattern.classList.remove('invalid');
    btnModalSubmit.disabled = false;

    if (modalMatchType.value === 'regex') {
      const p = modalPattern.value.trim();
      if (p) {
        try {
          new RegExp(p, 'i');
        } catch (e) {
          modalRegexError.textContent = 'Invalid RegExp: ' + e.message;
          modalRegexError.classList.remove('hidden');
          modalPattern.classList.add('invalid');
          btnModalSubmit.disabled = true;
        }
      }
    }
  }

  modalPattern.addEventListener('input', validateModalPattern);
  modalMatchType.addEventListener('change', validateModalPattern);

  // Modal Open/Close
  function openModal(rule = null) {
    if (rule) {
      modalTitle.textContent = 'Edit URL Refresh Rule';
      modalRuleId.value = rule.id;
      modalPattern.value = rule.pattern;
      modalMatchType.value = rule.matchType || 'exact';

      const sec = rule.intervalSeconds || 15;
      if (sec >= 3600 && sec % 3600 === 0) {
        modalIntervalVal.value = sec / 3600;
        modalIntervalUnit.value = '3600';
      } else if (sec >= 60 && sec % 60 === 0) {
        modalIntervalVal.value = sec / 60;
        modalIntervalUnit.value = '60';
      } else {
        modalIntervalVal.value = sec;
        modalIntervalUnit.value = '1';
      }

      modalPauseActive.checked = rule.pauseWhenActive !== false;
      modalBypassCache.checked = Boolean(rule.bypassCache);
      modalAutoStart.checked = rule.autoStart !== false;
    } else {
      modalTitle.textContent = 'Add URL Refresh Rule';
      modalRuleId.value = '';
      modalPattern.value = '';
      modalMatchType.value = 'exact';
      modalIntervalVal.value = '15';
      modalIntervalUnit.value = '1';
      modalPauseActive.checked = true;
      modalBypassCache.checked = false;
      modalAutoStart.checked = true;
    }
    validateModalPattern();
    ruleModal.classList.remove('hidden');
    modalPattern.focus();
  }

  function closeModal() {
    ruleModal.classList.add('hidden');
    ruleForm.reset();
  }

  btnAddRule.addEventListener('click', () => openModal());
  btnModalClose.addEventListener('click', closeModal);
  btnModalCancel.addEventListener('click', closeModal);

  // Close modal when clicking outside card
  ruleModal.addEventListener('click', (e) => {
    if (e.target === ruleModal) closeModal();
  });

  // Save Rule Form Submit
  ruleForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const pattern = modalPattern.value.trim();
    if (!pattern) return;

    if (modalMatchType.value === 'regex') {
      try {
        new RegExp(pattern, 'i');
      } catch (err) {
        showToast('Invalid Regular Expression: ' + err.message, true);
        return;
      }
    }

    const val = Math.max(1, parseInt(modalIntervalVal.value, 10) || 15);
    const unit = parseInt(modalIntervalUnit.value, 10) || 1;
    const intervalSeconds = val * unit;

    const ruleData = {
      id: modalRuleId.value || 'rule_' + Date.now(),
      pattern,
      matchType: modalMatchType.value,
      intervalSeconds,
      pauseWhenActive: modalPauseActive.checked,
      bypassCache: modalBypassCache.checked,
      autoStart: modalAutoStart.checked,
      enabled: true
    };

    try {
      const res = await browser.runtime.sendMessage({
        action: 'SAVE_RULE',
        payload: { rule: ruleData }
      });

      if (res && res.success) {
        allRules = res.rules;
        renderRules();
        closeModal();
        showToast(`Rule for "${pattern}" saved successfully.`);
      }
    } catch (err) {
      showToast('Error saving rule: ' + err.message, true);
    }
  });

  // Table Event Delegation: Status Toggle, Edit, Delete
  rulesTbody.addEventListener('click', async (e) => {
    const target = e.target;

    // Toggle Enable / Disable
    if (target.classList.contains('chk-rule-enable')) {
      const id = target.getAttribute('data-id');
      const rule = allRules.find(r => r.id === id);
      if (rule) {
        rule.enabled = target.checked;
        await browser.runtime.sendMessage({
          action: 'SAVE_RULE',
          payload: { rule }
        });
        showToast(`Rule ${rule.enabled ? 'enabled' : 'disabled'}.`);
      }
      return;
    }

    // Edit Button
    const btnEdit = target.closest('.btn-edit-rule');
    if (btnEdit) {
      const id = btnEdit.getAttribute('data-id');
      const rule = allRules.find(r => r.id === id);
      if (rule) openModal(rule);
      return;
    }

    // Delete Button
    const btnDelete = target.closest('.btn-delete-rule');
    if (btnDelete) {
      const id = btnDelete.getAttribute('data-id');
      const rule = allRules.find(r => r.id === id);
      if (rule && confirm(`Are you sure you want to delete the rule for "${rule.pattern}"?`)) {
        const res = await browser.runtime.sendMessage({
          action: 'DELETE_RULE',
          payload: { ruleId: id }
        });
        if (res && res.success) {
          allRules = res.rules;
          renderRules();
          showToast(`Rule deleted.`);
        }
      }
      return;
    }
  });

  // Filter & Search listeners
  searchInput.addEventListener('input', renderRules);
  filterStatusSelect.addEventListener('change', renderRules);

  // Export JSON
  btnExportJson.addEventListener('click', () => {
    if (allRules.length === 0) {
      showToast('No rules available to export.', true);
      return;
    }

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(allRules, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `auto-refresh-rules-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast('Configuration exported to JSON.');
  });

  // Import JSON
  btnImportJson.addEventListener('click', () => {
    fileImportInput.value = '';
    fileImportInput.click();
  });

  fileImportInput.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target.result);
        if (!Array.isArray(json)) {
          throw new Error('JSON must contain an array of rule objects.');
        }

        const overwrite = confirm('Do you want to replace existing rules with the imported file? (Click "Cancel" to merge instead)');

        const res = await browser.runtime.sendMessage({
          action: 'IMPORT_RULES',
          payload: { importedRules: json, overwrite }
        });

        if (res && res.success) {
          allRules = res.rules;
          renderRules();
          showToast(`Imported ${json.length} rule(s) successfully!`);
        } else {
          showToast(res.error || 'Import failed', true);
        }
      } catch (err) {
        showToast('Invalid JSON file format: ' + err.message, true);
      }
    };
    reader.readAsText(file);
  });

  // Initial load
  await loadRules();
});
