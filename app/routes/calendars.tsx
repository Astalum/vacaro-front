import { useEffect, useState } from "react";
import {
	data,
	Form,
	redirectDocument,
	useNavigation,
	useSearchParams,
	Link,
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
	isGoogleHolidayCalendarID,
	saveCalendarAvailabilityWindow,
	saveCalendarIDs,
	savedCalendarAvailabilityWindow,
	savedCalendarIDs,
	type User,
} from "~/lib/api";
import {
	CALENDAR_PROVIDERS,
	loadCalendarPreference,
	type CalendarProvider,
} from "~/lib/calendar-provider";
import { createPageMeta } from "~/lib/meta";
import type { Route } from "./+types/calendars";

type CalendarConnectionStatus = "connected" | "disconnected" | "unknown";
export function meta() {
	return createPageMeta(
		"カレンダー設定 | vacaro",
		"カレンダーの接続、取り込み対象、TimeTreeでの表示方法を管理します。",
	);
}
export async function clientLoader() {
	try {
		const user = await apiRequest<User>("/me");
		const { provider } = await loadCalendarPreference();
		const calendarOptions =
			user.account_type === "registered" &&
			(provider === "google" || provider === "timetree")
				? await apiRequest<{
						calendars: GoogleCalendar[];
						write_enabled: boolean;
					}>("/integrations/google-calendar/calendars")
						.then((result) => ({
							calendars: result.calendars.filter(
								(calendar) => !isGoogleHolidayCalendarID(calendar.id),
							),
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
		return { user, calendarOptions, provider };
	} catch (error) {
		if (error instanceof ApiError && error.status === 401)
			return {
				user: null,
				provider: "none" as CalendarProvider,
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
		if (intent === "select-provider") {
			await apiRequest("/integrations/calendar-preference", {
				method: "PUT",
				body: JSON.stringify({
					provider: String(formData.get("provider") ?? ""),
				}),
			});
			return { kind: "provider-selected" as const };
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
			<div className="page-loading">カレンダー設定を読み込んでいます…</div>
		</PageShell>
	);
}
export default function CalendarSettings({
	loaderData,
	actionData,
}: Route.ComponentProps) {
	const { user, calendarOptions, provider } = loaderData;
	const [providerChoice, setProviderChoice] =
		useState<CalendarProvider>(provider);
	useEffect(() => setProviderChoice(provider), [provider]);
	const [searchParams] = useSearchParams();
	const calendarResult = searchParams.get("google_calendar");
	const calendarConnectionError =
		calendarResult === "permission_required"
			? "空き時間またはカレンダー一覧の読み取り権限が不足しています。再接続して、読み取り権限を許可してください。"
			: calendarResult === "error"
				? "Googleカレンダーの接続を完了できませんでした。もう一度接続してください。"
				: null;
	const navigation = useNavigation();
	const intent = navigation.formData?.get("intent");
	const calendarConnectionStatus: CalendarConnectionStatus =
		actionData?.kind === "disconnected"
			? "disconnected"
			: calendarOptions.connectionStatus;
	const [selectedCalendarIDs, setSelectedCalendarIDs] = useState<string[]>(() =>
		savedCalendarIDs(calendarOptions.calendars),
	);
	useEffect(() => {
		setSelectedCalendarIDs(savedCalendarIDs(calendarOptions.calendars));
	}, [calendarOptions.calendars]);
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
				eyebrow="CALENDAR SETTINGS"
				title="カレンダー設定"
				description="カレンダーの接続・取り込み設定と、各サービスでの表示方法をまとめて管理します。"
				backTo="/account"
				backLabel="ユーザー設定へ戻る"
			/>
			{calendarConnectionError && (
				<ValidationMessage title="Googleカレンダーに接続できませんでした">
					{calendarConnectionError}
				</ValidationMessage>
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
				<ValidationMessage title={actionData.error.message}>
					操作内容を確認して、もう一度お試しください。
				</ValidationMessage>
			)}
			<section className="account-card provider-selection-card">
				<h2>利用するカレンダー</h2>
				<p>
					連携サービスは1つだけ選択できます。選択したサービス内では、複数のカレンダーを取り込み対象にできます。
				</p>
				<Form method="post" className="calendar-provider-form">
					<fieldset disabled={!user || navigation.state !== "idle"}>
						<legend>使用するサービス</legend>
						{CALENDAR_PROVIDERS.map((option) => (
							<label key={option.value} className="calendar-provider-option">
								<input
									type="radio"
									name="provider"
									value={option.value}
									checked={providerChoice === option.value}
									onChange={() => setProviderChoice(option.value)}
								/>
								<span>
									<strong>{option.label}</strong>
									<small>{option.description}</small>
								</span>
							</label>
						))}
					</fieldset>
					<button
						type="submit"
						name="intent"
						value="select-provider"
						className="button button-primary"
						disabled={!user || navigation.state !== "idle"}
					>
						利用するカレンダーを保存
					</button>
					{actionData?.kind === "provider-selected" && (
						<p role="status">利用するカレンダーを変更しました。</p>
					)}
				</Form>
				<p>
					切り替え後の取り込み・自動登録は選択したサービスだけで行います。切り替え前に書き出した予定は元のカレンダーに残ります。
				</p>
			</section>
			{!user && (
				<section className="account-card">
					<h2>カレンダーの設定にはログインが必要です</h2>
					<a className="button google-button" href="/api/v1/auth/google/start">
						Googleでログイン
					</a>
				</section>
			)}
			<div className="account-stack calendar-settings-stack">
				{(provider === "google" || provider === "timetree") &&
					user?.account_type !== "registered" && (
						<section className="account-card">
							<h2>Googleカレンダーを使うには</h2>
							<p>
								Googleでログインしてカレンダーを接続してください。ゲストで作成・参加したイベントと回答も引き継げます。
							</p>
							<a
								className="button google-button"
								href="/api/v1/auth/google/start"
							>
								Googleでログイン
							</a>
						</section>
					)}

				{(provider === "google" || provider === "timetree") &&
					user?.account_type === "registered" && (
						<>
							<section
								className="account-card integration-card"
								id="google-calendar"
							>
								<div className="account-card-heading">
									<div className="account-card-icon calendar-icon">
										<Icon name="calendar" />
									</div>
									<div>
										<span className="account-section-label">
											CALENDAR CONNECTION
										</span>
										<h2>
											{provider === "timetree"
												? "TimeTreeへの書き出し（Google経由）"
												: "Googleカレンダー連携"}
										</h2>
										<p>
											{provider === "timetree"
												? "確定日時をGoogleカレンダー経由でTimeTreeに表示するための接続を管理します。"
												: "予定の空き時間の取り込みと、確定日時の登録に使う接続を管理します。"}
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
												専用カレンダーへの自動登録を有効にするには、Googleカレンダーを再接続して、Vacaroが作成するカレンダーの管理を許可してください。
											</p>
										</div>
									)}
								<p>
									接続時は、カレンダー一覧と空き時間の読み取りを許可してください。
									確定日時は、Vacaroが作成する専用カレンダー「Vacaro」に登録します。自動登録には、この専用カレンダーの作成・管理の許可も必要です。
								</p>
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

							{provider === "google" && (
								<>
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
											<span
												className="time-window-separator"
												aria-hidden="true"
											>
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
													空き時間の判定で「予定あり」として扱うカレンダーを選択します。初期値はメインカレンダーのみです。追加のカレンダーは選択して保存してください。祝日カレンダーは自動的に除外されます。
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
												<p>
													連携カードからGoogleカレンダーを接続してください。
												</p>
											</div>
										) : calendarOptions.error ? (
											<div className="calendar-picker-error settings-error">
												<Icon name="info" size={18} />
												<div>
													<strong>カレンダー一覧を取得できませんでした</strong>
													<p>{calendarOptions.error.message}</p>
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
																checked={selectedCalendarIDs.includes(
																	calendar.id,
																)}
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
						</>
					)}
				{provider === "icloud" && (
					<>
						<section className="account-card">
							<h2>iCloudカレンダー連携</h2>
							<p>
								iPhone標準カレンダーのiCloud予定を取り込み、確定予定を専用カレンダー「Vacaro」に自動登録できます。
							</p>
							<Link className="button button-ghost" to="/calendars/icloud">
								<Icon name="calendar" size={17} />
								iCloudの接続・取り込み設定
							</Link>
						</section>
					</>
				)}
				{provider === "timetree" && (
					<>
						<section className="account-card">
							<h2>TimeTreeで確定予定を表示</h2>
							<p>
								Google・iCloudの専用カレンダーを経由して、確定予定をTimeTreeに表示できます。
							</p>
							<Link className="button button-ghost" to="/calendars/timetree">
								TimeTreeへの表示手順
							</Link>
						</section>
					</>
				)}
			</div>
		</PageShell>
	);
}
