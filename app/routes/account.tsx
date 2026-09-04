import {
	data,
	Form,
	redirect,
	redirectDocument,
	useNavigation,
	useSearchParams,
} from "react-router";
import { Icon, PageIntro, PageShell } from "../components/ui";
import { ApiError, apiErrorData, apiRequest, type User } from "../lib/api";
import type { Route } from "./+types/account";

export function meta() {
	return [{ title: "アカウント設定 | yotei" }];
}

export async function clientLoader() {
	try {
		return { user: await apiRequest<User>("/me") };
	} catch (error) {
		if (error instanceof ApiError && error.status === 401)
			return { user: null };
		throw error;
	}
}
clientLoader.hydrate = true as const;

export async function clientAction({ request }: Route.ClientActionArgs) {
	const formData = await request.formData();
	const intent = formData.get("intent");
	try {
		if (intent === "logout") {
			await apiRequest<void>("/session", { method: "DELETE" });
			return redirect("/?logout=success");
		}
		if (intent === "calendar-connect") {
			const result = await apiRequest<{ authorization_url: string }>(
				"/integrations/google-calendar",
				{ method: "POST" },
			);
			return redirectDocument(result.authorization_url);
		}
		if (intent === "calendar-disconnect") {
			await apiRequest<void>("/integrations/google-calendar", {
				method: "DELETE",
			});
			return { kind: "disconnected" as const };
		}
		return data(
			{
				kind: "error" as const,
				error: { code: "invalid_intent", message: "操作を確認してください" },
			},
			{ status: 400 },
		);
	} catch (error) {
		return data(
			{ kind: "error" as const, error: apiErrorData(error) },
			{ status: error instanceof ApiError ? error.status : 500 },
		);
	}
}

export function HydrateFallback() {
	return (
		<PageShell narrow>
			<div className="page-loading">アカウント情報を読み込んでいます…</div>
		</PageShell>
	);
}

export default function Account({
	loaderData,
	actionData,
}: Route.ComponentProps) {
	const { user } = loaderData;
	const navigation = useNavigation();
	const [searchParams] = useSearchParams();
	const intent = navigation.formData?.get("intent");
	const calendarConnected = searchParams.get("google_calendar") === "connected";

	return (
		<PageShell narrow>
			<PageIntro
				eyebrow="ACCOUNT"
				title="アカウント設定"
				description="ログイン情報とGoogleカレンダー連携を管理します。"
			/>

			{calendarConnected && (
				<div className="confirm-banner compact-banner">
					<Icon name="check" />
					<div>
						<strong>Googleカレンダーを接続しました</strong>
						<span>参加可能時間の入力画面から空き時間を取り込めます。</span>
					</div>
				</div>
			)}
			{actionData?.kind === "disconnected" && (
				<div className="confirm-banner compact-banner">
					<Icon name="check" />
					<div>
						<strong>Googleカレンダーの接続を解除しました</strong>
					</div>
				</div>
			)}
			{actionData?.kind === "error" && (
				<div className="form-error">
					<Icon name="info" size={17} />
					<span>
						<strong>{actionData.error.message}</strong>
					</span>
				</div>
			)}

			{!user ? (
				<section className="account-card account-login-card">
					<div className="account-card-icon google-mark large">G</div>
					<h2>Googleでログイン</h2>
					<p>作成・参加したイベントを引き継ぎ、別の端末からも確認できます。</p>
					<a className="button google-button" href="/api/v1/auth/google/start">
						<span className="google-mark" aria-hidden="true">
							G
						</span>
						Googleでログイン
					</a>
				</section>
			) : (
				<div className="account-stack">
					<section className="account-card">
						<div className="account-card-heading">
							<div className="account-avatar large">
								{user.display_name.trim().charAt(0) || "U"}
							</div>
							<div>
								<span className="account-type">
									{user.account_type === "registered"
										? "GOOGLE ACCOUNT"
										: "GUEST ACCOUNT"}
								</span>
								<h2>{user.display_name}</h2>
								<p>{user.email ?? "ゲストとして利用中"}</p>
							</div>
						</div>
						{user.account_type === "guest" ? (
							<div className="account-upgrade">
								<p>
									Googleでログインすると、現在のイベントと回答をそのまま引き継げます。
								</p>
								<a
									className="button google-button"
									href="/api/v1/auth/google/start"
								>
									<span className="google-mark" aria-hidden="true">
										G
									</span>
									Googleでログイン
								</a>
							</div>
						) : (
							<Form method="post">
								<button
									className="text-button"
									type="submit"
									name="intent"
									value="logout"
									disabled={navigation.state !== "idle"}
								>
									{intent === "logout" ? "ログアウトしています…" : "ログアウト"}
								</button>
							</Form>
						)}
					</section>

					{user.account_type === "registered" && (
						<section className="account-card integration-card">
							<div className="account-card-heading">
								<div className="account-card-icon calendar-icon">
									<Icon name="calendar" />
								</div>
								<div>
									<h2>Googleカレンダー連携</h2>
									<p>
										予定が入っていない時間を、参加可能時間としてプレビューできます。
									</p>
								</div>
							</div>
							<div className="integration-actions">
								<Form method="post">
									<button
										className="button button-primary"
										type="submit"
										name="intent"
										value="calendar-connect"
										disabled={navigation.state !== "idle"}
									>
										{intent === "calendar-connect"
											? "Googleへ移動しています…"
											: "接続・再接続する"}
									</button>
								</Form>
								<Form method="post">
									<button
										className="button button-ghost"
										type="submit"
										name="intent"
										value="calendar-disconnect"
										disabled={navigation.state !== "idle"}
									>
										{intent === "calendar-disconnect"
											? "解除しています…"
											: "接続を解除"}
									</button>
								</Form>
							</div>
						</section>
					)}
				</div>
			)}
		</PageShell>
	);
}
