(() => {
  const ROOT_ID = "codextab-root";
  const SETTINGS_KEY = "codextab-settings-v1";
  const DEFAULT_SETTINGS = {
    includePageContextEachTurn: true,
    pageContextEnabled: true,
    selectedModel: "",
    reasoningEffort: "medium"
  };

  const state = {
    mounted: false,
    open: false,
    sending: false,
    threadId: null,
    pageContext: null,
    lastUrl: window.location.href,
    includePageContextEachTurn: DEFAULT_SETTINGS.includePageContextEachTurn,
    pageContextEnabled: DEFAULT_SETTINGS.pageContextEnabled,
    selectedModel: DEFAULT_SETTINGS.selectedModel,
    reasoningEffort: DEFAULT_SETTINGS.reasoningEffort,
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

      if (isEditableTarget(event.target)) {
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
          color: #1d1d1f;
        }

        .ct-shell.open {
          pointer-events: auto;
        }

        .ct-backdrop {
          position: absolute;
          inset: 0;
          background: rgba(16, 16, 18, 0.2);
          opacity: 0;
          transition: opacity 220ms ease;
          backdrop-filter: blur(2px);
        }

        .ct-shell.open .ct-backdrop {
          opacity: 1;
        }

        .ct-panel {
          position: absolute;
          top: 0;
          right: 0;
          width: min(430px, 94vw);
          height: 100%;
          display: grid;
          grid-template-rows: 1fr auto;
          background: rgba(250, 250, 252, 0.96);
          border-left: 1px solid #d7d7dc;
          box-shadow: -18px 0 44px rgba(20, 20, 22, 0.16);
          transform: translateX(36px);
          opacity: 0;
          transition: transform 260ms cubic-bezier(0.22, 1, 0.36, 1), opacity 260ms ease;
          backdrop-filter: blur(16px);
        }

        .ct-shell.open .ct-panel {
          transform: translateX(0);
          opacity: 1;
        }

        .ct-close {
          position: absolute;
          top: 10px;
          right: 10px;
          border: 1px solid #d8d8dd;
          background: rgba(255, 255, 255, 0.9);
          color: #404044;
          width: 28px;
          height: 28px;
          border-radius: 999px;
          font-size: 16px;
          line-height: 1;
          cursor: pointer;
          z-index: 2;
        }

        .ct-close:hover {
          background: #ffffff;
          color: #1d1d1f;
        }

        .ct-messages {
          overflow: auto;
          padding: 44px 14px 14px;
          display: flex;
          flex-direction: column;
          gap: 10px;
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
          background: #1f1f22;
          color: #ffffff;
          border-bottom-right-radius: 4px;
        }

        .ct-msg.assistant {
          margin-right: auto;
          background: #f3f3f5;
          color: #1f1f22;
          border: 1px solid #e3e3e8;
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
          color: #1f1f22;
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
          background: #17171a;
          color: #f8f8fa;
          overflow: auto;
          font-size: 12px;
          line-height: 1.45;
        }

        .ct-md code {
          background: #e8e8ed;
          color: #1f1f22;
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
          border-top: 1px solid #d8d8de;
          margin: 0.8em 0;
        }

        .ct-msg.system {
          margin: 0 auto;
          background: #efeff4;
          color: #55555d;
          border: 1px solid #dfdfe6;
          font-size: 12px;
          text-align: center;
        }

        .ct-msg.pending {
          opacity: 0.75;
          font-style: italic;
        }

        .ct-input-wrap {
          padding: 12px;
          border-top: 1px solid #dedee4;
          background: rgba(249, 249, 251, 0.94);
          display: grid;
          gap: 10px;
        }

        .ct-settings {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }

        .ct-field {
          display: grid;
          gap: 4px;
          font-size: 11px;
          color: #66666f;
        }

        .ct-select {
          appearance: none;
          border: 1px solid #d4d4dc;
          border-radius: 9px;
          padding: 7px 9px;
          background: #ffffff;
          color: #1f1f22;
          font: inherit;
          font-size: 12px;
          line-height: 1.3;
        }

        .ct-select:focus {
          outline: none;
          border-color: #a8a8b2;
          box-shadow: 0 0 0 2px rgba(120, 120, 128, 0.14);
        }

        .ct-input {
          width: 100%;
          min-height: 78px;
          max-height: 190px;
          resize: vertical;
          border: 1px solid #d4d4dc;
          border-radius: 12px;
          padding: 10px;
          font: inherit;
          font-size: 13px;
          line-height: 1.45;
          outline: none;
          color: #1f1f22;
          background: #ffffff;
          box-sizing: border-box;
        }

        .ct-input:focus {
          border-color: #a8a8b2;
          box-shadow: 0 0 0 3px rgba(120, 120, 128, 0.15);
        }

        .ct-controls {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }

        .ct-checkbox {
          font-size: 12px;
          color: #42424a;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          user-select: none;
        }

        .ct-checkbox.disabled {
          opacity: 0.55;
        }

        .ct-send {
          border: 0;
          background: #1d1d1f;
          color: #ffffff;
          padding: 8px 14px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }

        .ct-send:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      </style>

      <div class="ct-shell" id="ct-shell" aria-hidden="true">
        <div class="ct-backdrop" id="ct-backdrop"></div>
        <aside class="ct-panel" role="dialog" aria-label="CodexTab Chat Sidebar">
          <button class="ct-close" id="ct-close" aria-label="Close">×</button>
          <div class="ct-messages" id="ct-messages"></div>
          <div class="ct-input-wrap">
            <div class="ct-settings">
              <label class="ct-field">
                <span>AIモデル</span>
                <select class="ct-select" id="ct-model">
                  <option value="">既定（自動）</option>
                  <option value="gpt-5.2-codex">gpt-5.2-codex</option>
                  <option value="gpt-5-codex">gpt-5-codex</option>
                </select>
              </label>
              <label class="ct-field">
                <span>思考の量</span>
                <select class="ct-select" id="ct-reasoning">
                  <option value="low">low</option>
                  <option value="medium" selected>medium</option>
                  <option value="high">high</option>
                </select>
              </label>
              <label class="ct-field">
                <span>ページ読み込み</span>
                <select class="ct-select" id="ct-page-context">
                  <option value="on" selected>あり</option>
                  <option value="off">なし</option>
                </select>
              </label>
            </div>
            <textarea class="ct-input" id="ct-input" placeholder="メッセージを入力（Enterで送信 / Shift+Enterで改行）"></textarea>
            <div class="ct-controls">
              <label class="ct-checkbox" id="ct-context-label">
                <input type="checkbox" id="ct-context" checked />
                毎ターンページ情報を含める
              </label>
              <button class="ct-send" id="ct-send">送信</button>
            </div>
          </div>
        </aside>
      </div>
    `;

    document.documentElement.appendChild(root);

    const dom = {
      shell: shadow.getElementById("ct-shell"),
      backdrop: shadow.getElementById("ct-backdrop"),
      closeButton: shadow.getElementById("ct-close"),
      messages: shadow.getElementById("ct-messages"),
      input: shadow.getElementById("ct-input"),
      sendButton: shadow.getElementById("ct-send"),
      contextCheckbox: shadow.getElementById("ct-context"),
      contextLabel: shadow.getElementById("ct-context-label"),
      modelSelect: shadow.getElementById("ct-model"),
      reasoningSelect: shadow.getElementById("ct-reasoning"),
      pageContextSelect: shadow.getElementById("ct-page-context")
    };

    dom.backdrop.addEventListener("click", () => closeSidebar());
    dom.closeButton.addEventListener("click", () => closeSidebar());
    dom.sendButton.addEventListener("click", () => void sendMessage());

    dom.contextCheckbox.addEventListener("change", (event) => {
      state.includePageContextEachTurn = Boolean(event.target?.checked);
      saveSettings();
    });

    dom.pageContextSelect.addEventListener("change", (event) => {
      state.pageContextEnabled = String(event.target?.value || "on") !== "off";
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
    const includePageContext = state.pageContextEnabled && (!state.threadId || state.includePageContextEachTurn);
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

      state.includePageContextEachTurn = Boolean(value.includePageContextEachTurn ?? DEFAULT_SETTINGS.includePageContextEachTurn);
      state.pageContextEnabled = Boolean(value.pageContextEnabled ?? DEFAULT_SETTINGS.pageContextEnabled);
      state.selectedModel = normalizeModel(String(value.selectedModel ?? DEFAULT_SETTINGS.selectedModel));
      state.reasoningEffort = normalizeReasoningEffort(String(value.reasoningEffort ?? DEFAULT_SETTINGS.reasoningEffort));

      applySettingsToDom();
    } catch (_error) {
      // ignore storage read errors
    }
  }

  function saveSettings() {
    try {
      chrome.storage.local.set({
        [SETTINGS_KEY]: {
          includePageContextEachTurn: state.includePageContextEachTurn,
          pageContextEnabled: state.pageContextEnabled,
          selectedModel: state.selectedModel,
          reasoningEffort: state.reasoningEffort
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

    state.dom.contextCheckbox.checked = state.includePageContextEachTurn;
    state.dom.contextCheckbox.disabled = !state.pageContextEnabled;
    state.dom.contextLabel.classList.toggle("disabled", !state.pageContextEnabled);
    state.dom.pageContextSelect.value = state.pageContextEnabled ? "on" : "off";

    const modelValue = state.selectedModel || "";
    const modelExists = Array.from(state.dom.modelSelect.options).some((option) => option.value === modelValue);
    state.dom.modelSelect.value = modelExists ? modelValue : "";

    state.dom.reasoningSelect.value = normalizeReasoningEffort(state.reasoningEffort);
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
