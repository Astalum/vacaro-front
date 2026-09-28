# 本番デプロイ手順

この手順では、WSLを開発・ビルド環境、本番VPSをコンテナイメージの取得・実行専用環境として運用します。

本番VPSでは、Gitによるソースコード取得、Node.js依存関係のインストール、TypeScript型チェック、テスト、Dockerイメージのビルドを行いません。

## 前提

- WSLの作業ディレクトリは`/home/astalum/self-develop/vacaro-front`
- GitHubリポジトリは`Astalum/vacaro-front`
- VPSにはDocker EngineとDocker Composeプラグインがインストール済み
- バックエンドはVPSの`127.0.0.1:8080`で稼働済み
- `vacaro.astalum.dev`のリバースプロキシとTLS設定は完了済み

以下の`<VPS_HOST>`は、SSH接続名またはVPSのIPアドレスに置き換えます。

## 1. WSLで変更をコミットする

```bash
cd /home/astalum/self-develop/vacaro-front
git diff
git status
```

差分に問題がなければ、コミットして`main`へpushします。

```bash
git add .
git commit -m "Separate development and production deployment"
git push origin main
```

## 2. GitHub Actionsを確認する

GitHubの`Astalum/vacaro-front`リポジトリを開き、Actionsにある「Test and publish production image」が成功することを確認します。

成功すると、GHCRへ次の形式のイメージが発行されます。

```text
ghcr.io/astalum/vacaro-front:sha-<40桁のコミットSHA>
```

本番環境では、更新対象が変動する`latest`ではなく、`sha-...`タグを使用します。

## 3. VPSへ運用ファイルを転送する

WSLで次を実行し、VPSに運用ディレクトリを作成します。

```bash
ssh <VPS_HOST> 'sudo mkdir -p /opt/vacaro && sudo chown "$USER":"$USER" /opt/vacaro'
```

VPSへ必要な運用ファイルだけを転送します。

```bash
cd /home/astalum/self-develop/vacaro-front
scp deploy/compose.prod.yaml <VPS_HOST>:/opt/vacaro/
scp deploy/.env.production.example <VPS_HOST>:/opt/vacaro/
scp scripts/redeploy.sh <VPS_HOST>:/opt/vacaro/
```

アプリケーションのソースコード、`node_modules`、TypeScript設定、テストファイルはVPSへ転送しません。

## 4. 本番環境ファイルを作成する

VPSへ接続します。

```bash
ssh <VPS_HOST>
cd /opt/vacaro
```

環境ファイルとデプロイスクリプトを準備します。

```bash
mv .env.production.example .env.production
chmod 600 .env.production
chmod 755 redeploy.sh
```

環境ファイルを編集します。

```bash
nano .env.production
```

GitHub Actionsが発行した実際のSHAタグを設定します。

```env
VACARO_FRONT_IMAGE=ghcr.io/astalum/vacaro-front:sha-実際の40桁SHA
```

## 5. privateイメージを利用する場合はGHCRへログインする

GHCRパッケージをpublicにする場合、この作業は不要です。

privateのまま利用する場合は、GitHubで`read:packages`権限を持つPersonal Access Tokenを作成し、VPSでログインします。

```bash
docker login ghcr.io -u Astalum
```

PasswordにはGitHubアカウントのパスワードではなく、作成したPersonal Access Tokenを入力します。

## 6. 初回デプロイを実行する

バックエンドが稼働していることを確認します。

```bash
curl --fail http://127.0.0.1:8080/ready
```

フロントエンドをデプロイします。

```bash
cd /opt/vacaro
./redeploy.sh
```

`redeploy.sh`は次の処理だけを実行します。

1. Compose設定の検証
2. `docker compose pull`
3. `docker compose up -d`
4. ローカルURLと公開URLのヘルスチェック

コンテナの状態を確認します。

```bash
docker compose \
  --env-file /opt/vacaro/.env.production \
  -f /opt/vacaro/compose.prod.yaml \
  ps
```

ログを確認する場合は次を実行します。

```bash
docker compose \
  --env-file /opt/vacaro/.env.production \
  -f /opt/vacaro/compose.prod.yaml \
  logs --tail 100 web
```

## 7. VPS起動時の自動起動を設定する

この設定は必要な場合のみ行います。

WSLからsystemd定義を転送します。

```bash
cd /home/astalum/self-develop/vacaro-front
scp deploy/vacaro-front.service <VPS_HOST>:/tmp/
```

VPSでsystemdへ登録します。

```bash
sudo mv /tmp/vacaro-front.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now vacaro-front.service
sudo systemctl status vacaro-front.service
```

## 8. 2回目以降の更新

WSLで変更をコミットしてpushします。

```bash
cd /home/astalum/self-develop/vacaro-front
git add .
git commit -m "変更内容"
git push origin main
```

GitHub Actionsの成功後、VPSの`.env.production`を新しいSHAタグへ更新します。

```bash
ssh <VPS_HOST>
nano /opt/vacaro/.env.production
```

新しいイメージを適用します。

```bash
/opt/vacaro/redeploy.sh
```

## 9. VS Code Remote SSHの拡張機能を整理する

通常は、本番VPSを開発ワークスペースとして開きません。障害調査などでRemote SSH接続する場合は、VS Codeの拡張機能画面で`SSH: <VPS名> - Installed`を選択します。

本番運用に不要な次のような拡張機能を、リモート側で`Disable (Workspace)`にするかアンインストールします。

- TypeScript and JavaScript Language Features
- ESLint
- Prettier
- Git関連の追加拡張
- テスト・デバッグ用拡張
- AI開発支援拡張

ローカル側の拡張機能を無効化する必要はありません。

VPSの`/opt/vacaro`には、Compose設定、`.env.production`、運用スクリプトだけを配置します。`.env.production`はGitへ追加せず、ファイル権限を`600`に維持してください。

## バックエンドについて

このリポジトリのGitHub Actionsが発行するのはフロントエンドイメージだけです。バックエンドを現在VPS上でビルドしている場合は、`vacaro-back`側にも同じ考え方のCIを用意し、本番Composeの`api`サービスをビルド済みイメージの`pull`方式へ変更する必要があります。
