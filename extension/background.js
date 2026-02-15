const HOST_NAME = "com.codextab.bridge";
const NATIVE_TIMEOUT_MS = 3 * 60 * 1000;

chrome.commands.onCommand.addListener((command) => {
  if (command !== "toggle-sidebar") {
    return;
  }
  void toggleSidebarOnActiveTab();
});

chrome.action.onClicked.addListener(() => {
  void toggleSidebarOnActiveTab();
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "CODEXTAB_CHAT") {
    void handleChat(message.payload).then(sendResponse);
    return true;
  }

  if (message?.type === "CODEXTAB_PING") {
    void pingHost().then(sendResponse);
    return true;
  }

  return false;
});

async function toggleSidebarOnActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab?.id) {
    return;
  }

  try {
    await chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_CODEXTAB_SIDEBAR" });
  } catch (_error) {
    // Content scriptが未注入なタブ(chrome:// など)は無視する。
  }
}

async function pingHost() {
  try {
    const result = await callNative({ type: "ping" });
    return {
      ok: Boolean(result?.ok),
      version: result?.version ?? null,
      codexPath: result?.codexPath ?? null,
      nodePath: result?.nodePath ?? null
    };
  } catch (error) {
    return {
      ok: false,
      error: formatNativeHostError(error)
    };
  }
}

async function handleChat(payload) {
  try {
    const result = await callNative({
      type: "chat",
      message: String(payload?.message ?? "").trim(),
      threadId: payload?.threadId ?? null,
      pageContext: payload?.pageContext ?? null,
      includePageContext: Boolean(payload?.includePageContext)
    });

    if (!result?.ok) {
      return {
        ok: false,
        error: String(result?.error ?? "Codex CLI から異常な応答が返りました。")
      };
    }

    return {
      ok: true,
      answer: String(result.answer ?? ""),
      threadId: result.threadId ?? null,
      usage: result.usage ?? null,
      stderr: result.stderr ?? null
    };
  } catch (error) {
    return {
      ok: false,
      error: formatNativeHostError(error)
    };
  }
}

function callNative(payload) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const port = chrome.runtime.connectNative(HOST_NAME);

    const timeout = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      try {
        port.disconnect();
      } catch (_error) {
        // noop
      }
      reject(new Error("Codex CLI の応答がタイムアウトしました。"));
    }, NATIVE_TIMEOUT_MS);

    port.onMessage.addListener((message) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      try {
        port.disconnect();
      } catch (_error) {
        // noop
      }
      resolve(message);
    });

    port.onDisconnect.addListener(() => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      const err = chrome.runtime.lastError;
      reject(new Error(err?.message || "Native host との接続が切断されました。"));
    });

    try {
      port.postMessage(payload);
    } catch (error) {
      settled = true;
      clearTimeout(timeout);
      try {
        port.disconnect();
      } catch (_error) {
        // noop
      }
      reject(error);
    }
  });
}

function formatNativeHostError(error) {
  const raw = String(error?.message ?? error ?? "不明なエラー");

  if (raw.includes("Specified native messaging host not found")) {
    return "Native host が見つかりません。README の手順で scripts/install-native-host.sh --extension-id <ID> を実行してください。";
  }

  if (raw.includes("Access to the specified native messaging host is forbidden")) {
    return "Native host は登録済みですが、この拡張IDが許可されていません。拡張IDを確認して install スクリプトを再実行してください。";
  }

  return raw;
}
