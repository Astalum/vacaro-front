import { useEffect, useState } from "react";
import { data, Form, useNavigation } from "react-router";
import { Icon } from "~/components/app";
import { ValidationMessage } from "~/components/ui/validation-message";
import { ApiError, apiErrorData, apiRequest } from "~/lib/api";
import {
	clearSavedICloudCalendarIDs,
	type ICloudCalendarOptions,
	savedICloudCalendarIDs,
	saveICloudCalendarIDs,
} from "~/lib/icloud-calendar";
import type { SettingsActionData } from "~/lib/settings-action";

export async function loadICloudConnection() {
	return apiRequest<ICloudCalendarOptions>(
		"/integrations/icloud-calendar/calendars",
	)
		.then((options) => ({ connected: true, options, error: null }))
		.catch((error: unknown) => ({
			connected: false,
			options: { calendars: [], account: "" } as ICloudCalendarOptions,
			error: apiErrorData(error),
		}));
}
export async function handleICloudAction(form: FormData) {
	try {
		if (form.get("intent") === "icloud-disconnect") {
			await apiRequest<void>("/integrations/icloud-calendar", {
				method: "DELETE",
			});
			clearSavedICloudCalendarIDs();
			return { kind: "disconnected" as const, scope: "icloud" as const };
		}
		if (form.get("intent") !== "icloud-connect")
			return data(
				{
					kind: "error" as const,
					scope: "icloud" as const,
					error: { code: "invalid_intent", message: "操作を確認してください" },
				},
				{ status: 400 },
			);
		await apiRequest("/integrations/icloud-calendar", {
			method: "POST",
			body: JSON.stringify({
				apple_account: String(form.get("apple_account") ?? "").trim(),
				app_password: String(form.get("app_password") ?? "").trim(),
			}),
		});
		return { kind: "connected" as const, scope: "icloud" as const };
	} catch (error) {
		// Never return credentials or form values in action responses.
		return data(
			{
				kind: "error" as const,
				scope: "icloud" as const,
				error: apiErrorData(error),
			},
			{ status: error instanceof ApiError ? error.status : 500 },
		);
	}
}
function useICloudSettings({
	loaderData,
	actionData,
}: {
	loaderData: Awaited<ReturnType<typeof loadICloudConnection>>;
	actionData?: SettingsActionData;
}) {
	const { connected, options, error } = loaderData;
	const navigation = useNavigation();
	const busy = navigation.state !== "idle";
	const [account, changeAccount] = useState(options.account);
	const [password, changePassword] = useState("");
	const [selected, setSelected] = useState(() =>
		savedICloudCalendarIDs(options.calendars),
	);
	const [message, setMessage] = useState<string | null>(null);
	useEffect(() => {
		changePassword("");
	}, [actionData]);
	useEffect(() => {
		setSelected(savedICloudCalendarIDs(options.calendars));
	}, [options.calendars]);

	function toggleCalendar(calendarID: string) {
		setMessage(null);
		setSelected((ids) =>
			ids.includes(calendarID)
				? ids.filter((id) => id !== calendarID)
				: [...ids, calendarID],
		);
	}

	const saveCalendarPreference = () =>
		setMessage(
			saveICloudCalendarIDs(selected)
				? "使用するカレンダーを保存しました"
				: "設定を保存できませんでした。ブラウザの保存設定をご確認ください。",
		);
	return {
		actionData,
		connected,
		options,
		error,
		busy,
		account,
		changeAccount,
		password,
		changePassword,
		selected,
		message,
		toggleCalendar,
		saveCalendarPreference,
	};
}

