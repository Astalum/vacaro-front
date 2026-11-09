import { useEffect, useState } from "react";
import {
	data,
	Form,
	redirectDocument,
	useNavigation,
	useLocation,
	useSearchParams,
} from "react-router";
import { Icon } from "~/components/app";
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
import ICloudSettings, {
	loadICloudConnection,
} from "~/components/icloud-settings";
import TimeTreeGuide from "~/components/timetree-guide";
import type { SettingsActionData } from "~/lib/settings-action";

type CalendarConnectionStatus = "connected" | "disconnected" | "unknown";
export async function loadCalendarSettings(user: User | null) {
	const { provider } = user
		? await loadCalendarPreference()
		: { provider: "none" as CalendarProvider };
	const calendarOptions =
		user?.account_type === "registered" &&
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
	return {
		user,
		calendarOptions,
		provider,
		icloud: provider === "icloud" ? await loadICloudConnection() : null,
	};
}

export async function handleCalendarAction(formData: FormData) {
	const intent = formData.get("intent");
	try {
		if (intent === "select-provider") {
			await apiRequest("/integrations/calendar-preference", {
				method: "PUT",
				body: JSON.stringify({
					provider: String(formData.get("provider") ?? ""),
				}),
			});
			return { kind: "provider-selected" as const, scope: "calendar" as const };
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
			return { kind: "disconnected" as const, scope: "calendar" as const };
		}
		return data(
			{
				kind: "error" as const,
				scope: "calendar" as const,
				error: { code: "invalid_intent", message: "操作を確認してください" },
			},
			{ status: 400 },
		);
	} catch (error) {
		return data(
			{
				kind: "error" as const,
				scope: "calendar" as const,
				error: apiErrorData(error),
			},
			{ status: error instanceof ApiError ? error.status : 500 },
		);
	}
}

function useCalendarSettings({
	loaderData,
	actionData,
	icloudActionData,
}: {
	loaderData: Awaited<ReturnType<typeof loadCalendarSettings>>;
	actionData?: SettingsActionData;
	icloudActionData?: SettingsActionData;
}) {
	const { user, calendarOptions, provider, icloud } = loaderData;
	const [providerChoice, chooseProvider] = useState<CalendarProvider>(provider);
	useEffect(() => chooseProvider(provider), [provider]);
	const [searchParams] = useSearchParams();
	const { hash } = useLocation();
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

	function changeStartTime(value: string) {
		setAvailabilityWindowMessage(null);
		setAvailabilityWindow((current) => ({
			...current,
			start: value,
		}));
	}

	function changeEndTime(value: string) {
		setAvailabilityWindowMessage(null);
		setAvailabilityWindow((current) => ({
			...current,
			end: value,
		}));
	}

	return {
		actionData,
		icloudActionData,
		user,
		calendarOptions,
		provider,
		icloud,
		providerChoice,
		chooseProvider,
		hash,
		calendarConnectionError,
		navigation,
		intent,
		calendarConnectionStatus,
		selectedCalendarIDs,
		availabilityWindow,
		preferenceMessage,
		availabilityWindowMessage,
		toggleCalendar,
		saveCalendarPreference,
		saveAvailabilityWindow,
		changeStartTime,
		changeEndTime,
	};
}

