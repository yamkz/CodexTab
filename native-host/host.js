#!/usr/bin/env node
"use strict";

const { spawn, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const MAX_STDERR = 8000;
const CODEX_TIMEOUT_MS = 3 * 60 * 1000;

let inputBuffer = Buffer.alloc(0);

process.stdin.on("data", (chunk) => {
  inputBuffer = Buffer.concat([inputBuffer, chunk]);
  processIncomingBuffer();
});

process.stdin.on("end", () => {
  process.exit(0);
});

function processIncomingBuffer() {
  while (inputBuffer.length >= 4) {
    const messageLength = inputBuffer.readUInt32LE(0);
    if (inputBuffer.length < 4 + messageLength) {
      return;
    }

    const jsonPayload = inputBuffer.subarray(4, 4 + messageLength).toString("utf8");
    inputBuffer = inputBuffer.subarray(4 + messageLength);

    let message;
    try {
      message = JSON.parse(jsonPayload);
    } catch (error) {
      sendNative({ ok: false, error: `Invalid JSON: ${String(error.message || error)}` });
      continue;
    }

    void handleMessage(message);
  }
}

async function handleMessage(message) {
  if (message?.type === "ping") {
    const result = await handlePing();
    sendNative(result);
    return;
  }

  if (message?.type === "chat") {
    const result = await handleChat(message);
    sendNative(result);
    return;
  }

  sendNative({ ok: false, error: `Unsupported message type: ${String(message?.type ?? "undefined")}` });
}

async function handlePing() {
  const codexPath = resolveCodexPath();
  if (!codexPath) {
    return { ok: false, error: "codex command not found in PATH." };
  }

  const version = await getCodexVersion(codexPath);
  if (!version.ok) {
    return { ok: false, error: version.error };
  }

  return {
    ok: true,
    version: version.version,
    codexPath,
    nodePath: process.execPath
  };
}

async function handleChat(message) {
  const userMessage = String(message?.message ?? "").trim();
  if (!userMessage) {
    return { ok: false, error: "Empty message." };
  }

  const codexPath = resolveCodexPath();
  if (!codexPath) {
    return { ok: false, error: "codex command not found in PATH." };
  }

  const includePageContext = Boolean(message?.includePageContext);
  const pageContext = normalizePageContext(message?.pageContext);
  const threadId = typeof message?.threadId === "string" && message.threadId.trim() ? message.threadId.trim() : null;

  const prompt = buildPrompt({
    userMessage,
    includePageContext,
    pageContext,
    isResume: Boolean(threadId)
  });

  const args = threadId
    ? ["exec", "resume", "--json", "--skip-git-repo-check", threadId, prompt]
    : ["exec", "--json", "--skip-git-repo-check", prompt];

  const result = await runCodexCommand(codexPath, args);

  if (!result.ok) {
    return {
      ok: false,
      error: result.error,
      stderr: result.stderr || null
    };
  }

  return {
    ok: true,
    threadId: result.threadId || threadId,
    answer: result.answer,
    usage: result.usage,
    stderr: result.stderr || null
  };
}

function buildPrompt({ userMessage, includePageContext, pageContext, isResume }) {
  const contextSection = includePageContext
    ? [
        "[PAGE_CONTEXT]",
        `Title: ${pageContext.title}`,
        `URL: ${pageContext.url}`,
        pageContext.selection ? `Selected text: ${pageContext.selection}` : "",
        pageContext.headings.length ? `Headings: ${pageContext.headings.join(" | ")}` : "",
        `Main text excerpt: ${pageContext.text}`,
        "[/PAGE_CONTEXT]"
      ]
        .filter(Boolean)
        .join("\n")
    : "";

  if (!isResume) {
    return [
      "You are Codex CLI assistant inside a Chrome sidebar.",
      "Use the web page context to answer accurately.",
      "If the page context is insufficient, ask a short follow-up question.",
      contextSection,
      "[USER_MESSAGE]",
      userMessage,
      "[/USER_MESSAGE]"
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  if (!contextSection) {
    return userMessage;
  }

  return [contextSection, "[USER_MESSAGE]", userMessage, "[/USER_MESSAGE]"].join("\n\n");
}

function normalizePageContext(pageContext) {
  const fallback = {
    title: "(unknown)",
    url: "(unknown)",
    selection: "",
    headings: [],
    text: ""
  };

  if (!pageContext || typeof pageContext !== "object") {
    return fallback;
  }

  const title = truncate(String(pageContext.title || fallback.title), 200);
  const url = truncate(String(pageContext.url || fallback.url), 600);
  const selection = truncate(String(pageContext.selection || ""), 1500);
  const headings = Array.isArray(pageContext.headings)
    ? pageContext.headings.map((value) => truncate(String(value || ""), 140)).filter(Boolean).slice(0, 12)
    : [];
  const text = truncate(String(pageContext.text || ""), 17000);

  return { title, url, selection, headings, text };
}

async function runCodexCommand(codexPath, args) {
  return await new Promise((resolve) => {
    let stdoutBuffer = "";
    let stderrBuffer = "";
    let timedOut = false;

    const events = [];
    const messages = [];
    let threadId = null;
    let usage = null;

    const child = spawn(codexPath, args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"]
    });

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, CODEX_TIMEOUT_MS);

    child.stdout.on("data", (chunk) => {
      stdoutBuffer += chunk.toString("utf8");
      const lines = stdoutBuffer.split(/\r?\n/);
      stdoutBuffer = lines.pop() || "";

      for (const line of lines) {
        const parsed = tryParseJsonLine(line);
        if (!parsed) {
          continue;
        }
        events.push(parsed);

        if (parsed.type === "thread.started" && parsed.thread_id) {
          threadId = String(parsed.thread_id);
        }

        if (parsed.type === "item.completed" && parsed.item?.type === "agent_message") {
          const text = String(parsed.item.text || "").trim();
          if (text) {
            messages.push(text);
          }
        }

        if (parsed.type === "turn.completed" && parsed.usage) {
          usage = parsed.usage;
        }
      }
    });

    child.stderr.on("data", (chunk) => {
      stderrBuffer += chunk.toString("utf8");
      if (stderrBuffer.length > MAX_STDERR) {
        stderrBuffer = stderrBuffer.slice(-MAX_STDERR);
      }
    });

    child.on("error", (error) => {
      clearTimeout(timeout);
      resolve({
        ok: false,
        error: `Failed to run codex: ${String(error.message || error)}`,
        stderr: stderrBuffer.trim()
      });
    });

    child.on("close", (code) => {
      clearTimeout(timeout);

      if (timedOut) {
        resolve({
          ok: false,
          error: "Codex CLI timed out.",
          stderr: stderrBuffer.trim()
        });
        return;
      }

      const answer = messages.join("\n\n").trim();

      if (code !== 0) {
        resolve({
          ok: false,
          error: `Codex CLI exited with code ${code}.`,
          stderr: stderrBuffer.trim(),
          answer,
          threadId,
          usage
        });
        return;
      }

      if (!answer) {
        const eventTail = events.slice(-3).map((item) => JSON.stringify(item)).join(" | ");
        resolve({
          ok: false,
          error: "No assistant message found in Codex CLI output.",
          stderr: [stderrBuffer.trim(), eventTail].filter(Boolean).join("\n")
        });
        return;
      }

      resolve({
        ok: true,
        answer,
        threadId,
        usage,
        stderr: stderrBuffer.trim()
      });
    });
  });
}

function tryParseJsonLine(line) {
  const trimmed = String(line || "").trim();
  if (!trimmed.startsWith("{")) {
    return null;
  }

  try {
    return JSON.parse(trimmed);
  } catch (_error) {
    return null;
  }
}

function resolveCodexPath() {
  const envPath = process.env.PATH || "";
  const candidates = [];

  if (envPath) {
    for (const part of envPath.split(":")) {
      if (!part) {
        continue;
      }
      candidates.push(path.join(part, "codex"));
    }
  }

  candidates.push("/opt/homebrew/bin/codex");
  candidates.push("/usr/local/bin/codex");
  candidates.push("/usr/bin/codex");

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    } catch (_error) {
      // ignore
    }
  }

  const whichResult = spawnSync("which", ["codex"], { encoding: "utf8" });
  if (whichResult.status === 0 && whichResult.stdout.trim()) {
    return whichResult.stdout.trim();
  }

  return null;
}

