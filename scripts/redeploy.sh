#!/usr/bin/env bash

set -Eeuo pipefail

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
readonly SERVICE_NAME="${SERVICE_NAME:-vacaro-front.service}"
readonly LOCAL_HEALTH_URL="${LOCAL_HEALTH_URL:-http://127.0.0.1:3000/}"
readonly PUBLIC_HEALTH_URL="${PUBLIC_HEALTH_URL:-https://vacaro.astalum.dev/}"
readonly DEPLOY_LOCK="${DEPLOY_LOCK:-/tmp/vacaro-front-redeploy.lock}"

log() {
	printf '[deploy] %s\n' "$*"
}

fail() {
	printf '[deploy] ERROR: %s\n' "$*" >&2
	exit 1
}

for command_name in git pnpm curl flock sudo systemctl; do
	command -v "${command_name}" >/dev/null 2>&1 ||
		fail "必要なコマンドがありません: ${command_name}"
done

exec 9>"${DEPLOY_LOCK}"
flock -n 9 || fail "別の再デプロイが実行中です"

cd "${PROJECT_DIR}"

git diff --quiet && git diff --cached --quiet ||
	fail "追跡済みファイルに未コミットの変更があります"

log "sudo権限とsystemdサービスを確認しています"
sudo -v
sudo systemctl cat "${SERVICE_NAME}" >/dev/null 2>&1 ||
	fail "${SERVICE_NAME} がありません。先に deploy/vacaro-front.service を登録してください"

log "リモートの変更を取得しています"
git pull --ff-only

log "依存関係を同期しています"
pnpm install --frozen-lockfile

log "型チェックとテストを実行しています"
pnpm typecheck
pnpm test

log "本番ビルドを作成しています"
pnpm build
test -f build/server/index.js || fail "build/server/index.js が生成されませんでした"

log "${SERVICE_NAME} を再起動しています"
sudo systemctl restart "${SERVICE_NAME}"

log "ローカルのヘルスチェックを実行しています"
healthy=false
for attempt in {1..15}; do
	if curl --fail --silent --show-error --max-time 5 "${LOCAL_HEALTH_URL}" >/dev/null; then
		healthy=true
		break
	fi
	sleep 1
done

if [[ "${healthy}" != true ]]; then
	sudo systemctl status "${SERVICE_NAME}" --no-pager >&2 || true
	sudo journalctl -u "${SERVICE_NAME}" -n 50 --no-pager >&2 || true
	fail "ローカルのヘルスチェックに失敗しました: ${LOCAL_HEALTH_URL}"
fi

log "公開URLを確認しています"
curl --fail --silent --show-error --max-time 10 "${PUBLIC_HEALTH_URL}" >/dev/null ||
	fail "公開URLのヘルスチェックに失敗しました: ${PUBLIC_HEALTH_URL}"

log "再デプロイが完了しました: ${PUBLIC_HEALTH_URL}"
