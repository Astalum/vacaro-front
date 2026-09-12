import {
	isRouteErrorResponse,
	Links,
	Meta,
	Outlet,
	Scripts,
	ScrollRestoration,
} from "react-router";

import type { Route } from "./+types/root";
import "./styles/tailwind.css";
import "./app.scss";
import { ApiError } from "./lib/api";

export const links: Route.LinksFunction = () => [
	{ rel: "preconnect", href: "https://fonts.googleapis.com" },
	{
		rel: "preconnect",
		href: "https://fonts.gstatic.com",
		crossOrigin: "anonymous",
	},
	{
		rel: "stylesheet",
		href: "https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@500;600;700;800;900&display=swap",
	},
];

export function Layout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="ja">
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<Meta />
				<Links />
			</head>
			<body>
				{children}
				<ScrollRestoration />
				<Scripts />
			</body>
		</html>
	);
}

export default function App() {
	return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
	let message = "エラーが発生しました";
	let details = "時間をおいて、もう一度お試しください。";
	let stack: string | undefined;

	if (isRouteErrorResponse(error)) {
		message =
			error.status === 404 ? "ページが見つかりません" : "エラーが発生しました";
		details =
			error.status === 404
				? "URLが間違っているか、イベントが存在しない可能性があります。"
				: error.statusText || details;
	} else if (error instanceof ApiError) {
		message =
			error.status === 401
				? "セッションが必要です"
				: error.status === 404
					? "イベントが見つかりません"
					: "処理を完了できませんでした";
		details = error.message;
	} else if (import.meta.env.DEV && error && error instanceof Error) {
		details = error.message;
		stack = error.stack;
	}

	return (
		<main className="root-error">
			<span>
				{isRouteErrorResponse(error)
					? error.status
					: error instanceof ApiError
						? error.status
						: "!"}
			</span>
			<h1>{message}</h1>
			<p>{details}</p>
			<a className="button button-primary" href="/">
				トップへ戻る
			</a>
			{stack && (
				<pre className="w-full p-4 overflow-x-auto">
					<code>{stack}</code>
				</pre>
			)}
		</main>
	);
}
