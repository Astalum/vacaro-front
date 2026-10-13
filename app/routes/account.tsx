import { useEffect, useState } from "react";
import {
	data,
	Form,
	redirect,
	redirectDocument,
	useNavigation,
} from "react-router";
import { Icon, PageIntro, PageShell } from "~/components/app";
import { TimePicker } from "~/components/ui/time-picker";
import { ValidationMessage } from "~/components/ui/validation-message";
import {
	ApiError,
	apiErrorData,
	apiRequest,
	clearSavedCalendarIDs,
	type GoogleCalendar,
	saveCalendarAvailabilityWindow,
	saveCalendarIDs,
	savedCalendarAvailabilityWindow,
	savedCalendarIDs,
	type User,
} from "~/lib/api";
import type { Route } from "./+types/account";

type CalendarConnectionStatus = "connected" | "disconnected" | "unknown";

export function meta() {
	return [{ title: "ユーザー設定 | vacaro" }];
}

export async function clientLoader() {
	try {
		const user = await apiRequest<User>("/me");
		const calendarOptions =
			user.account_type === "registered"
				? await apiRequest<{
						calendars: GoogleCalendar[];
						write_enabled: boolean;
					}>("/integrations/google-calendar/calendars")
						.then((result) => ({
							calendars: result.calendars,
							writeEnabled: result.write_enabled,
							error: null,
							connectionStatus: "connected" as const,
						}))
						.catch((error: unknown) => {
							const apiError = apiErrorData(error);
							return {
								calendars: [] as GoogleCalendar[],
								writeEnabled: false,
								error: apiError,
								connectionStatus: (apiError.code === "calendar_not_connected"
									? "disconnected"
									: "unknown") as CalendarConnectionStatus,
							};
						})
				: {
						calendars: [] as GoogleCalendar[],
						writeEnabled: false,
						error: null,
						connectionStatus: "disconnected" as const,
					};
		return { user, calendarOptions };
	} catch (error) {
		if (error instanceof ApiError && error.status === 401)
			return {
				user: null,
				calendarOptions: {
					calendars: [] as GoogleCalendar[],
					writeEnabled: false,
					error: null,
					connectionStatus: "disconnected" as const,
				},
			};
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
		<PageShell>
			<div className="page-loading">アカウント情報を読み込んでいます…</div>
		</PageShell>
	);
}

