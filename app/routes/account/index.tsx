import { useEffect } from "react";
import {
	data,
	Form,
	redirect,
	useNavigation,
	useSearchParams,
} from "react-router";
import { Icon } from "~/components/ui/icon";
import { PageIntro, PageShell } from "~/components/layout";
import { ValidationMessage } from "~/components/ui/validation-message";
import { ApiError, apiErrorData, apiRequest } from "~/lib/api";
import { COMMON_TIME_ZONES, isValidTimeZone } from "~/lib/datetime";
import { type User } from "~/features/account/types";
import {
	AvailabilitySettings,
	handleAvailabilityDefaultAction,
} from "~/features/account/availability-settings";
import CalendarSettings, {
	loadCalendarSettings,
	handleCalendarAction,
} from "~/features/calendars/settings";
import { handleICloudAction } from "~/features/calendars/icloud-settings";
import { createPageMeta } from "~/lib/meta";
import type { Route } from "./+types/index";

export function meta() {
	return createPageMeta("ユーザー設定 | vacaro");
}
export async function clientLoader(_args: Route.ClientLoaderArgs) {
	let user: User | null;
	try {
		user = await apiRequest<User>("/me");
	} catch (error) {
		if (error instanceof ApiError && error.status === 401) user = null;
		else throw error;
	}
	const calendar = await loadCalendarSettings(user)
		.then((settings) => ({ settings, error: null }))
		.catch((error: unknown) => ({
			settings: null,
			error: apiErrorData(error),
		}));
	return { user, calendar };
}

clientLoader.hydrate = true as const;
export async function clientAction({ request }: Route.ClientActionArgs) {
	const formData = await request.formData();
	const intent = formData.get("intent");
	if (intent === "update-availability-default")
		return handleAvailabilityDefaultAction(formData);
	if (
		intent === "select-provider" ||
		intent === "calendar-connect" ||
		intent === "calendar-disconnect"
	)
		return handleCalendarAction(formData);
	if (intent === "icloud-connect" || intent === "icloud-disconnect")
		return handleICloudAction(formData);
	try {
		if (intent === "logout") {
			await apiRequest<void>("/session", { method: "DELETE" });
			return redirect("/?logout=success");
		}
		if (intent === "update-profile") {
			const displayName = String(formData.get("display_name") ?? "").trim();
			const timeZone = String(formData.get("time_zone") ?? "").trim();
			if (!displayName || !isValidTimeZone(timeZone)) {
				return data(
					{
						kind: "error" as const,
						scope: "profile" as const,
						error: {
							code: "validation_failed",
							message: "表示名とタイムゾーンを確認してください",
						},
					},
					{ status: 422 },
				);
			}
			await apiRequest<User>("/me", {
				method: "PATCH",
				body: JSON.stringify({
					display_name: displayName,
					time_zone: timeZone,
				}),
			});
			return { kind: "profile-updated" as const };
		}
		return data(
			{
				kind: "error" as const,
				scope: "profile" as const,
				error: { code: "invalid_intent", message: "操作を確認してください" },
			},
			{ status: 400 },
		);
	} catch (error) {
		return data(
			{
				kind: "error" as const,
				scope: "profile" as const,
				error: apiErrorData(error),
			},
			{ status: error instanceof ApiError ? error.status : 500 },
		);
	}
}

export function HydrateFallback() {
	return (
		<PageShell>
			<div className="page-loading">アカウント情報を読み込んでいます…</div>
		</PageShell>
	);
}

function useAccount({ loaderData, actionData }: Route.ComponentProps) {
	const { user, calendar } = loaderData;
	const navigation = useNavigation();
	const intent = navigation.formData?.get("intent");
	const [searchParams] = useSearchParams();
	const calendarResult = searchParams.get("google_calendar");
	useEffect(() => {
		if (calendarResult)
			document
				.getElementById("calendar-settings")
				?.scrollIntoView({ block: "start" });
	}, [calendarResult]);

	const calendarActionData =
		actionData && "scope" in actionData && actionData.scope === "calendar"
			? actionData
			: undefined;
	const icloudActionData =
		actionData && "scope" in actionData && actionData.scope === "icloud"
			? actionData
			: undefined;
	return {
		actionData,
		user,
		calendar,
		navigation,
		intent,
		calendarActionData,
		icloudActionData,
	};
}

export default function Account(props: Route.ComponentProps) {
	const {
		actionData,
		user,
		calendar,
		navigation,
		intent,
		calendarActionData,
		icloudActionData,
	} = useAccount(props);

	return (
		<PageShell>
			<PageIntro
				eyebrow="USER SETTINGS"
				title="ユーザー設定"
				description="プロフィール、日時の表示、空き時間の初期状態、カレンダー連携を設定できます。"
			/>
			{actionData?.kind === "profile-updated" && (
				<div className="confirm-banner compact-banner">
					<Icon name="check" />
					<div>
						<strong>プロフィール設定を保存しました</strong>
					</div>
				</div>
			)}
			{actionData?.kind === "error" && actionData.scope === "profile" && (
				<ValidationMessage title={actionData.error.message}>
					操作内容を確認して、もう一度お試しください。
				</ValidationMessage>
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
								<span className="account-section-label">
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

					<section className="account-card">
						<div className="settings-section-heading">
							<div>
								<span className="account-section-label">PROFILE</span>
								<h2>表示とタイムゾーン</h2>
								<p>
									イベントの日時は、ここで設定したタイムゾーンで表示・入力します。
								</p>
							</div>
						</div>
						<Form className="form-stack" method="post">
							<div className="two-cols">
								<div className="field">
									<label htmlFor="profile-display-name">表示名</label>
									<input
										id="profile-display-name"
										name="display_name"
										defaultValue={user.display_name}
										required
										maxLength={100}
									/>
								</div>
								<div className="field">
									<label htmlFor="profile-time-zone">タイムゾーン</label>
									<input
										id="profile-time-zone"
										name="time_zone"
										list="profile-time-zones"
										defaultValue={user.time_zone}
										required
									/>
									<datalist id="profile-time-zones">
										{COMMON_TIME_ZONES.map((timeZone) => (
											<option key={timeZone} value={timeZone} />
										))}
									</datalist>
								</div>
							</div>
							<button
								className="button button-primary"
								type="submit"
								name="intent"
								value="update-profile"
								disabled={navigation.state !== "idle"}
							>
								{intent === "update-profile" ? "保存しています…" : "設定を保存"}
							</button>
						</Form>
					</section>
					<AvailabilitySettings
						user={user}
						saved={actionData?.kind === "availability-default-updated"}
						error={
							actionData?.kind === "error" &&
							actionData.scope === "availability"
								? actionData.error
								: undefined
						}
						saving={
							intent === "update-availability-default" &&
							navigation.state !== "idle"
						}
						disabled={navigation.state !== "idle"}
					/>
				</div>
			)}
			{calendar.settings ? (
				<CalendarSettings
					loaderData={calendar.settings}
					actionData={calendarActionData}
					icloudActionData={icloudActionData}
				/>
			) : (
				<section id="calendar-settings" className="account-card">
					<h2>カレンダー設定</h2>
					<ValidationMessage title="カレンダー設定を読み込めませんでした">
						{calendar.error?.message}
					</ValidationMessage>
				</section>
			)}
		</PageShell>
	);
}
