# CodexTab

Chromeで `Command+E` を押すと、右側にチャットサイドバーを開き、
現在ページの文脈（タイトル・URL・見出し・本文）を使って Codex CLI と対話できる拡張です。

## 特徴

- `Command+E` でサイドバーを開閉（macOS）
- ページ文脈の読み込みを `あり/なし` で切替
- AIモデル（`gpt-5.2-codex` / `gpt-5-codex` / 既定）を選択可能
- 思考の量（`low` / `medium` / `high`）を選択可能
- Codex CLI との会話を継続（thread resume）
- 回答を Markdown でレンダリング表示
- 回答を段階表示（読みやすさ重視）

## 動作環境

- macOS
- Google Chrome
- Node.js 18+
- Codex CLI (`codex`) がインストール済み
- `codex login` 済み

## セットアップ

### 1) リポジトリを取得

```bash
git clone https://github.com/yamkz/CodexTab.git
cd CodexTab
```

### 2) 拡張を読み込む

1. `chrome://extensions` を開く
2. 右上の `Developer mode` をON
3. `Load unpacked` を押す
4. このリポジトリの `extension/` を選ぶ
5. 表示された拡張カードの `ID` をコピーする

### 3) Native Host を登録

> `EXTENSION_ID` は手順2でコピーしたID

```bash
./scripts/install-native-host.sh --extension-id EXTENSION_ID
```

### 4) ショートカット確認

1. `chrome://extensions/shortcuts` を開く
2. `CodexTab Sidebar` が `Command+E` になっていることを確認

## 使い方

1. 通常のWebページ（`http://` / `https://`）を開く
2. `Command+E` でサイドバーを開く
3. 質問を入力して Enter
4. Codex CLI の回答が Markdown レンダリングで表示される

補足:

- `Shift+Enter` で改行
- `Escape` でサイドバーを閉じる
- `毎ターンページ情報を含める` で毎ターン文脈添付を切替

## プロジェクト構成

- `extension/` Chrome拡張（Manifest V3）
- `native-host/` Native Messaging host（Node.js）
- `scripts/install-native-host.sh` Native host登録
- `scripts/uninstall-native-host.sh` Native host削除
- `design.pen` v1 UIデザイン

## セキュリティ注意

この拡張は Native Messaging を使ってローカルの `codex` コマンドを実行します。
信頼できるコードだけを `Load unpacked` で読み込んでください。

詳細は `SECURITY.md` を参照してください。

## トラブルシュート

- Host not found と出る
  - 拡張IDを確認して `install-native-host.sh` を再実行
  - その後、拡張を再読み込み
- 応答しない
  - `codex --version`
  - `codex login`
- ショートカットが効かない
  - `chrome://extensions/shortcuts` で再設定

## アンインストール

```bash
./scripts/uninstall-native-host.sh
```
