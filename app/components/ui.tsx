import { type ReactNode, useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
import {
	ApiError,
	apiRequest,
	EVENT_INVITE_URL_UPDATED_EVENT,
	EVENT_INVITE_URLS_STORAGE_KEY,
	savedEventInviteUrl,
	type User,
} from "../lib/api";

type IconName =
	| "arrow"
	| "back"
	| "calendar"
	| "check"
	| "chevron"
	| "clock"
	| "copy"
	| "down"
	| "edit"
	| "external"
	| "info"
	| "link"
	| "lock"
	| "mail"
	| "plus"
	| "sparkle"
	| "trash"
	| "users"
	| "chart";

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
	const paths: Record<IconName, ReactNode> = {
		arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
		back: <path d="m15 18-6-6 6-6" />,
		calendar: (
			<>
				<rect x="3" y="5" width="18" height="16" rx="2" />
				<path d="M16 3v4M8 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" />
			</>
		),
		check: <path d="m5 12 4 4L19 6" />,
		chevron: <path d="m9 18 6-6-6-6" />,
		clock: (
			<>
				<circle cx="12" cy="12" r="9" />
				<path d="M12 7v5l3 2" />
			</>
		),
		copy: (
			<>
				<rect x="8" y="8" width="12" height="12" rx="2" />
				<path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
			</>
		),
		down: <path d="m6 9 6 6 6-6" />,
		edit: (
			<>
				<path d="M12 20h9" />
				<path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
			</>
		),
		external: (
			<>
				<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
			</>
		),
		info: (
			<>
				<circle cx="12" cy="12" r="9" />
				<path d="M12 11v5M12 8h.01" />
			</>
		),
		link: (
			<>
				<path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.2 1.2" />
				<path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.2-1.2" />
			</>
		),
		lock: (
			<>
				<rect x="5" y="10" width="14" height="11" rx="2" />
				<path d="M8 10V7a4 4 0 0 1 8 0v3" />
			</>
		),
		mail: (
			<>
				<rect x="3" y="5" width="18" height="14" rx="2" />
				<path d="m3 7 9 6 9-6" />
			</>
		),
		plus: <path d="M12 5v14M5 12h14" />,
		sparkle: (
			<>
				<path d="m12 3 1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2Z" />
				<path d="m19 14 .7 2.3L22 17l-2.3.7L19 20l-.7-2.3L16 17l2.3-.7Z" />
			</>
		),
		trash: (
			<>
				<path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6" />
			</>
		),
		users: (
			<>
				<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
				<circle cx="9" cy="7" r="4" />
				<path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" />
			</>
		),
		chart: (
			<>
				<path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
			</>
		),
	};
	return (
		<svg
			className="icon"
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.8"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			{paths[name]}
		</svg>
	);
}

export function Brand() {
	return (
		<Link className="brand" to="/">
			<span className="brand-mark">
				<i />
				<i />
				<i />
			</span>
			vacaro
		</Link>
	);
}

function AccountNavigation() {
	const [user, setUser] = useState<User | null>();

	useEffect(() => {
		let active = true;
		apiRequest<User>("/me")
			.then((currentUser) => active && setUser(currentUser))
			.catch((error: unknown) => {
				if (active && error instanceof ApiError && error.status === 401)
					setUser(null);
			});
		return () => {
			active = false;
		};
	}, []);

	if (user?.account_type === "registered") {
		return (
			<Link className="account-link" to="/account">
				<span className="account-avatar">
					{user.display_name.trim().charAt(0) || "U"}
				</span>
				<span className="account-name">{user.display_name}</span>
			</Link>
		);
	}

	return (
		<a className="google-login-link" href="/api/v1/auth/google/start">
			<span className="google-mark" aria-hidden="true">
				G
			</span>
			Googleでログイン
		</a>
	);
}