export default function Account({
	loaderData,
	actionData,
}: Route.ComponentProps) {
	const { user, calendarOptions } = loaderData;
	const navigation = useNavigation();
	const intent = navigation.formData?.get("intent");
	const calendarConnectionStatus: CalendarConnectionStatus =
		actionData?.kind === "disconnected"
			? "disconnected"
			: calendarOptions.connectionStatus;
	const [selectedCalendarIDs, setSelectedCalendarIDs] = useState<string[]>(() =>
		savedCalendarIDs(calendarOptions.calendars),
	);
	const [availabilityWindow, setAvailabilityWindow] = useState(() =>
		savedCalendarAvailabilityWindow(),
	);
	const [preferenceMessage, setPreferenceMessage] = useState<{
		kind: "success" | "error";
		text: string;
	} | null>(null);
	const [availabilityWindowMessage, setAvailabilityWindowMessage] = useState<{
		kind: "success" | "error";
		text: string;
	} | null>(null);
	useEffect(() => {
		if (actionData?.kind === "disconnected") {
			clearSavedCalendarIDs();
			setSelectedCalendarIDs([]);
		}
	}, [actionData]);
	const toggleCalendar = (calendarID: string) => {
		setPreferenceMessage(null);
		setSelectedCalendarIDs((current) =>
			current.includes(calendarID)
				? current.filter((id) => id !== calendarID)
				: [...current, calendarID],
		);
	};
	const saveCalendarPreference = () => {
		const saved = saveCalendarIDs(selectedCalendarIDs);
		setPreferenceMessage({
			kind: saved ? "success" : "error",
			text: saved
				? "使用するカレンダーを保存しました"
				: "設定を保存できませんでした。ブラウザの保存設定をご確認ください。",
		});
	};
	const saveAvailabilityWindow = () => {
		if (
			!availabilityWindow.start ||
			!availabilityWindow.end ||
			availabilityWindow.start >= availabilityWindow.end
		) {
			setAvailabilityWindowMessage({
				kind: "error",
				text: "終了時刻は開始時刻より後にしてください",
			});
			return;
		}
		const saved = saveCalendarAvailabilityWindow(availabilityWindow);
		setAvailabilityWindowMessage({
			kind: saved ? "success" : "error",
			text: saved
				? "取り込み時間帯を保存しました"
				: "設定を保存できませんでした。ブラウザの保存設定をご確認ください。",
		});
	};

	return (
		<PageShell>
			<PageIntro
				eyebrow="USER SETTINGS"
				title="ユーザー設定"
				description="プロフィールとカレンダーの取り込み設定を管理します。"
			/>

			{actionData?.kind === "disconnected" && (
				<div className="confirm-banner compact-banner">
					<Icon name="check" />
					<div>
						<strong>Googleカレンダーの接続を解除しました</strong>
					</div>
				</div>
			)}
			{actionData?.kind === "error" && (
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

					{user.account_type === "registered" && (
						<>
							<section className="account-card integration-card">
								<div className="account-card-heading">
									<div className="account-card-icon calendar-icon">
										<Icon name="calendar" />
									</div>
									<div>
										<span className="account-section-label">
											CALENDAR CONNECTION
										</span>
										<h2>Googleカレンダー連携</h2>
										<p>
											予定の空き時間の取り込みと、確定日時の登録に使う接続を管理します。
										</p>
									</div>
									<span
										className={`integration-status ${calendarConnectionStatus}`}
									>
										<i />
										{calendarConnectionStatus === "connected"
											? "接続済み"
											: calendarConnectionStatus === "disconnected"
												? "未接続"
												: "確認できません"}
									</span>
								</div>
								{calendarConnectionStatus === "connected" &&
									!calendarOptions.writeEnabled && (
										<div
											className="calendar-write-permission-notice"
											role="status"
										>
											<Icon name="info" size={18} />
											<p>
												確定日時の自動登録を有効にするには、Googleカレンダーを再接続してください。
											</p>
										</div>
									)}
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
												: calendarConnectionStatus === "connected"
													? "再接続する"
													: "接続する"}
										</button>
									</Form>
									<Form method="post">
										<button
											className="button button-ghost"
											type="submit"
											name="intent"
											value="calendar-disconnect"
											disabled={
												navigation.state !== "idle" ||
												calendarConnectionStatus === "disconnected"
											}
										>
											{intent === "calendar-disconnect"
												? "解除しています…"
												: "接続を解除"}
										</button>
									</Form>
								</div>
							</section>

							<section className="account-card availability-window-card">
								<div className="settings-section-heading">
									<div>
										<span className="account-section-label">
											AVAILABILITY WINDOW
										</span>
										<h2>空き時間の取り込み範囲</h2>
										<p>
											Googleカレンダーから取り込む際、毎日この時間帯だけを空き時間として読み取ります。
										</p>
									</div>
								</div>
								<div className="settings-time-window">
									<div className="settings-time-window-field">
										<label htmlFor="calendar-window-start">
											<em>IN</em>
											開始時刻
										</label>
										<TimePicker
											id="calendar-window-start"
											value={availabilityWindow.start}
											onValueChange={(value) => {
												setAvailabilityWindowMessage(null);
												setAvailabilityWindow((current) => ({
													...current,
													start: value,
												}));
											}}
										/>
									</div>
									<span className="time-window-separator" aria-hidden="true">
										〜
									</span>
									<div className="settings-time-window-field">
										<label htmlFor="calendar-window-end">
											<em>OUT</em>
											終了時刻
										</label>
										<TimePicker
											id="calendar-window-end"
											value={availabilityWindow.end}
											onValueChange={(value) => {
												setAvailabilityWindowMessage(null);
												setAvailabilityWindow((current) => ({
													...current,
													end: value,
												}));
											}}
										/>
									</div>
								</div>
								<div className="settings-save-row">
									{availabilityWindowMessage && (
										<span
											className={`save-message ${availabilityWindowMessage.kind}`}
											aria-live="polite"
										>
											{availabilityWindowMessage.text}
										</span>
									)}
									<button
										className="button button-primary"
										type="button"
										onClick={saveAvailabilityWindow}
									>
										取り込み範囲を保存
									</button>
								</div>
							</section>

							<section
								className="account-card calendar-settings-card"
								id="calendar-settings"
							>
								<div className="settings-section-heading">
									<div>
										<span className="account-section-label">
											CALENDAR PREFERENCE
										</span>
										<h2>使用するカレンダー</h2>
										<p>
											空き時間の判定で「予定あり」として扱うカレンダーを選択します。
										</p>
									</div>
									{calendarOptions.calendars.length > 0 && (
										<span className="selection-count">
											{selectedCalendarIDs.length}件選択中
										</span>
									)}
								</div>
								{calendarConnectionStatus === "disconnected" ? (
									<div className="settings-empty-calendar">
										<Icon name="calendar" size={20} />
										<p>連携カードからGoogleカレンダーを接続してください。</p>
									</div>
								) : calendarOptions.error ? (
									<div className="calendar-picker-error settings-error">
										<Icon name="info" size={18} />
										<div>
											<strong>カレンダー一覧を取得できませんでした</strong>
											<p>
												Googleカレンダーを接続または再接続して、一覧を読み込んでください。
											</p>
										</div>
									</div>
								) : calendarOptions.calendars.length > 0 ? (
									<>
										<div className="settings-calendar-list">
											{calendarOptions.calendars.map((calendar) => (
												<label
													className="settings-calendar-option"
													key={calendar.id}
												>
													<input
														type="checkbox"
														checked={selectedCalendarIDs.includes(calendar.id)}
														onChange={() => toggleCalendar(calendar.id)}
													/>
													<span className="calendar-checkmark">
														<Icon name="check" size={15} />
													</span>
													<span
														className="calendar-color"
														style={{
															backgroundColor:
																calendar.background_color || "#4285f4",
														}}
													/>
													<span className="calendar-option-name">
														{calendar.summary}
													</span>
													{calendar.primary && <em>メイン</em>}
												</label>
											))}
										</div>
										<div className="settings-save-row">
											{preferenceMessage && (
												<span
													className={`save-message ${preferenceMessage.kind}`}
													aria-live="polite"
												>
													{preferenceMessage.text}
												</span>
											)}
											<button
												className="button button-primary"
												type="button"
												disabled={selectedCalendarIDs.length === 0}
												onClick={saveCalendarPreference}
											>
												設定を保存
											</button>
										</div>
									</>
								) : (
									<div className="settings-empty-calendar">
										<Icon name="calendar" size={26} />
										<p>
											カレンダーを接続すると、ここで取り込み対象を選択できます。
										</p>
									</div>
								)}
							</section>
						</>
					)}
				</div>
			)}
		</PageShell>
	);
}
