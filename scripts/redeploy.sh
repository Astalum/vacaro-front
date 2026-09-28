#!/usr/bin/env bash

set -Eeuo pipefail

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "${SCRIPT_DIR}/compose.prod.yaml" ]]; then
	DEFAULT_DEPLOY_DIR="${SCRIPT_DIR}"
else
	DEFAULT_DEPLOY_DIR="$(cd -- "${SCRIPT_DIR}/../deploy" && pwd)"
fi
readonly DEPLOY_DIR="${DEPLOY_DIR:-${DEFAULT_DEPLOY_DIR}}"
readonly ENV_FILE="${ENV_FILE:-${DEPLOY_DIR}/.env.production}"
readonly COMPOSE_FILE="${COMPOSE_FILE:-${DEPLOY_DIR}/compose.prod.yaml}"
readonly COMPOSE_OVERRIDE_FILE="${COMPOSE_OVERRIDE_FILE:-${DEPLOY_DIR}/compose.prod.override.yaml}"
readonly LOCAL_WEB_HEALTH_URL="${LOCAL_WEB_HEALTH_URL:-http://127.0.0.1:3000/}"
readonly LOCAL_API_HEALTH_URL="${LOCAL_API_HEALTH_URL:-http://127.0.0.1:8080/ready}"
readonly PUBLIC_WEB_HEALTH_URL="${PUBLIC_WEB_HEALTH_URL:-https://vacaro.astalum.dev/}"
readonly PUBLIC_API_HEALTH_URL="${PUBLIC_API_HEALTH_URL:-https://vacaro.astalum.dev/api/ready}"
readonly HEALTH_RETRIES="${HEALTH_RETRIES:-30}"
readonly DEPLOY_LOCK="${DEPLOY_LOCK:-/tmp/vacaro-redeploy.lock}"

log() {
	printf '[deploy] %s\n' "$*"
}

fail() {
	printf '[deploy] ERROR: %s\n' "$*" >&2
	exit 1
}

require_file() {
	local file_path="$1"
	[[ -f "${file_path}" ]] || fail "必要なファイルがありません: ${file_path}"
}

wait_for_url() {
	local label="$1"
	local url="$2"
	local attempt

	for ((attempt = 1; attempt <= HEALTH_RETRIES; attempt++)); do
		if curl --fail --silent --show-error --max-time 5 "${url}" >/dev/null; then
			log "${label}を確認しました: ${url}"
			return 0
		fi
		sleep 1
	done

	return 1
}

for command_name in docker curl flock; do
	command -v "${command_name}" >/dev/null 2>&1 ||
		fail "必要なコマンドがありません: ${command_name}"
done

docker compose version >/dev/null 2>&1 || fail "Docker Composeが利用できません"
docker info >/dev/null 2>&1 || fail "Dockerデーモンへ接続できません"

require_file "${ENV_FILE}"
require_file "${COMPOSE_FILE}"

compose_args=(--env-file "${ENV_FILE}" -f "${COMPOSE_FILE}")
if [[ -f "${COMPOSE_OVERRIDE_FILE}" ]]; then
	compose_args+=(-f "${COMPOSE_OVERRIDE_FILE}")
fi
readonly -a compose_args

compose() {
	docker compose "${compose_args[@]}" "$@"
}

exec 9>"${DEPLOY_LOCK}"
flock -n 9 || fail "別の再デプロイが実行中です"

log "本番Compose設定を検証しています"
compose config --quiet

log "CIでビルド済みの本番イメージを取得しています"
compose pull

log "本番コンテナを適用しています"
compose up -d --remove-orphans

log "ローカルのヘルスチェックを実行しています"
	if ! wait_for_url "Web" "${LOCAL_WEB_HEALTH_URL}" ||
		! wait_for_url "API" "${LOCAL_API_HEALTH_URL}"; then
	compose ps --all >&2 || true
	compose logs --no-color --tail 100 >&2 || true
	fail "ローカルのヘルスチェックに失敗しました"
fi

log "公開URLのヘルスチェックを実行しています"
	if ! wait_for_url "公開Web" "${PUBLIC_WEB_HEALTH_URL}" ||
		! wait_for_url "公開API" "${PUBLIC_API_HEALTH_URL}"; then
	compose ps --all >&2 || true
	compose logs --no-color --tail 100 >&2 || true
	fail "公開URLのヘルスチェックに失敗しました"
fi

compose ps --all
log "再デプロイが完了しました: ${PUBLIC_WEB_HEALTH_URL}"