async function getCodexVersion(codexPath) {
  return await new Promise((resolve) => {
    const child = spawn(codexPath, ["--version"], {
      stdio: ["ignore", "pipe", "pipe"]
    });

    let output = "";
    let errorOutput = "";

    child.stdout.on("data", (chunk) => {
      output += chunk.toString("utf8");
    });

    child.stderr.on("data", (chunk) => {
      errorOutput += chunk.toString("utf8");
    });

    child.on("error", (error) => {
      resolve({ ok: false, error: `codex --version failed: ${String(error.message || error)}` });
    });

    child.on("close", (code) => {
      if (code !== 0) {
        resolve({
          ok: false,
          error: `codex --version exited with code ${code}: ${errorOutput.trim()}`
        });
        return;
      }

      const line = output.split(/\r?\n/).map((item) => item.trim()).find(Boolean) || "unknown";
      resolve({ ok: true, version: line });
    });
  });
}

function truncate(value, max) {
  const input = String(value || "").trim();
  if (input.length <= max) {
    return input;
  }
  return `${input.slice(0, max)}...`;
}

function sendNative(payload) {
  const json = JSON.stringify(payload);
  const body = Buffer.from(json, "utf8");
  const header = Buffer.alloc(4);
  header.writeUInt32LE(body.length, 0);
  process.stdout.write(Buffer.concat([header, body]));
}