export function AppHeader({ compact = false }: { compact?: boolean }) {
	const [menuOpen, setMenuOpen] = useState(false);

	useEffect(() => {
		if (!menuOpen) return;
		const closeOnEscape = (event: KeyboardEvent) => {
			if (event.key === "Escape") setMenuOpen(false);
		};
		window.addEventListener("keydown", closeOnEscape);
		return () => window.removeEventListener("keydown", closeOnEscape);
	}, [menuOpen]);

	return (
		<header className={`app-header ${compact ? "compact" : ""}`}>
			<div className="wrap header-inner">
				<Brand />
				<button
					className={`mobile-menu-button ${menuOpen ? "open" : ""}`}
					type="button"
					aria-label={menuOpen ? "メニューを閉じる" : "メニューを開く"}
					aria-expanded={menuOpen}
					aria-controls="site-navigation"
					onClick={() => setMenuOpen((open) => !open)}
				>
					<span />
					<span />
					<span />
				</button>
				<nav
					id="site-navigation"
					className={menuOpen ? "open" : ""}
					onClick={() => setMenuOpen(false)}
					onKeyDown={(event) => {
						if (event.key === "Enter" || event.key === " ") setMenuOpen(false);
					}}
				>
					<Link
						className="button event-create-button button-small"
						to="/events/new"
					>
						<Icon name="plus" size={16} /> イベントを作る
					</Link>
					<Link to="/events">イベント一覧</Link>
					<AccountNavigation />
				</nav>
			</div>
		</header>
	);
}

type InviteUrlUpdatedDetail = {
	eventID: string;
	inviteUrl: string;
};

export function PersistentInviteUrl() {
	const { pathname } = useLocation();
	const eventID = pathname.match(/^\/events\/([^/]+)(?:\/|$)/)?.[1] ?? null;
	const [inviteUrl, setInviteUrl] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);

	useEffect(() => {
		setCopied(false);
		setInviteUrl(eventID ? savedEventInviteUrl(eventID) : null);
		if (!eventID) return;

		const syncFromStorage = (event: StorageEvent) => {
			if (event.key === EVENT_INVITE_URLS_STORAGE_KEY) {
				setInviteUrl(savedEventInviteUrl(eventID));
			}
		};
		const syncFromUpdate = (event: Event) => {
			const { detail } = event as CustomEvent<InviteUrlUpdatedDetail>;
			if (detail.eventID === eventID) setInviteUrl(detail.inviteUrl);
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
			<button
				type="button"
				onClick={async () => {
					await navigator.clipboard.writeText(inviteUrl);
					setCopied(true);
					window.setTimeout(() => setCopied(false), 1800);
				}}
			>
				<Icon name={copied ? "check" : "copy"} size={16} />
				{copied ? "コピー済み" : "コピー"}
			</button>
		</section>
	);
}

export function PageShell({
	children,
	fullScreen = false,
	showPersistentInviteUrl = true,
}: {
	children: ReactNode;
	fullScreen?: boolean;
	showPersistentInviteUrl?: boolean;
}) {
	return (
		<div
			className={`site-shell page-shell ${fullScreen ? "fullscreen-shell" : ""}`}
		>
			{!fullScreen && <AppHeader compact />}
			<main className={`page-main wrap ${fullScreen ? "fullscreen-main" : ""}`}>
				{children}
				{showPersistentInviteUrl && <PersistentInviteUrl />}
			</main>
		</div>
	);
}

export function PageIntro({
	eyebrow,
	title,
	description,
	backTo,
	backLabel = "戻る",
}: {
	eyebrow?: string;
	title: string;
	description?: string;
	backTo?: string;
	backLabel?: string;
}) {
	return (
		<div className="page-intro">
			{backTo && (
				<Link className="back-link" to={backTo}>
					<Icon name="back" size={17} /> {backLabel}
				</Link>
			)}
			{eyebrow && <span className="page-eyebrow">{eyebrow}</span>}
			<h1>{title}</h1>
			{description && <p>{description}</p>}
		</div>
	);
}
