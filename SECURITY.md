# Security Policy

## Important risk model

CodexTab uses Chrome Native Messaging and can invoke the local `codex` command.
This means a compromised or untrusted extension build could send prompts to local CLI tooling.

## Safe usage checklist

- Only load this extension from source you trust.
- Verify extension ID before running install script.
- Do not add unknown extension IDs to native host manifest.
- Keep Node.js and Codex CLI updated.

## Native host scope

- Host name: `com.codextab.bridge`
- Manifest location (macOS Chrome):
  - `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.codextab.bridge.json`
- Allowed origins are restricted to a single extension ID chosen at install time.

## Reporting

If you find a security issue, open a private report via GitHub Security Advisory for this repository.
