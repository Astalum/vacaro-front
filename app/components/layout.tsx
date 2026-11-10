import { type ReactNode, useEffect, useState } from "react";
import { Link } from "react-router";
import { ApiError, apiRequest } from "~/lib/api";
import type { User } from "~/features/account/types";
import { PersistentInviteUrl } from "~/features/events/invite-url";
import { Icon } from "./ui/icon";

export function Brand() {
	return (
		<Link className="brand" to="/">
			<img
				className="brand-mark"
				src="/vacaro_favicon.png?v=3"
				alt=""
				aria-hidden="true"
			/>
			vacaro
		</Link>
	);
}

export function SiteFooter() {
	return (
		<footer className="footer wrap">
			<Brand />
			<nav className="footer-links" aria-label="ポリシー">
				<Link to="/privacy">プライバシーポリシー</Link>
				<Link to="/terms">利用規約</Link>
			</nav>
			<span>© 2026 vacaro</span>
		</footer>
	);
}

function useAccountNavigation() {
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

	return { user };
}

function AccountNavigation() {
	const { user } = useAccountNavigation();

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

function useAppHeader({ compact = false }: { compact?: boolean }) {
	const [menuOpen, setMenuOpen] = useState(false);

	useEffect(() => {
		if (!menuOpen) return;
		const closeOnEscape = (event: KeyboardEvent) => {
			if (event.key === "Escape") setMenuOpen(false);
		};
		window.addEventListener("keydown", closeOnEscape);
		return () => window.removeEventListener("keydown", closeOnEscape);
	}, [menuOpen]);

	function closeMenuOnKeyDown(event: React.KeyboardEvent<HTMLElement>) {
		if (event.key === "Enter" || event.key === " ") setMenuOpen(false);
	}

	const toggleMenu = () => setMenuOpen((open) => !open);
	const closeMenu = () => setMenuOpen(false);
	return { compact, menuOpen, closeMenuOnKeyDown, toggleMenu, closeMenu };
}

export function AppHeader(props: { compact?: boolean }) {
	const { compact, menuOpen, closeMenuOnKeyDown, toggleMenu, closeMenu } =
		useAppHeader(props);

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
					onClick={toggleMenu}
				>
					<span />
					<span />
					<span />
				</button>
				<nav
					id="site-navigation"
					className={menuOpen ? "open" : ""}
					onClick={closeMenu}
					onKeyDown={closeMenuOnKeyDown}
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

export function PageShell({
	children,
	fullScreen = false,
	showHeader = !fullScreen,
	showPersistentInviteUrl = true,
}: {
	children: ReactNode;
	fullScreen?: boolean;
	showHeader?: boolean;
	showPersistentInviteUrl?: boolean;
}) {
	return (
		<div
			className={`site-shell page-shell ${fullScreen ? "fullscreen-shell" : ""}`}
		>
			{showHeader && <AppHeader compact />}
			<main className={`page-main wrap ${fullScreen ? "fullscreen-main" : ""}`}>
				{children}
				{showPersistentInviteUrl && <PersistentInviteUrl />}
			</main>
			{!fullScreen && <SiteFooter />}
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
