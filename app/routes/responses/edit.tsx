import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Icon, PageShell } from "~/components/app";
import { apiErrorData, apiRequest, saveResponseEditUrl } from "~/lib/api";
import { createPageMeta } from "~/lib/meta";

export function meta() {
	return [
		...createPageMeta("回答を変更 | vacaro"),
		{ name: "robots", content: "noindex, nofollow" },
	];
}

export function responseEditTokenFromHash(hash: string) {
	const token = hash.replace(/^#/, "").trim();
	return /^[A-Za-z0-9_-]{43}$/.test(token) ? token : null;
}

export default function EditResponseSession() {
	const navigate = useNavigate();
	const [error, setError] = useState<string | null>(null);
	const exchange = useRef<Promise<string> | null>(null);

	useEffect(() => {
		if (!exchange.current) {
			const token = responseEditTokenFromHash(window.location.hash);
			window.history.replaceState(window.history.state, "", "/responses/edit");
			if (!token) {
				setError("再回答用リンクが正しくありません。");
				return;
			}
			exchange.current = apiRequest<{ event_id: string }>(
				"/response-sessions",
				{
					method: "POST",
					body: JSON.stringify({ token }),
				},
			).then(({ event_id: eventID }) => {
				saveResponseEditUrl(
					eventID,
					`${window.location.origin}/responses/edit#${token}`,
				);
				return eventID;
			});
		}
		let active = true;
		exchange.current
			.then((eventID) => {
				if (active) {
					void navigate(`/events/${eventID}/availability`, { replace: true });
				}
			})
			.catch((requestError: unknown) => {
				if (active) setError(apiErrorData(requestError).message);
			});
		return () => {
			active = false;
		};
	}, [navigate]);

	return (
		<PageShell showPersistentInviteUrl={false}>
			<div className="not-found">
				<div className="empty-calendar">
					<Icon name={error ? "info" : "calendar"} size={42} />
				</div>
				<h1>{error ? "回答を開けませんでした" : "回答を読み込んでいます"}</h1>
				<p>
					{error ??
						"安全な回答セッションを準備しています。少しお待ちください。"}
				</p>
				{error && (
					<Link className="button button-primary" to="/">
						トップへ戻る <Icon name="arrow" size={17} />
					</Link>
				)}
			</div>
		</PageShell>
	);
}
