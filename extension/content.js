(() => {
  const ROOT_ID = "codextab-root";
  const SETTINGS_KEY = "codextab-settings-v1";
  const DEFAULT_SETTINGS = {
    pageContextEnabled: true,
    selectedModel: "",
    reasoningEffort: "medium",
    panelWidth: 430
  };

  const state = {
    mounted: false,
    open: false,
    sending: false,
    threadId: null,
    pageContext: null,
    lastUrl: window.location.href,
    pageContextEnabled: DEFAULT_SETTINGS.pageContextEnabled,
    selectedModel: DEFAULT_SETTINGS.selectedModel,
    reasoningEffort: DEFAULT_SETTINGS.reasoningEffort,
    panelWidth: DEFAULT_SETTINGS.panelWidth,
    resizing: false,
    dom: null
  };

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === "TOGGLE_CODEXTAB_SIDEBAR") {
      ensureMounted();
      toggleSidebar();
    }
  });

  document.addEventListener(
    "keydown",
    (event) => {
      const isCmdE = event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "e";
      if (!isCmdE) {
        return;
      }

      if (isEditableTarget(event.target) && !eventIsFromSidebar(event)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      ensureMounted();
      toggleSidebar();
    },
    true
  );

  setInterval(() => {
    if (window.location.href === state.lastUrl) {
      return;
    }

    state.lastUrl = window.location.href;
    state.threadId = null;
    state.pageContext = null;
    refreshPageCard();
    if (state.dom?.messages) {
      appendSystemMessage("ページが切り替わったため、会話をリセットしました。");
    }
  }, 1000);

  function ensureMounted() {
    if (state.mounted) {
      return;
    }

    const root = document.createElement("div");
    root.id = ROOT_ID;

    const shadow = root.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>
        :host {
          all: initial;
        }

        .ct-shell {
          position: fixed;
          inset: 0;
          z-index: 2147483646;
          pointer-events: none;
          font-family: "SF Pro Text", "SF Pro Display", "Hiragino Kaku Gothic ProN", "Yu Gothic", -apple-system, BlinkMacSystemFont, sans-serif;
          color: #f5f5f7;
        }

        .ct-shell.open {
          pointer-events: auto;
        }

        .ct-backdrop {
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0.06);
          opacity: 0;
          transition: opacity 220ms ease;
        }

        .ct-shell.open .ct-backdrop {
          opacity: 1;
        }

        .ct-panel {
          position: absolute;
          top: 0;
          right: 0;
          width: 430px;
          max-width: calc(100vw - 12px);
          height: 100%;
          display: grid;
          grid-template-rows: 1fr auto;
          background: #111113;
          border-left: 1px solid #2a2a2f;
          box-shadow: -18px 0 44px rgba(10, 10, 12, 0.4);
          transform: translateX(36px);
          opacity: 0;
          transition: transform 260ms cubic-bezier(0.22, 1, 0.36, 1), opacity 260ms ease;
        }

        .ct-shell.resizing .ct-panel,
        .ct-shell.resizing .ct-backdrop {
          transition: none;
        }

        .ct-shell.resizing * {
          user-select: none;
          cursor: ew-resize !important;
        }

        .ct-shell.open .ct-panel {
          transform: translateX(0);
          opacity: 1;
        }

        .ct-resizer {
          position: absolute;
          left: -5px;
          top: 0;
          width: 10px;
          height: 100%;
          cursor: ew-resize;
          z-index: 3;
        }

        .ct-close {
          position: absolute;
          top: 10px;
          right: 10px;
          border: 1px solid #383840;
          background: #1b1b20;
          color: #a8a8b3;
          width: 28px;
          height: 28px;
          border-radius: 999px;
          font-size: 16px;
          line-height: 1;
          cursor: pointer;
          z-index: 2;
        }

        .ct-close:hover {
          background: #25252b;
          color: #f5f5f7;
        }

        .ct-messages {
          overflow: auto;
          padding: 44px 14px 14px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          min-height: 0;
        }

        .ct-msg {
          max-width: 90%;
          padding: 10px 12px;
          border-radius: 12px;
          font-size: 13px;
          line-height: 1.5;
          white-space: pre-wrap;
          word-break: break-word;
        }

        .ct-msg.user {
          margin-left: auto;
          background: #f5f5f7;
          color: #1b1b20;
          border: 1px solid #ffffff;
          border-bottom-right-radius: 4px;
        }

        .ct-msg.assistant {
          margin-right: auto;
          background: #1a1a1f;
          color: #ffffff;
          border: 1px solid #2f2f37;
          border-bottom-left-radius: 4px;
        }

        .ct-msg.assistant.streaming {
          opacity: 0.96;
        }

        .ct-md {
          font-size: 13px;
          line-height: 1.55;
        }

        .ct-md h1,
        .ct-md h2,
        .ct-md h3,
        .ct-md h4 {
          margin: 0.2em 0 0.45em;
          line-height: 1.3;
          color: #ffffff;
        }

        .ct-md h1 { font-size: 1.3em; }
        .ct-md h2 { font-size: 1.18em; }
        .ct-md h3 { font-size: 1.08em; }
        .ct-md h4 { font-size: 1em; }

        .ct-md p {
          margin: 0.45em 0;
        }

        .ct-md ul,
        .ct-md ol {
          margin: 0.45em 0 0.45em 1.2em;
          padding: 0;
        }

        .ct-md li {
          margin: 0.2em 0;
        }

        .ct-md pre {
          margin: 0.55em 0;
          padding: 10px;
          border-radius: 9px;
          background: #080809;
          color: #f8f8fa;
          overflow: auto;
          font-size: 12px;
          line-height: 1.45;
        }

        .ct-md code {
          background: #2b2b33;
          color: #f4f4f7;
          border-radius: 6px;
          padding: 1px 4px;
          font-family: "SFMono-Regular", Menlo, Monaco, Consolas, "Liberation Mono", monospace;
          font-size: 0.92em;
        }

        .ct-md pre code {
          background: transparent;
          color: inherit;
          padding: 0;
          border-radius: 0;
        }

        .ct-md strong {
          font-weight: 700;
        }

        .ct-md em {
          font-style: italic;
        }

        .ct-md hr {
          border: 0;
          border-top: 1px solid #3a3a44;
          margin: 0.8em 0;
        }

        .ct-msg.system {
          margin: 0 auto;
          background: #1d1d22;
          color: #b5b5c0;
          border: 1px solid #31313a;
          font-size: 12px;
          text-align: center;
        }

        .ct-msg.pending {
          opacity: 0.75;
          font-style: italic;
        }

        .ct-input-wrap {
          padding: 8px;
          border-top: 0;
          background: #101012;
          overflow: hidden;
        }

        .ct-composer {
          border: 1px solid #2c2c34;
          border-radius: 17px;
          padding: 8px 8px 7px;
          background: #141418;
          display: grid;
          gap: 6px;
        }

        .ct-page-card {
          display: flex;
          align-items: center;
          gap: 7px;
          background: #3a3a3f;
          border-radius: 13px;
          padding: 7px 8px;
          width: fit-content;
          max-width: 100%;
          position: relative;
        }

        .ct-page-card.hidden {
          display: none;
        }

        .ct-page-favicon {
          width: 34px;
          height: 34px;
          border-radius: 8px;
          object-fit: cover;
          flex-shrink: 0;
          background: #0f0f12;
        }

        .ct-page-meta {
          min-width: 0;
          max-width: 165px;
        }

        .ct-page-title {
          margin: 0;
          color: #f5f5f7;
          font-size: 10px;
          font-weight: 700;
          line-height: 1.3;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .ct-page-host {
          margin: 1px 0 0;
          color: #b9b9c0;
          font-size: 9px;
          line-height: 1.2;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .ct-page-off {
          border: 1px solid #34343d;
          border-radius: 999px;
          background: #19191d;
          color: #c8c8cf;
          font-size: 9px;
          font-weight: 600;
          padding: 4px 7px;
          cursor: pointer;
          width: fit-content;
          max-width: 100%;
        }

        .ct-page-off.hidden {
          display: none;
        }

        .ct-page-clear {
          position: absolute;
          top: -7px;
          right: -7px;
          width: 20px;
          height: 20px;
          border: 1px solid #4e4e57;
          border-radius: 999px;
          background: #53535a;
          color: #f3f3f7;
          font-size: 13px;
          line-height: 1;
          cursor: pointer;
          display: grid;
          place-items: center;
          padding: 0;
        }

        .ct-input {
          width: 100%;
          min-height: 63px;
          max-height: 154px;
          resize: vertical;
          border: 0;
          border-radius: 8px;
          padding: 4px 1px;
          font: inherit;
          font-size: 11px;
          line-height: 1.4;
          outline: none;
          color: #f5f5f7;
          background: transparent;
          box-sizing: border-box;
        }

        .ct-input::placeholder {
          color: #7f7f88;
        }

        .ct-toolbar {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          align-items: center;
          gap: 6px;
        }

        .ct-toolbar-left {
          display: flex;
          align-items: center;
          gap: 6px;
          min-width: 0;
          overflow-x: auto;
          overflow-y: hidden;
          scrollbar-width: thin;
          padding-bottom: 1px;
        }

        .ct-select {
          appearance: none;
          border: 1px solid #34343d;
          border-radius: 999px;
          padding: 5px 8px;
          background: #17171c;
          color: #d9d9e0;
          font: inherit;
          font-size: 10px;
          line-height: 1.3;
          min-width: 66px;
          max-width: 108px;
          flex: 0 1 auto;
        }

        .ct-select:focus {
          outline: none;
          border-color: #5b5b66;
          box-shadow: 0 0 0 2px rgba(120, 120, 128, 0.2);
        }

        .ct-send {
          border: 0;
          background: #f5f5f7;
          color: #111114;
          padding: 6px 10px;
          border-radius: 999px;
          font-size: 9px;
          font-weight: 700;
          cursor: pointer;
          flex-shrink: 0;
          min-width: 42px;
          white-space: nowrap;
        }

        @media (max-width: 560px) {
          .ct-panel {
            width: calc(100vw - 8px);
            max-width: calc(100vw - 8px);
          }

          .ct-select {
            min-width: 59px;
            max-width: 90px;
          }
        }

        .ct-send:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

      </style>

      <div class="ct-shell" id="ct-shell" aria-hidden="true">
        <div class="ct-backdrop" id="ct-backdrop"></div>
        <aside class="ct-panel" id="ct-panel" role="dialog" aria-label="CodexTab Chat Sidebar">
          <div class="ct-resizer" id="ct-resizer" aria-hidden="true"></div>
          <button class="ct-close" id="ct-close" aria-label="Close">×</button>
          <div class="ct-messages" id="ct-messages"></div>
          <div class="ct-input-wrap">
            <div class="ct-composer">
              <div class="ct-page-card" id="ct-page-card">
                <img class="ct-page-favicon" id="ct-page-favicon" alt="" />
                <div class="ct-page-meta">
                  <p class="ct-page-title" id="ct-page-title">Loading...</p>
                  <p class="ct-page-host" id="ct-page-host">-</p>
                </div>
                <button class="ct-page-clear" id="ct-page-clear" aria-label="ページ読み取りをオフ">×</button>
              </div>
              <button class="ct-page-off hidden" id="ct-page-off">ページ読み取りを有効化</button>
              <textarea class="ct-input" id="ct-input" placeholder="このページについてCodexに質問する"></textarea>
              <div class="ct-toolbar">
                <div class="ct-toolbar-left">
                  <select class="ct-select" id="ct-model" aria-label="AIモデル">
                    <option value="">Auto model</option>
                    <option value="gpt-5.2-codex">gpt-5.2-codex</option>
                    <option value="gpt-5-codex">gpt-5-codex</option>
                  </select>
                  <select class="ct-select" id="ct-reasoning" aria-label="思考の量">
                    <option value="low">Low</option>
                    <option value="medium" selected>Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <button class="ct-send" id="ct-send">送信 ⌘↩</button>
              </div>
            </div>
          </div>
        </aside>
      </div>
    `;

    document.documentElement.appendChild(root);

    const dom = {
      shell: shadow.getElementById("ct-shell"),
      backdrop: shadow.getElementById("ct-backdrop"),
      panel: shadow.querySelector(".ct-panel"),
      resizer: shadow.getElementById("ct-resizer"),
      closeButton: shadow.getElementById("ct-close"),
      messages: shadow.getElementById("ct-messages"),
      input: shadow.getElementById("ct-input"),
      sendButton: shadow.getElementById("ct-send"),
      modelSelect: shadow.getElementById("ct-model"),
      reasoningSelect: shadow.getElementById("ct-reasoning"),
      pageCard: shadow.getElementById("ct-page-card"),
      pageFavicon: shadow.getElementById("ct-page-favicon"),
      pageTitle: shadow.getElementById("ct-page-title"),
      pageHost: shadow.getElementById("ct-page-host"),
      pageClearButton: shadow.getElementById("ct-page-clear"),
      pageOffButton: shadow.getElementById("ct-page-off")
    };

    dom.backdrop.addEventListener("click", () => closeSidebar());
    dom.closeButton.addEventListener("click", () => closeSidebar());
    dom.sendButton.addEventListener("click", () => void sendMessage());
    dom.resizer.addEventListener("mousedown", beginResize);
    dom.shell.addEventListener("keydown", trapSidebarKeyboardEvents);
    dom.shell.addEventListener("keypress", trapSidebarKeyboardEvents);
    dom.shell.addEventListener("keyup", trapSidebarKeyboardEvents);

    dom.pageClearButton.addEventListener("click", () => {
      state.pageContextEnabled = false;
      applySettingsToDom();
      saveSettings();
    });

    dom.pageOffButton.addEventListener("click", () => {
      state.pageContextEnabled = true;
      applySettingsToDom();
      saveSettings();
    });

    dom.modelSelect.addEventListener("change", (event) => {
      state.selectedModel = normalizeModel(String(event.target?.value || ""));
      saveSettings();
    });

    dom.reasoningSelect.addEventListener("change", (event) => {
      state.reasoningEffort = normalizeReasoningEffort(String(event.target?.value || "medium"));
      saveSettings();
    });

    dom.input.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeSidebar();
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        void sendMessage();
        return;
      }

      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        void sendMessage();
      }
    });

    state.dom = dom;
    state.mounted = true;

    applySettingsToDom();
    void loadSettings();
  }

  function toggleSidebar() {
    if (state.open) {
      closeSidebar();
    } else {
      openSidebar();
    }
  }

  function openSidebar() {
    if (!state.mounted || !state.dom) {
      return;
    }

    state.open = true;
    state.dom.shell.classList.add("open");
    state.dom.shell.setAttribute("aria-hidden", "false");
    refreshPageCard();
    applyPanelWidth();
    state.dom.input.focus();
  }

  function closeSidebar() {
    if (!state.mounted || !state.dom) {
      return;
    }

    state.open = false;
    state.dom.shell.classList.remove("open");
    state.dom.shell.setAttribute("aria-hidden", "true");
  }

  async function sendMessage() {
    if (!state.dom || state.sending) {
      return;
    }

    const text = String(state.dom.input.value || "").trim();
    if (!text) {
      return;
    }

    state.sending = true;
    state.dom.sendButton.disabled = true;
    state.dom.input.disabled = true;

    appendUserMessage(text);
    state.dom.input.value = "";

    const pending = appendAssistantMessage("Thinking...", { pending: true });
    const includePageContext = state.pageContextEnabled;
    const pageContext = includePageContext ? getPageContext() : null;
    state.pageContext = pageContext;

    let response;
    try {
      response = await chrome.runtime.sendMessage({
        type: "CODEXTAB_CHAT",
        payload: {
          message: text,
          threadId: state.threadId,
          pageContext,
          includePageContext,
          model: state.selectedModel || null,
          reasoningEffort: state.reasoningEffort
        }
      });
    } catch (error) {
      response = {
        ok: false,
        error: String(error?.message ?? error ?? "Unknown error")
      };
    }

    pending.remove();

    if (!response?.ok) {
      appendAssistantMessage(`Error: ${response?.error || "failed to get response"}`);
    } else {
      state.threadId = response.threadId || state.threadId;
      await appendAssistantMessageStreaming(response.answer || "(no assistant message)");
    }

    state.sending = false;
    state.dom.sendButton.disabled = false;
    state.dom.input.disabled = false;
    state.dom.input.focus();
  }

  function appendUserMessage(text) {
    if (!state.dom) {
      return;
    }
    appendMessage(text, "user");
  }

  function appendAssistantMessage(text, options = {}) {
    if (!state.dom) {
      return document.createElement("div");
    }
    return appendMessage(text, "assistant", options);
  }

  function appendSystemMessage(text) {
    if (!state.dom) {
      return;
    }
    appendMessage(text, "system");
  }

  async function appendAssistantMessageStreaming(markdownText) {
    if (!state.dom) {
      return;
    }

    const targetText = String(markdownText || "");
    const bubble = createMessageBubble("assistant");
    bubble.classList.add("streaming");
    const body = document.createElement("div");
    body.className = "ct-md";
    bubble.appendChild(body);
    state.dom.messages.appendChild(bubble);

    const total = targetText.length;
    if (total === 0) {
      body.innerHTML = "<p>(empty)</p>";
      bubble.classList.remove("streaming");
      state.dom.messages.scrollTop = state.dom.messages.scrollHeight;
      return;
    }

    const chunk = total > 5000 ? 170 : total > 2500 ? 100 : 45;
    let cursor = 0;

    while (cursor < total) {
      cursor = Math.min(total, cursor + chunk);
      const partial = targetText.slice(0, cursor);
      body.innerHTML = renderMarkdown(partial);
      state.dom.messages.scrollTop = state.dom.messages.scrollHeight;
      await sleep(14);
    }

    bubble.classList.remove("streaming");
  }

  function appendMessage(text, role, options = {}) {
    const bubble = createMessageBubble(role);
    bubble.className = `ct-msg ${role}`;
    if (options.pending) {
      bubble.classList.add("pending");
    }

    const normalized = String(text ?? "");
    if (options.markdown) {
      const body = document.createElement("div");
      body.className = "ct-md";
      body.innerHTML = renderMarkdown(normalized);
      bubble.appendChild(body);
    } else {
      bubble.textContent = normalized;
    }

    state.dom.messages.appendChild(bubble);
    state.dom.messages.scrollTop = state.dom.messages.scrollHeight;
    return bubble;
  }

  function createMessageBubble(role) {
    const bubble = document.createElement("div");
    bubble.className = `ct-msg ${role}`;
    return bubble;
  }

  function getPageContext() {
    const selection = normalizeText(window.getSelection()?.toString() || "");
    const bodyText = extractMainText();
    const title = normalizeText(document.title || "");
    const headings = collectHeadings();

    return {
      title,
      url: window.location.href,
      selection: truncate(selection, 1200),
      headings,
      text: truncate(bodyText, 15000)
    };
  }

  function extractMainText() {
    const candidateSelectors = [
      "article",
      "main",
      "[role='main']",
      ".post-content",
      ".entry-content",
      ".article-content"
    ];

    let bestText = "";

    for (const selector of candidateSelectors) {
      const nodes = document.querySelectorAll(selector);
      for (const node of nodes) {
        const text = normalizeText(node.innerText || "");
        if (text.length > bestText.length) {
          bestText = text;
        }
      }
    }

    if (bestText.length < 800) {
      bestText = normalizeText(document.body?.innerText || "");
    }

    return bestText;
  }

  function collectHeadings() {
    const headings = [];
    const nodes = document.querySelectorAll("h1, h2, h3");

    for (const node of nodes) {
      const text = normalizeText(node.textContent || "");
      if (!text) {
        continue;
      }
      headings.push(text);
      if (headings.length >= 12) {
        break;
      }
    }

    return headings;
  }

  function normalizeText(text) {
    return String(text || "")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function truncate(text, max) {
    if (text.length <= max) {
      return text;
    }
    return `${text.slice(0, max)}...`;
  }

  function sleep(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  async function loadSettings() {
    try {
      const stored = await chrome.storage.local.get(SETTINGS_KEY);
      const value = stored?.[SETTINGS_KEY];
      if (!value || typeof value !== "object") {
        return;
      }

      state.pageContextEnabled = Boolean(value.pageContextEnabled ?? DEFAULT_SETTINGS.pageContextEnabled);
      state.selectedModel = normalizeModel(String(value.selectedModel ?? DEFAULT_SETTINGS.selectedModel));
      state.reasoningEffort = normalizeReasoningEffort(String(value.reasoningEffort ?? DEFAULT_SETTINGS.reasoningEffort));
      state.panelWidth = normalizePanelWidth(Number(value.panelWidth ?? DEFAULT_SETTINGS.panelWidth));

      applySettingsToDom();
    } catch (_error) {
      // ignore storage read errors
    }
  }

  function saveSettings() {
    try {
      chrome.storage.local.set({
        [SETTINGS_KEY]: {
          pageContextEnabled: state.pageContextEnabled,
          selectedModel: state.selectedModel,
          reasoningEffort: state.reasoningEffort,
          panelWidth: state.panelWidth
        }
      });
    } catch (_error) {
      // ignore storage write errors
    }
  }

  function applySettingsToDom() {
    if (!state.dom) {
      return;
    }

    const modelValue = state.selectedModel || "";
    const modelExists = Array.from(state.dom.modelSelect.options).some((option) => option.value === modelValue);
    state.dom.modelSelect.value = modelExists ? modelValue : "";

    state.dom.reasoningSelect.value = normalizeReasoningEffort(state.reasoningEffort);
    state.dom.input.placeholder = state.pageContextEnabled ? "このページについてCodexに質問する" : "Codexに質問する";
    state.dom.pageCard.classList.toggle("hidden", !state.pageContextEnabled);
    state.dom.pageOffButton.classList.toggle("hidden", state.pageContextEnabled);
    refreshPageCard();
    applyPanelWidth();
  }

  function normalizeModel(value) {
    const model = String(value || "").trim();
    return model;
  }

  function normalizeReasoningEffort(value) {
    const normalized = String(value || "medium").toLowerCase();
    if (normalized === "low" || normalized === "high") {
      return normalized;
    }
    return "medium";
  }

  function normalizePanelWidth(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return DEFAULT_SETTINGS.panelWidth;
    }

    const minWidth = 320;
    const maxWidth = Math.max(360, window.innerWidth - 8);
    return Math.round(Math.min(maxWidth, Math.max(minWidth, numeric)));
  }

  function applyPanelWidth() {
    if (!state.dom?.panel) {
      return;
    }
    state.panelWidth = normalizePanelWidth(state.panelWidth);
    state.dom.panel.style.width = `${state.panelWidth}px`;
  }

  function beginResize(event) {
    if (!state.dom || !state.open || event.button !== 0) {
      return;
    }
    event.preventDefault();

    const startX = event.clientX;
    const startWidth = state.panelWidth;
    state.resizing = true;
    state.dom.shell.classList.add("resizing");

    const onMove = (moveEvent) => {
      const delta = startX - moveEvent.clientX;
      state.panelWidth = normalizePanelWidth(startWidth + delta);
      applyPanelWidth();
    };

    const onUp = () => {
      state.resizing = false;
      state.dom.shell.classList.remove("resizing");
      window.removeEventListener("mousemove", onMove, true);
      window.removeEventListener("mouseup", onUp, true);
      saveSettings();
    };

    window.addEventListener("mousemove", onMove, true);
    window.addEventListener("mouseup", onUp, true);
  }

  function refreshPageCard() {
    if (!state.dom || !state.pageContextEnabled) {
      return;
    }

    const data = getPageCardData();
    state.dom.pageTitle.textContent = data.title;
    state.dom.pageHost.textContent = data.host;
    state.dom.pageFavicon.src = data.faviconUrl;
    state.dom.pageFavicon.alt = `${data.title} favicon`;
  }

  function getPageCardData() {
    const title = truncate(normalizeText(document.title || "") || "Untitled", 60);
    let host = "";
    try {
      host = window.location.hostname || "";
    } catch (_error) {
      host = "";
    }
    const faviconUrl = resolveFaviconUrl();

    return {
      title,
      host: host || "unknown host",
      faviconUrl
    };
  }

  function resolveFaviconUrl() {
    const iconSelectors = [
      "link[rel='icon']",
      "link[rel='shortcut icon']",
      "link[rel='apple-touch-icon']",
      "link[rel='mask-icon']"
    ];

    for (const selector of iconSelectors) {
      const node = document.querySelector(selector);
      const href = String(node?.getAttribute?.("href") || "").trim();
      if (!href) {
        continue;
      }
      try {
        return new URL(href, window.location.href).toString();
      } catch (_error) {
        // try next candidate
      }
    }

    try {
      return `${window.location.origin}/favicon.ico`;
    } catch (_error) {
      return "";
    }
  }

  function renderMarkdown(markdownText) {
    const source = String(markdownText || "").replace(/\r\n?/g, "\n");
    const lines = source.split("\n");
    const blocks = [];

    let paragraph = [];
    let listItems = [];
    let listType = null;
    let inCode = false;
    let codeLang = "";
    let codeLines = [];

    function flushParagraph() {
      if (!paragraph.length) {
        return;
      }
      const content = paragraph.join("<br>");
      blocks.push(`<p>${content}</p>`);
      paragraph = [];
    }

    function flushList() {
      if (!listItems.length || !listType) {
        listItems = [];
        listType = null;
        return;
      }
      const tag = listType === "ol" ? "ol" : "ul";
      blocks.push(`<${tag}>${listItems.join("")}</${tag}>`);
      listItems = [];
      listType = null;
    }

    function flushCode() {
      if (!inCode) {
        return;
      }
      const klass = codeLang ? ` class="lang-${escapeHtml(codeLang)}"` : "";
      blocks.push(`<pre><code${klass}>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
      inCode = false;
      codeLang = "";
      codeLines = [];
    }

    for (const rawLine of lines) {
      const line = rawLine ?? "";
      const trimmed = line.trim();

      if (trimmed.startsWith("```")) {
        if (inCode) {
          flushCode();
        } else {
          flushParagraph();
          flushList();
          inCode = true;
          codeLang = trimmed.slice(3).trim();
        }
        continue;
      }

      if (inCode) {
        codeLines.push(line);
        continue;
      }

      if (!trimmed) {
        flushParagraph();
        flushList();
        continue;
      }

      if (trimmed === "---" || trimmed === "***") {
        flushParagraph();
        flushList();
        blocks.push("<hr>");
        continue;
      }

      const headingMatch = /^(#{1,4})\s+(.+)$/.exec(trimmed);
      if (headingMatch) {
        flushParagraph();
        flushList();
        const depth = headingMatch[1].length;
        const content = applyInlineMarkdown(headingMatch[2]);
        blocks.push(`<h${depth}>${content}</h${depth}>`);
        continue;
      }

      const ulMatch = /^[-*]\s+(.+)$/.exec(trimmed);
      if (ulMatch) {
        flushParagraph();
        if (listType && listType !== "ul") {
          flushList();
        }
        listType = "ul";
        listItems.push(`<li>${applyInlineMarkdown(ulMatch[1])}</li>`);
        continue;
      }

      const olMatch = /^\d+\.\s+(.+)$/.exec(trimmed);
      if (olMatch) {
        flushParagraph();
        if (listType && listType !== "ol") {
          flushList();
        }
        listType = "ol";
        listItems.push(`<li>${applyInlineMarkdown(olMatch[1])}</li>`);
        continue;
      }

      paragraph.push(applyInlineMarkdown(trimmed));
    }

    flushParagraph();
    flushList();
    flushCode();

    return blocks.join("");
  }

  function applyInlineMarkdown(text) {
    let safe = escapeHtml(String(text || ""));

    safe = safe.replace(/`([^`]+)`/g, (_m, code) => `<code>${code}</code>`);
    safe = safe.replace(/\*\*([^*]+)\*\*/g, (_m, strong) => `<strong>${strong}</strong>`);
    safe = safe.replace(/\*([^*]+)\*/g, (_m, em) => `<em>${em}</em>`);

    return safe;
  }

  function escapeHtml(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function eventIsFromSidebar(event) {
    if (!state.dom || typeof event?.composedPath !== "function") {
      return false;
    }

    return event.composedPath().includes(state.dom.shell);
  }

  function trapSidebarKeyboardEvents(event) {
    if (!state.open || !eventIsFromSidebar(event)) {
      return;
    }

    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === "function") {
      event.stopImmediatePropagation();
    }
  }

  function isEditableTarget(target) {
    const element = target instanceof Element ? target : null;
    if (!element) {
      return false;
    }

    if (element.closest("input, textarea, select, [contenteditable='true'], [contenteditable='']")) {
      return true;
    }

    return false;
  }
})();
