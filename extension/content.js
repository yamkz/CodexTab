(() => {
  const ROOT_ID = "codextab-root";

  const state = {
    mounted: false,
    open: false,
    sending: false,
    threadId: null,
    pageContext: null,
    lastUrl: window.location.href,
    includePageContextEachTurn: true,
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
      appendSystemMessage("Page changed. Conversation context was reset.");
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
          font-family: "Manrope", "Noto Sans", "Helvetica Neue", Arial, sans-serif;
          color: #131722;
        }

        .ct-shell.open {
          pointer-events: auto;
        }

        .ct-backdrop {
          position: absolute;
          inset: 0;
          background: rgba(4, 9, 18, 0.22);
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
          width: min(430px, 94vw);
          height: 100%;
          display: grid;
          grid-template-rows: auto auto 1fr auto;
          background: linear-gradient(180deg, #fdfefe 0%, #f4f8ff 100%);
          border-left: 1px solid #dbe4f5;
          box-shadow: -18px 0 44px rgba(13, 27, 50, 0.25);
          transform: translateX(38px);
          opacity: 0;
          transition: transform 260ms cubic-bezier(0.22, 1, 0.36, 1), opacity 260ms ease;
          backdrop-filter: blur(10px);
        }

        .ct-shell.open .ct-panel {
          transform: translateX(0);
          opacity: 1;
        }

        .ct-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 16px;
          border-bottom: 1px solid #d7e2f2;
          background: rgba(255, 255, 255, 0.75);
        }

        .ct-title {
          margin: 0;
          font-size: 16px;
          font-weight: 700;
          letter-spacing: 0.2px;
        }

        .ct-close {
          border: 0;
          background: #e9eef9;
          color: #273145;
          width: 32px;
          height: 32px;
          border-radius: 10px;
          font-size: 18px;
          line-height: 1;
          cursor: pointer;
        }

        .ct-close:hover {
          background: #dce6f9;
        }

        .ct-meta {
          display: grid;
          grid-template-columns: 1fr;
          gap: 6px;
          padding: 10px 16px;
          border-bottom: 1px solid #d7e2f2;
          background: rgba(246, 250, 255, 0.9);
        }

        .ct-chip {
          font-size: 12px;
          color: #1d2840;
          background: #eaf1ff;
          border: 1px solid #d3e0ff;
          padding: 5px 8px;
          border-radius: 999px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .ct-chip.error {
          background: #fff1f1;
          border-color: #ffd1d1;
          color: #7a1414;
        }

        .ct-messages {
          overflow: auto;
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .ct-msg {
          max-width: 90%;
          padding: 10px 12px;
          border-radius: 12px;
          font-size: 13px;
          line-height: 1.45;
          white-space: pre-wrap;
          word-break: break-word;
        }

        .ct-msg.user {
          margin-left: auto;
          background: #1f6feb;
          color: #ffffff;
          border-bottom-right-radius: 4px;
        }

        .ct-msg.assistant {
          margin-right: auto;
          background: #ffffff;
          color: #0e1522;
          border: 1px solid #d9e3f4;
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
          color: #0f1b34;
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
          background: #0f1728;
          color: #f8fbff;
          overflow: auto;
          font-size: 12px;
          line-height: 1.45;
        }

        .ct-md code {
          background: #edf2fb;
          color: #0f2348;
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
          border-top: 1px solid #d7e0ef;
          margin: 0.8em 0;
        }

        .ct-msg.system {
          margin: 0 auto;
          background: #f0f4fc;
          color: #324665;
          border: 1px solid #d8e3f5;
          font-size: 12px;
          text-align: center;
        }

        .ct-msg.pending {
          opacity: 0.75;
          font-style: italic;
        }

        .ct-input-wrap {
          padding: 12px;
          border-top: 1px solid #d7e2f2;
          background: rgba(253, 254, 255, 0.95);
          display: grid;
          gap: 8px;
        }

        .ct-input {
          width: 100%;
          min-height: 76px;
          max-height: 180px;
          resize: vertical;
          border: 1px solid #ccdaef;
          border-radius: 12px;
          padding: 10px;
          font: inherit;
          font-size: 13px;
          line-height: 1.45;
          outline: none;
          color: #13203a;
          background: #ffffff;
          box-sizing: border-box;
        }

        .ct-input:focus {
          border-color: #4c86e9;
          box-shadow: 0 0 0 3px rgba(76, 134, 233, 0.15);
        }

        .ct-controls {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }

        .ct-checkbox {
          font-size: 12px;
          color: #273145;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          user-select: none;
        }

        .ct-send {
          border: 0;
          background: #1f6feb;
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
          <header class="ct-header">
            <h2 class="ct-title">CodexTab</h2>
            <button class="ct-close" id="ct-close" aria-label="Close">×</button>
          </header>
          <div class="ct-meta">
            <div class="ct-chip" id="ct-page-chip">Page: loading...</div>
            <div class="ct-chip" id="ct-host-chip">Host: checking...</div>
          </div>
          <div class="ct-messages" id="ct-messages"></div>
          <div class="ct-input-wrap">
            <textarea class="ct-input" id="ct-input" placeholder="Ask with page context (Enter to send, Shift+Enter for newline)"></textarea>
            <div class="ct-controls">
              <label class="ct-checkbox">
                <input type="checkbox" id="ct-context" checked />
                Include page context every turn
              </label>
              <button class="ct-send" id="ct-send">Send</button>
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
      pageChip: shadow.getElementById("ct-page-chip"),
      hostChip: shadow.getElementById("ct-host-chip"),
      input: shadow.getElementById("ct-input"),
      sendButton: shadow.getElementById("ct-send"),
      contextCheckbox: shadow.getElementById("ct-context")
    };

    dom.backdrop.addEventListener("click", () => closeSidebar());
    dom.closeButton.addEventListener("click", () => closeSidebar());
    dom.sendButton.addEventListener("click", () => void sendMessage());
    dom.contextCheckbox.addEventListener("change", (event) => {
      state.includePageContextEachTurn = Boolean(event.target?.checked);
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

    appendSystemMessage("Press Command+E to open/close this sidebar.");
    refreshPageChip();
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
    refreshPageChip();
    void refreshHostStatus();
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

  async function refreshHostStatus() {
    if (!state.dom) {
      return;
    }

    state.dom.hostChip.textContent = "Host: checking...";
    state.dom.hostChip.classList.remove("error");

    const response = await chrome.runtime.sendMessage({ type: "CODEXTAB_PING" });

    if (response?.ok) {
      const version = response.version ? `, codex ${response.version}` : "";
      state.dom.hostChip.textContent = `Host: connected${version}`;
      state.dom.hostChip.classList.remove("error");
      return;
    }

    state.dom.hostChip.textContent = `Host: ${response?.error ?? "not available"}`;
    state.dom.hostChip.classList.add("error");
  }

  function refreshPageChip() {
    if (!state.dom) {
      return;
    }

    const context = getPageContext();
    const title = truncate(context.title || "Untitled", 80);
    state.dom.pageChip.textContent = `Page: ${title}`;
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

    const pageContext = getPageContext();
    state.pageContext = pageContext;

    const includePageContext = !state.threadId || state.includePageContextEachTurn;

    let response;
    try {
      response = await chrome.runtime.sendMessage({
        type: "CODEXTAB_CHAT",
        payload: {
          message: text,
          threadId: state.threadId,
          pageContext,
          includePageContext
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
      .replace(/"/g, "&quot;")
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
