#!/usr/bin/env node
"use strict";

const { spawnSync } = require("node:child_process");
const { readdirSync, statSync } = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const targets = ["extension", "native-host", "scripts"];
const files = [];

for (const dir of targets) {
  walk(path.join(root, dir));
}

for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], { stdio: "inherit" });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

console.log(`lint-check: ${files.length} file(s) passed`);

function walk(dirPath) {
  let entries;
  try {
    entries = readdirSync(dirPath);
  } catch (_error) {
    return;
  }

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry);
    const st = statSync(fullPath);
    if (st.isDirectory()) {
      walk(fullPath);
      continue;
    }
    if (fullPath.endsWith(".js")) {
      files.push(fullPath);
    }
  }
}
