import { useEffect, useState } from "react";
import { Form, useLocation } from "react-router";
import { Icon } from "~/components/ui/icon";
import {
	EVENT_INVITE_URL_UPDATED_EVENT,
	EVENT_INVITE_URLS_STORAGE_KEY,
	savedEventInviteUrl,
} from "./links";

type InviteUrlUpdatedDetail = {
	eventID: string;
	inviteUrl: string;
};

function usePersistentInviteUrl({
	inviteUrl: controlledInviteUrl,
}: {
	inviteUrl?: string | null;
} = {}) {
	const { pathname } = useLocation();
	const eventID = pathname.match(/^\/events\/([^/]+)(?:\/|$)/)?.[1] ?? null;
	const [savedInviteUrl, setSavedInviteUrl] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);
	const inviteUrl =
		controlledInviteUrl === undefined ? savedInviteUrl : controlledInviteUrl;

	useEffect(() => {
		setCopied(false);
		setSavedInviteUrl(eventID ? savedEventInviteUrl(eventID) : null);
		if (!eventID) return;

		const syncFromStorage = (event: StorageEvent) => {
			if (event.key === EVENT_INVITE_URLS_STORAGE_KEY) {
				setSavedInviteUrl(savedEventInviteUrl(eventID));
			}
		};
		const syncFromUpdate = (event: Event) => {
			const { detail } = event as CustomEvent<InviteUrlUpdatedDetail>;
			if (detail.eventID === eventID) setSavedInviteUrl(detail.inviteUrl);
		};

		window.addEventListener("storage", syncFromStorage);
		window.addEventListener(EVENT_INVITE_URL_UPDATED_EVENT, syncFromUpdate);
		return () => {
			window.removeEventListener("storage", syncFromStorage);
			window.removeEventListener(
				EVENT_INVITE_URL_UPDATED_EVENT,
				syncFromUpdate,
			);
		};
	}, [eventID]);

	async function copyInviteUrl() {
		if (!inviteUrl) return;
		await navigator.clipboard.writeText(inviteUrl);
		setCopied(true);
		window.setTimeout(() => setCopied(false), 1800);
	}
	return { copied, inviteUrl, copyInviteUrl };
}

export function PersistentInviteUrl(props: { inviteUrl?: string | null } = {}) {
	const { copied, inviteUrl, copyInviteUrl } = usePersistentInviteUrl(props);

	if (!inviteUrl) return null;

	return (
		<section className="persistent-invite-dock" aria-label="招待URL">
			<span className="persistent-invite-dock-icon">
				<Icon name="link" size={18} />
			</span>
			<div>
				<a href={inviteUrl} target="_blank" rel="noreferrer" title={inviteUrl}>
					{inviteUrl}
				</a>
			</div>
			<button type="button" onClick={copyInviteUrl}>
				<Icon name={copied ? "check" : "copy"} size={16} />
				{copied ? "コピー済み" : "コピー"}
			</button>
		</section>
	);
}

export function InviteUrlReissue({
	hasInviteUrl,
	canReissue,
	busy = false,
}: {
	hasInviteUrl: boolean;
	canReissue: boolean;
	busy?: boolean;
}) {
	function confirmInviteReissue(submitEvent: React.FormEvent<HTMLFormElement>) {
		if (
			!window.confirm(
				"招待URLを再発行しますか？\n現在共有済みの招待URLは直ちに無効になります。",
			)
		) {
			submitEvent.preventDefault();
		}
	}
	return (
		<div className="invite-url-reissue">
			<p
				className={
					hasInviteUrl ? "invite-reissue-warning" : "invite-url-missing"
				}
			>
				<Icon name="info" size={16} />
				<span>
					{hasInviteUrl
						? "再発行すると、現在の招待URLは直ちに無効になります。"
						: "このブラウザには現在の招待URLが保存されていません。共有済みのURLは引き続き有効です。"}
				</span>
			</p>
			{canReissue ? (
				<Form method="post" onSubmit={confirmInviteReissue}>
					<button
						className="button button-ghost button-small"
						type="submit"
						name="intent"
						value="reissue-invite-url"
						disabled={busy}
					>
						<Icon name="link" size={16} />
						{busy ? "再発行しています…" : "招待URLを再発行"}
					</button>
				</Form>
			) : (
				!hasInviteUrl && <small>回答受付中のイベントのみ再発行できます。</small>
			)}
		</div>
	);
}
