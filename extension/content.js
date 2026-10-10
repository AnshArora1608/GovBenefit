// GovBenefit Form Mentor - Content Script

(function () {
  if (window.__GOVBENEFIT_MENTOR_INITIALIZED__) return;
  window.__GOVBENEFIT_MENTOR_INITIALIZED__ = true;

  const API_BASE = 'http://localhost:8000';
  let activeElement = null;
  let activeFieldData = null;
  let mentorPanel = null;

  // Initialize UI on page load
  function initMentor() {
    createMentorPanel();
    bindFormInspectors();
  }

  // Create or return the floating mentor panel
  function createMentorPanel() {
    if (document.getElementById('govbenefit-mentor-panel')) {
      mentorPanel = document.getElementById('govbenefit-mentor-panel');
      return;
    }

    mentorPanel = document.createElement('div');
    mentorPanel.id = 'govbenefit-mentor-panel';
    mentorPanel.innerHTML = `
      <div class="gbf-header">
        <div class="gbf-header-brand">
          🏛️ Gov<span>Benefit</span> Mentor
        </div>
        <div class="gbf-controls">
          <button type="button" class="gbf-btn-icon" id="gbf-btn-min" title="Minimize">−</button>
          <button type="button" class="gbf-btn-icon" id="gbf-btn-close" title="Close">×</button>
        </div>
      </div>
      <div class="gbf-body" id="gbf-body">
        <div class="gbf-card">
          <div class="gbf-card-title">👋 Ready to Assist</div>
          <p class="gbf-card-text">
            Click or focus on any form field to view plain-language explanations, dropdown meanings, and profile autofill assistance.
          </p>
        </div>
      </div>
      <div class="gbf-ask-box" id="gbf-ask-box">
        <div class="gbf-quick-chips">
          <button type="button" class="gbf-chip" data-q="What does this field mean?">What does this mean?</button>
          <button type="button" class="gbf-chip" data-q="What should I enter here?">What to enter?</button>
          <button type="button" class="gbf-chip" data-q="Why is this required?">Why required?</button>
          <button type="button" class="gbf-chip" data-q="What does this option mean?">Option meanings</button>
        </div>
        <div class="gbf-input-group">
          <input type="text" class="gbf-input" id="gbf-ask-input" placeholder="Ask Mentor about this field...">
          <button type="button" class="gbf-btn-ask" id="gbf-btn-ask">Ask</button>
        </div>
        <div id="gbf-ai-response-container"></div>
      </div>
    `;

    document.body.appendChild(mentorPanel);

    // Minimize toggle
    document.getElementById('gbf-btn-min').addEventListener('click', () => {
      mentorPanel.classList.toggle('gbf-minimized');
    });

    // Close toggle
    document.getElementById('gbf-btn-close').addEventListener('click', () => {
      mentorPanel.style.display = 'none';
    });

    // Quick chips ask
    mentorPanel.querySelectorAll('.gbf-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        askQuestion(chip.dataset.q);
      });
    });

    // Ask submit
    document.getElementById('gbf-btn-ask').addEventListener('click', () => {
      const input = document.getElementById('gbf-ask-input');
      if (input.value.trim()) {
        askQuestion(input.value.trim());
        input.value = '';
      }
    });

    document
      .getElementById('gbf-ask-input')
      .addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const input = document.getElementById('gbf-ask-input');
          if (input.value.trim()) {
            askQuestion(input.value.trim());
            input.value = '';
          }
        }
      });
  }

  // Bind focus and click listeners to inspect active form controls
  function bindFormInspectors() {
    document.addEventListener(
      'focusin',
      (e) => {
        const el = e.target;
        if (isFormInput(el)) {
          handleFieldFocus(el);
        }
      },
      true
    );

    document.addEventListener(
      'click',
      (e) => {
        const el = e.target;
        if (isFormInput(el)) {
          handleFieldFocus(el);
        }
      },
      true
    );
  }

  function isFormInput(el) {
    if (!el || !el.tagName) return false;
    const tag = el.tagName.toUpperCase();
    return (
      tag === 'INPUT' ||
      tag === 'SELECT' ||
      tag === 'TEXTAREA' ||
      tag === 'BUTTON'
    );
  }

  // Find corresponding label for an input element
  function extractFieldLabel(el) {
    // 1. Label with matching 'for' attribute
    if (el.id) {
      const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (label && label.innerText) return cleanText(label.innerText);
    }

    // 2. Parent label element
    const parentLabel = el.closest('label');
    if (parentLabel && parentLabel.innerText)
      return cleanText(parentLabel.innerText);

    // 3. Aria attributes
    if (el.getAttribute('aria-label'))
      return cleanText(el.getAttribute('aria-label'));

    // 4. Placeholder
    if (el.placeholder) return cleanText(el.placeholder);

    // 5. Name or ID fallback
    return el.name || el.id || 'Field';
  }

  function cleanText(text) {
    return String(text || '')
      .replace(/\s+/g, ' ')
      .replace(/[*:]/g, '')
      .trim();
  }

  // Handle focus on a specific input element
  async function handleFieldFocus(el) {
    if (activeElement === el) return;

    if (activeElement) {
      activeElement.classList.remove('govbenefit-highlight-field');
    }

    activeElement = el;
    activeElement.classList.add('govbenefit-highlight-field');

    if (mentorPanel) {
      mentorPanel.style.display = 'flex';
      mentorPanel.classList.remove('gbf-minimized');
    }

    // Extract field options if select
    let options = [];
    if (el.tagName.toUpperCase() === 'SELECT') {
      options = Array.from(el.options)
        .filter((opt) => opt.value !== '')
        .map((opt) => ({
          value: opt.value,
          label: opt.text || opt.value,
        }));
    }

    const fieldPayload = {
      id: el.id || '',
      name: el.name || '',
      type: el.type || el.tagName.toLowerCase(),
      labelText: extractFieldLabel(el),
      placeholder: el.placeholder || '',
      required: el.required || false,
      options,
    };

    activeFieldData = fieldPayload;
    renderLoading(fieldPayload.labelText);

    try {
      const res = await fetch(`${API_BASE}/api/mentor/inspect-field`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fieldInfo: fieldPayload, schemeId: 'pmegp' }),
      });

      if (!res.ok) throw new Error('Mentor API responded with ' + res.status);
      const data = await res.json();
      renderFieldGuidance(data, el);
    } catch (err) {
      console.warn(
        'GovBenefit Mentor API unavailable, using local rules:',
        err
      );
      renderLocalGuidance(fieldPayload, el);
    }
  }

  function renderLoading(fieldLabel) {
    const body = document.getElementById('gbf-body');
    body.innerHTML = `
      <div class="gbf-field-badge">
        <div class="gbf-field-title">🔍 Inspecting: ${escapeHtml(fieldLabel)}</div>
      </div>
      <div class="text-center py-3 text-muted">
        Analyzing field rules and profile match...
      </div>
    `;
    const respContainer = document.getElementById('gbf-ai-response-container');
    if (respContainer) respContainer.innerHTML = '';
  }

  // Render guidance returned from the Form Mentor engine
  function renderFieldGuidance(data, targetEl) {
    const body = document.getElementById('gbf-body');
    let html = '';

    // Field Header Badge
    html += `
      <div class="gbf-field-badge">
        <div class="gbf-field-title">
          📌 ${escapeHtml(data.label || activeFieldData.labelText)}
          ${activeFieldData.required ? '<span class="gbf-req-pill">Required</span>' : ''}
        </div>
      </div>
    `;

    // 🛑 STRICT HUMAN ACTION BOUNDARY
    if (data.isSensitive) {
      html += `
        <div class="gbf-boundary-alert">
          <h4>🔒 Human Action Required (${escapeHtml(data.sensitiveType)})</h4>
          <p>${escapeHtml(data.boundaryMessage)}</p>
        </div>
        <div class="gbf-card">
          <div class="gbf-card-title">🛡️ Why this is not automated</div>
          <p class="gbf-card-text">
            To protect your privacy and comply with government digital security policies, automated systems are strictly prohibited from submitting CAPTCHAs, OTPs, or legal declarations.
          </p>
        </div>
      `;
      body.innerHTML = html;
      return;
    }

    // Meaning
    html += `
      <div class="gbf-card">
        <div class="gbf-card-title">💡 What does this mean?</div>
        <p class="gbf-card-text">${escapeHtml(data.meaning)}</p>
      </div>
    `;

    // What to enter & Format
    html += `
      <div class="gbf-card">
        <div class="gbf-card-title">✍️ What should I enter?</div>
        <p class="gbf-card-text">${escapeHtml(data.whatToEnter)}</p>
        ${data.format ? `<div class="mt-2 text-muted" style="font-size:11px;"><b>Format:</b> ${escapeHtml(data.format)}</div>` : ''}
      </div>
    `;

    // Why Required
    if (data.whyRequired) {
      html += `
        <div class="gbf-card">
          <div class="gbf-card-title">⚖️ Why is this asked?</div>
          <p class="gbf-card-text">${escapeHtml(data.whyRequired)}</p>
        </div>
      `;
    }

    // Saved Profile Match with user-controlled Autofill
    if (data.profileMatch && data.profileMatch.savedValue) {
      const val = data.profileMatch.savedValue;
      const disp = data.profileMatch.displayValue || val;

      html += `
        <div class="gbf-profile-match">
          <div class="gbf-card-title" style="color:#92400e;">👤 Saved in GovBenefit Profile</div>
          <div class="gbf-profile-val">${escapeHtml(disp)}</div>
          <div class="d-flex align-items-center">
            <button type="button" class="gbf-btn-use" id="gbf-btn-autofill">
              ✓ Use this value
            </button>
            <a href="http://localhost:8000/profile" target="_blank" class="gbf-btn-edit">Edit profile</a>
          </div>
        </div>
      `;
    }

    // Dropdown Options Explanation
    if (
      Array.isArray(data.optionsBreakdown) &&
      data.optionsBreakdown.length > 0
    ) {
      html += `
        <div class="gbf-options-box">
          <div class="gbf-card-title">📖 Dropdown Options Explained</div>
      `;

      data.optionsBreakdown.forEach((opt) => {
        const isRec = opt.isProfileMatch;
        html += `
          <div class="gbf-option-item ${isRec ? 'gbf-profile-recommended' : ''}">
            <div class="d-flex justify-content-between align-items-center">
              <span class="gbf-option-label">${escapeHtml(opt.label)}</span>
              ${isRec ? '<span style="font-size:10px; font-weight:700; color:#1f7a4d;">★ Matches Profile</span>' : ''}
            </div>
            <div class="gbf-option-desc">${escapeHtml(opt.meaning)}</div>
            ${opt.whoShouldChoose ? `<div style="font-size:10.5px; color:#64748b; margin-top:2px;"><b>Who chooses:</b> ${escapeHtml(opt.whoShouldChoose)}</div>` : ''}
          </div>
        `;
      });

      html += `</div>`;
    }

    body.innerHTML = html;

    // Attach autofill handler if button is present
    const btnAutofill = document.getElementById('gbf-btn-autofill');
    if (btnAutofill && data.profileMatch) {
      btnAutofill.addEventListener('click', () => {
        fillTargetElement(targetEl, data.profileMatch.savedValue);
        btnAutofill.textContent = '✓ Filled in form';
        btnAutofill.style.background = '#1f7a4d';
        btnAutofill.style.color = '#fff';
      });
    }
  }

  // Fallback if backend server is unreachable
  function renderLocalGuidance(fieldPayload, el) {
    const isSensitive = /captcha|otp|declaration|submit/i.test(
      fieldPayload.labelText + ' ' + fieldPayload.name
    );
    renderFieldGuidance(
      {
        label: fieldPayload.labelText,
        meaning: 'Standard information requested for application processing.',
        whatToEnter: `Enter valid ${fieldPayload.labelText}.`,
        format: 'Standard input',
        whyRequired: 'Required by scheme authority.',
        isSensitive,
        sensitiveType: isSensitive ? 'HUMAN_ACTION' : null,
        boundaryMessage:
          '🔒 Human Action Required: Please complete this step manually.',
        profileMatch: null,
        optionsBreakdown: [],
      },
      el
    );
  }

  // Safely fills the DOM element with simulated human events
  function fillTargetElement(el, value) {
    if (!el || value == null) return;

    if (el.tagName.toUpperCase() === 'SELECT') {
      // Find matching option
      let found = false;
      for (let i = 0; i < el.options.length; i++) {
        if (
          el.options[i].value.toLowerCase() === String(value).toLowerCase() ||
          el.options[i].text.toLowerCase().includes(String(value).toLowerCase())
        ) {
          el.selectedIndex = i;
          found = true;
          break;
        }
      }
      if (!found && el.options.length > 0) {
        el.value = value;
      }
    } else if (el.type === 'checkbox') {
      el.checked = Boolean(value);
    } else if (el.type === 'radio') {
      el.checked = true;
    } else {
      el.value = value;
    }

    // Trigger synthetic input and change events so framework listeners update
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));

    // Green visual feedback flash
    const prevBg = el.style.backgroundColor;
    el.style.backgroundColor = '#e8f5e9';
    setTimeout(() => {
      el.style.backgroundColor = prevBg;
    }, 600);
  }

  // Ask AI question
  async function askQuestion(question) {
    const container = document.getElementById('gbf-ai-response-container');
    container.innerHTML = `
      <div class="gbf-ai-response" style="background:#f1f5f9; color:#334155;">
        Thinking... Generating guidance for "${escapeHtml(question)}"
      </div>
    `;

    try {
      const res = await fetch(`${API_BASE}/api/mentor/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          fieldContext: activeFieldData || {},
          schemeId: 'pmegp',
        }),
      });

      if (!res.ok) throw new Error('API error ' + res.status);
      const data = await res.json();

      container.innerHTML = `
        <div class="gbf-ai-response">
          <b>🤖 GovBenefit Mentor:</b><br>
          ${formatMarkdown(data.answer || 'No response available.')}
        </div>
      `;
    } catch (err) {
      container.innerHTML = `
        <div class="gbf-ai-response" style="background:#fef2f2; color:#991b1b;">
          Could not contact mentor service. Please ensure GovBenefit server is running at ${API_BASE}.
        </div>
      `;
    }
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatMarkdown(text) {
    return escapeHtml(text)
      .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
      .replace(/\*(.*?)\*/g, '<i>$1</i>')
      .replace(/\n\n/g, '<br><br>')
      .replace(/\n/g, '<br>');
  }

  // Connect floating test pill button on mock page if present
  document.addEventListener('DOMContentLoaded', () => {
    initMentor();
    const demoBtn = document.getElementById('launchMentorDemoBtn');
    if (demoBtn) {
      demoBtn.addEventListener('click', () => {
        if (mentorPanel) {
          mentorPanel.style.display = 'flex';
          mentorPanel.classList.remove('gbf-minimized');
          const firstField =
            document.getElementById('aadhaar_no') ||
            document.querySelector('input');
          if (firstField) firstField.focus();
        }
      });
    }
  });

  if (
    document.readyState === 'complete' ||
    document.readyState === 'interactive'
  ) {
    initMentor();
  }
})();