export default function ICloudSettings(props: {
	loaderData: Awaited<ReturnType<typeof loadICloudConnection>>;
	actionData?: SettingsActionData;
}) {
	const {
		actionData,
		connected,
		options,
		error,
		busy,
		account,
		changeAccount,
		password,
		changePassword,
		selected,
		message,
		toggleCalendar,
		saveCalendarPreference,
	} = useICloudSettings(props);

	const connectForm = (
		<Form preventScrollReset method="post" className="icloud-connect-form">
			<label htmlFor="apple-account">Apple Accountのメールアドレス</label>
			<input
				id="apple-account"
				name="apple_account"
				type="email"
				autoComplete="username"
				required
				maxLength={254}
				value={account}
				onChange={(event) => changeAccount(event.target.value)}
			/>
			<label htmlFor="icloud-app-password">アプリ用パスワード</label>
			<input
				id="icloud-app-password"
				name="app_password"
				type="password"
				autoComplete="off"
				spellCheck={false}
				autoCapitalize="none"
				required
				minLength={16}
				maxLength={19}
				value={password}
				onChange={(event) => changePassword(event.target.value)}
				aria-describedby="icloud-password-help"
			/>
			<p id="icloud-password-help">
				通常のApple Accountのパスワードは入力しないでください。
				<a href="https://account.apple.com/" target="_blank" rel="noreferrer">
					Apple Account
				</a>
				の「サインインとセキュリティ」→「アプリ用パスワード」で、Vacaro用のパスワードを作成してください。2ファクタ認証が必要です。
			</p>
			<button
				type="submit"
				name="intent"
				value="icloud-connect"
				className="button button-primary"
				disabled={busy}
			>
				{busy
					? "接続しています…"
					: connected
						? "接続情報を更新"
						: "iCloudに接続"}
			</button>
		</Form>
	);
	return (
		<div id="icloud-settings">
			<div className="account-main mx-auto">
				<div className="settings-section-heading">
					<div>
						<h2>iCloudカレンダー連携</h2>
						<p>
							iPhone標準カレンダーのiCloud予定から空き時間を取り込み、確定予定を自動登録します。
						</p>
					</div>
				</div>
				{actionData?.kind === "error" && actionData.error && (
					<ValidationMessage title={actionData.error.message}>
						入力内容と接続状態を確認してください。
					</ValidationMessage>
				)}
				{actionData?.kind === "connected" && (
					<p role="status" className="confirm-banner compact-banner">
						iCloudに接続しました。確定予定は専用カレンダー「Vacaro」に登録します。
					</p>
				)}
				{actionData?.kind === "disconnected" && (
					<p role="status" className="confirm-banner compact-banner">
						VacaroからiCloudへの接続を解除しました。
					</p>
				)}
				{error && error.code !== "icloud_not_connected" && (
					<ValidationMessage title={error.message}>
						接続情報を確認するか、時間をおいて再試行してください。
					</ValidationMessage>
				)}
				<div className="account-stack">
					<section
						className="account-card"
						aria-labelledby="icloud-connection-heading"
					>
						<h2 id="icloud-connection-heading">iCloudとの接続</h2>
						<p>{connected ? `${options.account} に接続済み` : "未接続"}</p>
						<p>
							確定予定の登録・更新・削除には、iCloud内に作成する専用カレンダー「Vacaro」を使います。連携用の認証情報は暗号化して保存します。
						</p>
						{connected ? (
							<details>
								<summary>接続情報を更新する</summary>
								{connectForm}
							</details>
						) : (
							connectForm
						)}
						{connected && (
							<Form
								preventScrollReset
								method="post"
								className="icloud-disconnect"
							>
								<button
									type="submit"
									name="intent"
									value="icloud-disconnect"
									className="button button-ghost"
									disabled={busy}
								>
									接続を解除
								</button>
							</Form>
						)}
						<p>
							接続を解除しても、iCloud上のカレンダーと予定は残ります。Apple側のアプリ用パスワードは、Apple
							Accountから取り消せます。
						</p>
					</section>
					{connected && (
						<section
							className="account-card calendar-settings-card"
							aria-labelledby="icloud-calendars-heading"
						>
							<h2 id="icloud-calendars-heading">
								取り込みに使用するカレンダー
							</h2>
							<p>
								「予定あり」として扱うiCloudカレンダーを選択します。祝日などの購読カレンダーは対象に含めません。
							</p>
							<div className="settings-calendar-list">
								{options.calendars.map((calendar) => (
									<label key={calendar.id} className="settings-calendar-option">
										<input
											type="checkbox"
											checked={selected.includes(calendar.id)}
											onChange={() => toggleCalendar(calendar.id)}
										/>
										<span className="calendar-checkmark">
											<Icon name="check" size={14} />
										</span>
										<span className="calendar-option-name">
											{calendar.summary || "カレンダー"}
										</span>
										{calendar.is_vacaro && <em>確定予定</em>}
									</label>
								))}
							</div>
							<button
								type="button"
								className="button button-primary"
								disabled={selected.length === 0}
								onClick={saveCalendarPreference}
							>
								設定を保存
							</button>
							{message && <p role="status">{message}</p>}
						</section>
					)}
				</div>
			</div>
		</div>
	);
}