export default function CalendarSettings(props: {
	loaderData: Awaited<ReturnType<typeof loadCalendarSettings>>;
	actionData?: SettingsActionData;
	icloudActionData?: SettingsActionData;
}) {
	const model = useCalendarSettings(props);
	const {
		actionData,
		icloudActionData,
		user,
		provider,
		icloud,
		hash,
		calendarConnectionError,
	} = model;

	return (
		<section
			id="calendar-settings"
			className="account-calendar-settings"
			aria-labelledby="calendar-settings-heading"
		>
			<div className="settings-section-heading">
				<div>
					<span className="account-section-label">CALENDAR SETTINGS</span>
					<h2 id="calendar-settings-heading">カレンダー設定</h2>
					<p>利用するサービス、接続と取り込み対象を設定します。</p>
				</div>
			</div>
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
			{actionData?.kind === "error" && actionData.error && (
				<ValidationMessage title={actionData.error.message}>
					操作内容を確認して、もう一度お試しください。
				</ValidationMessage>
			)}
			<CalendarProviderSelector model={model} />

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
							<GoogleCalendarConnection model={model} />

							{provider === "google" && (
								<>
									<CalendarImportWindow model={model} />

									<GoogleCalendarSelection model={model} />
								</>
							)}
						</>
					)}
				{provider === "icloud" && icloud && (
					<ICloudSettings loaderData={icloud} actionData={icloudActionData} />
				)}
				<details
					id="timetree-guide"
					className="account-card timetree-inline-guide"
					open={provider === "timetree" || hash === "#timetree-guide"}
				>
					<summary>TimeTreeへの表示手順</summary>
					<TimeTreeGuide />
				</details>
			</div>
		</section>
	);
}

function CalendarProviderSelector({
	model,
}: {
	model: ReturnType<typeof useCalendarSettings>;
}) {
	const { actionData, user, providerChoice, chooseProvider, navigation } =
		model;
	return (
		<section className="account-card provider-selection-card">
			<h2>利用するカレンダー</h2>
			<p>
				連携サービスは1つだけ選択できます。選択したサービス内では、複数のカレンダーを取り込み対象にできます。
			</p>
			<Form preventScrollReset method="post" className="calendar-provider-form">
				<fieldset disabled={!user || navigation.state !== "idle"}>
					<legend>使用するサービス</legend>
					{CALENDAR_PROVIDERS.map((option) => (
						<label key={option.value} className="calendar-provider-option">
							<input
								type="radio"
								name="provider"
								value={option.value}
								checked={providerChoice === option.value}
								onChange={() => chooseProvider(option.value)}
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
	);
}

function GoogleCalendarConnection({
	model,
}: {
	model: ReturnType<typeof useCalendarSettings>;
}) {
	const {
		calendarOptions,
		provider,
		navigation,
		intent,
		calendarConnectionStatus,
	} = model;
	return (
		<section className="account-card integration-card" id="google-calendar">
			<div className="account-card-heading">
				<div className="account-card-icon calendar-icon">
					<Icon name="calendar" />
				</div>
				<div>
					<span className="account-section-label">CALENDAR CONNECTION</span>
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
				<span className={`integration-status ${calendarConnectionStatus}`}>
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
					<div className="calendar-write-permission-notice" role="status">
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
				<Form preventScrollReset method="post">
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
				<Form preventScrollReset method="post">
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
	);
}

function CalendarImportWindow({
	model,
}: {
	model: ReturnType<typeof useCalendarSettings>;
}) {
	const {
		availabilityWindow,
		availabilityWindowMessage,
		saveAvailabilityWindow,
		changeStartTime,
		changeEndTime,
	} = model;
	return (
		<section className="account-card availability-window-card">
			<div className="settings-section-heading">
				<div>
					<span className="account-section-label">AVAILABILITY WINDOW</span>
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
						onValueChange={changeStartTime}
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
						onValueChange={changeEndTime}
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
	);
}

function GoogleCalendarSelection({
	model,
}: {
	model: ReturnType<typeof useCalendarSettings>;
}) {
	const {
		calendarOptions,
		calendarConnectionStatus,
		selectedCalendarIDs,
		preferenceMessage,
		toggleCalendar,
		saveCalendarPreference,
	} = model;
	return (
		<section
			className="account-card calendar-settings-card"
			id="calendar-settings"
		>
			<div className="settings-section-heading">
				<div>
					<span className="account-section-label">CALENDAR PREFERENCE</span>
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
					<p>連携カードからGoogleカレンダーを接続してください。</p>
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
							<label className="settings-calendar-option" key={calendar.id}>
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
										backgroundColor: calendar.background_color || "#4285f4",
									}}
								/>
								<span className="calendar-option-name">{calendar.summary}</span>
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
					<p>カレンダーを接続すると、ここで取り込み対象を選択できます。</p>
				</div>
			)}
		</section>
	);
}
