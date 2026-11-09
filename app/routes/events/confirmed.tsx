import { data, Form, Link, useNavigation } from "react-router";
import { Icon, PageShell, WeekendText } from "~/components/app";
import {
	ApiError,
	apiErrorData,
	apiRequest,
	type ConfirmationCalendarStatus,
	type ConfirmationCalendarSync,
	type Event,
	formatDateRange,
	minutesLabel,
	type Participant,
	type SchedulingGroup,
	type User,
} from "~/lib/api";
import {
	calendarTransport,
	loadCalendarPreference,
} from "~/lib/calendar-provider";
import { createPageMeta } from "~/lib/meta";
import type { Route } from "./+types/confirmed";

export function meta({ loaderData }: Route.MetaArgs) {
	return createPageMeta(
		loaderData
			? `日程が決まりました — ${loaderData.event.title} | vacaro`
			: "確定した日程 | vacaro",
	);
}
export async function clientLoader({ params }: Route.ClientLoaderArgs) {
	const event = await apiRequest<Event>(`/events/${params.eventId}`);
	const { provider } = await loadCalendarPreference();
	const inactive: ConfirmationCalendarStatus = {
		connection_status: "inactive",
		syncs: [],
	};
	const [user, participants, groups, calendarStatus, icloudCalendarStatus] =
		await Promise.all([
			apiRequest<User>("/me"),
			apiRequest<Participant[]>(`/events/${event.id}/participants`),
			event.scheduling_mode === "groups"
				? apiRequest<SchedulingGroup[]>(`/events/${event.id}/groups`)
				: Promise.resolve([] as SchedulingGroup[]),
			(calendarTransport(provider) === "google"
				? apiRequest<ConfirmationCalendarStatus>(
						`/events/${event.id}/confirmation-calendar`,
					)
				: Promise.resolve(inactive)
			).catch(
				(): ConfirmationCalendarStatus => ({
					connection_status: "error",
					syncs: [],
				}),
			),
			(provider === "icloud"
				? apiRequest<ConfirmationCalendarStatus>(
						`/events/${event.id}/icloud-confirmation-calendar`,
					)
				: Promise.resolve(inactive)
			).catch(
				(): ConfirmationCalendarStatus => ({
					connection_status: "error",
					syncs: [],
				}),
			),
		]);
	return {
		event,
		user,
		participants,
		groups,
		calendarStatus,
		icloudCalendarStatus,
	};
}
clientLoader.hydrate = true as const;

export async function clientAction({
	params,
	request,
}: Route.ClientActionArgs) {
	const formData = await request.formData();
	const intent = String(formData.get("intent") ?? "");
	const rawGroupID = String(formData.get("group_id") ?? "").trim();
	const groupID = rawGroupID || null;
	const provider = intent === "sync-icloud-calendar" ? "icloud" : "google";
	if (intent !== "sync-calendar" && intent !== "sync-icloud-calendar") {
		return data(
			{
				kind: "error" as const,
				group_id: groupID,
				provider,
				error: { code: "invalid_intent", message: "操作を確認してください" },
			},
			{ status: 400 },
		);
	}
	try {
		await apiRequest<ConfirmationCalendarSync>(
			`/events/${params.eventId}/${provider === "icloud" ? "icloud-" : ""}confirmation-calendar`,
			{
				method: "POST",
				body: JSON.stringify({ group_id: groupID }),
			},
		);
		return {
			kind: "success" as const,
			group_id: groupID,
			provider,
			message: `${provider === "icloud" ? "iCloudの" : ""}専用カレンダー「Vacaro」に追加しました`,
		};
	} catch (error) {
		return data(
			{
				kind: "error" as const,
				group_id: groupID,
				provider,
				error: apiErrorData(error),
			},
			{ status: error instanceof ApiError ? error.status : 500 },
		);
	}
}
export function HydrateFallback() {
	return (
		<PageShell>
			<div className="page-loading">確定した日程を読み込んでいます…</div>
		</PageShell>
	);
}

function useConfirmedEvent({ loaderData, actionData }: Route.ComponentProps) {
	const {
		event,
		user,
		participants,
		groups,
		calendarStatus,
		icloudCalendarStatus = { connection_status: "not_connected", syncs: [] },
	} = loaderData;
	const navigation = useNavigation();
	const submittingGroupID =
		navigation.formData?.get("intent") === "sync-calendar"
			? String(navigation.formData.get("group_id") ?? "") || null
			: undefined;
	const canViewResults =
		event.created_by_user_id === user.id ||
		event.results_visible_to_participants;
	const allConfirmed =
		groups.length > 0 && groups.every((group) => group.confirmed_start_at);

	return {
		actionData,
		event,
		user,
		participants,
		groups,
		calendarStatus,
		icloudCalendarStatus,
		submittingGroupID,
		canViewResults,
		allConfirmed,
	};
}

export default function Confirmed(props: Route.ComponentProps) {
	const {
		actionData,
		event,
		user,
		participants,
		groups,
		calendarStatus,
		icloudCalendarStatus,
		submittingGroupID,
		canViewResults,
		allConfirmed,
	} = useConfirmedEvent(props);

	if (event.scheduling_mode === "groups") {
		return (
			<PageShell>
				<div className="confirmed-hero">
					<div className="success-badge">
						<Icon name="check" size={32} />
					</div>
					<span className="page-eyebrow">GROUP DATES</span>
					<h1>
						{allConfirmed
							? "全グループの日程が決まりました！"
							: "グループごとの確定日程"}
					</h1>
					<p>{event.title}</p>
				</div>
				<section className="confirmed-description">
					<h2>グループごとの日程について</h2>
					<p>
						グループごとに確定日時が異なります。所属しているグループの日時をご確認ください。
					</p>
					{event.description && <p>{event.description}</p>}
				</section>
				<div className="confirmed-group-grid">
					<article
						className={event.confirmed_start_at ? "confirmed" : "pending"}
					>
						<header>
							<span
								className={`group-state ${event.confirmed_start_at ? "confirmed" : "open"}`}
							>
								{event.confirmed_start_at ? "確定済み" : "調整中"}
							</span>
							<h2>全体</h2>
						</header>
						{event.confirmed_start_at && event.confirmed_end_at ? (
							<strong>
								<WeekendText>
									{formatDateRange(
										event.confirmed_start_at,
										event.confirmed_end_at,
										user.time_zone,
									)}
								</WeekendText>
							</strong>
						) : (
							<p>日程はまだ確定していません。</p>
						)}
						<div className="confirmed-group-meta">
							<span>
								<Icon name="clock" size={15} />{" "}
								{minutesLabel(event.duration_minutes)}
							</span>
							<span>
								<Icon name="users" size={15} /> 全参加者
							</span>
						</div>
						<ParticipantList label="参加者" participants={participants} />
						<div className="confirmed-group-actions">
							{event.confirmed_start_at && event.confirmed_end_at && (
								<CalendarSyncControls
									actionData={actionData}
									calendarStatus={calendarStatus}
									icloudCalendarStatus={icloudCalendarStatus}
									groupID={null}
									submittingGroupID={submittingGroupID}
								/>
							)}
							{canViewResults && (
								<Link
									className="button button-ghost"
									to={`/events/${event.id}/results?scope=whole`}
								>
									結果を見る
								</Link>
							)}
						</div>
					</article>
					{groups.map((group) => (
						<article
							key={group.id}
							className={group.confirmed_start_at ? "confirmed" : "pending"}
						>
							<header>
								<span
									className={`group-state ${group.confirmed_start_at ? "confirmed" : "open"}`}
								>
									{group.confirmed_start_at ? "確定済み" : "調整中"}
								</span>
								<h2>{group.name}</h2>
							</header>
							{group.confirmed_start_at && group.confirmed_end_at ? (
								<strong>
									<WeekendText>
										{formatDateRange(
											group.confirmed_start_at,
											group.confirmed_end_at,
											user.time_zone,
										)}
									</WeekendText>
								</strong>
							) : (
								<p>日程はまだ確定していません。</p>
							)}
							<div className="confirmed-group-meta">
								<span>
									<Icon name="clock" size={15} />{" "}
									{minutesLabel(group.duration_minutes)}
								</span>
								<span>
									<Icon name="users" size={15} /> {group.members.length}人
								</span>
							</div>
							<ParticipantList
								label="グループメンバー"
								participants={group.members}
							/>
							<div className="confirmed-group-actions">
								{group.confirmed_start_at &&
									group.confirmed_end_at &&
									group.members.some(
										(member) => member.user_id === user.id,
									) && (
										<CalendarSyncControls
											actionData={actionData}
											calendarStatus={calendarStatus}
											icloudCalendarStatus={icloudCalendarStatus}
											groupID={group.id}
											submittingGroupID={submittingGroupID}
										/>
									)}
								{canViewResults && (
									<Link
										className="button button-ghost"
										to={`/events/${event.id}/results?group_id=${group.id}`}
									>
										結果を見る
									</Link>
								)}
							</div>
						</article>
					))}
				</div>
				<TimeTreeGuideLink />
			</PageShell>
		);
	}
	const confirmed = event.confirmed_start_at && event.confirmed_end_at;
	if (!confirmed)
		return (
			<PageShell>
				<div className="empty-state">
					<Icon name="clock" size={35} />
					<h2>日程はまだ確定していません</h2>
					<p>回答結果から現在の共通候補を確認できます。</p>
					<Link
						className="button button-primary"
						to={`/events/${event.id}/results`}
					>
						回答結果を見る
					</Link>
				</div>
			</PageShell>
		);
	const start = new Date(event.confirmed_start_at as string);
	return (
		<PageShell>
			<div className="confirmed-hero">
				<div className="success-badge">
					<Icon name="check" size={32} />
				</div>
				<span className="page-eyebrow">DATE CONFIRMED!</span>
				<h1>日程が決まりました！</h1>
				<p>{event.title}</p>
			</div>
			<section className="confirmed-card">
				<span className="confirmed-label">確定した日時</span>
				<div className="confirmed-date">
					<div>
						<small>
							{new Intl.DateTimeFormat("en-US", {
								timeZone: user.time_zone,
								month: "short",
							})
								.format(start)
								.toUpperCase()}
						</small>
						<strong>
							{new Intl.DateTimeFormat("ja-JP", {
								timeZone: user.time_zone,
								day: "numeric",
							}).format(start)}
						</strong>
					</div>
					<span />
					<div>
						<b>
							<WeekendText>
								{new Intl.DateTimeFormat("ja-JP", {
									timeZone: user.time_zone,
									weekday: "long",
								}).format(start)}
							</WeekendText>
						</b>
						<strong>
							<WeekendText>
								{formatDateRange(
									event.confirmed_start_at as string,
									event.confirmed_end_at as string,
									user.time_zone,
								)
									.split(" ")
									.slice(-3)
									.join(" ")}
							</WeekendText>
						</strong>
					</div>
				</div>
				<div className="confirmed-details">
					<p>
						<Icon name="calendar" size={17} />{" "}
						<WeekendText>
							{formatDateRange(
								event.confirmed_start_at as string,
								event.confirmed_end_at as string,
								user.time_zone,
							)}
						</WeekendText>
					</p>
					<p>
						<Icon name="clock" size={17} /> 必要時間{" "}
						{minutesLabel(event.duration_minutes)}
					</p>
				</div>
				{event.description && (
					<div className="host-message">
						<div>
							<small>イベントについて</small>
							<p>{event.description}</p>
						</div>
					</div>
				)}
				<ParticipantList label="参加者" participants={participants} />
			</section>
			<div className="confirmed-actions">
				<CalendarSyncControls
					actionData={actionData}
					calendarStatus={calendarStatus}
					icloudCalendarStatus={icloudCalendarStatus}
					groupID={null}
					submittingGroupID={submittingGroupID}
				/>
				{canViewResults && (
					<Link
						className="button button-ghost"
						to={`/events/${event.id}/results`}
					>
						回答結果を見る
					</Link>
				)}
			</div>
			<TimeTreeGuideLink />
		</PageShell>
	);
}

function TimeTreeGuideLink() {
	return (
		<p className="timetree-confirmed-help">
			TimeTreeをお使いの方へ：
			<Link to="/account#timetree-guide">
				Google・iCloud経由で確定予定を表示する
			</Link>
		</p>
	);
}

function ParticipantList({
	label,
	participants,
}: {
	label: string;
	participants: Participant[];
}) {
	return (
		<div className="confirmed-participants">
			<strong>{label}</strong>
			{participants.length > 0 ? (
				<ul>
					{participants.map((participant) => (
						<li key={participant.id}>{participant.display_name}</li>
					))}
				</ul>
			) : (
				<p>参加者はいません。</p>
			)}
		</div>
	);
}

function useCalendarSyncControls(props: {
	calendarStatus: ConfirmationCalendarStatus;
	icloudCalendarStatus: ConfirmationCalendarStatus;
	groupID: string | null;
	submittingGroupID: string | null | undefined;
	actionData: Route.ComponentProps["actionData"];
}) {
	const navigation = useNavigation();
	const icloudSubmitting =
		navigation.formData?.get("intent") === "sync-icloud-calendar"
			? String(navigation.formData.get("group_id") ?? "") || null
			: undefined;

	return { props, icloudSubmitting };
}

function CalendarSyncControls(input: {
	calendarStatus: ConfirmationCalendarStatus;
	icloudCalendarStatus: ConfirmationCalendarStatus;
	groupID: string | null;
	submittingGroupID: string | null | undefined;
	actionData: Route.ComponentProps["actionData"];
}) {
	const { props, icloudSubmitting } = useCalendarSyncControls(input);

	if (
		props.calendarStatus.connection_status === "inactive" &&
		props.icloudCalendarStatus.connection_status === "inactive"
	)
		return (
			<p>
				予定の書き出し先を
				<Link to="/account#calendar-settings">カレンダー設定</Link>
				で選択してください。
			</p>
		);
	return (
		<div className="calendar-provider-controls">
			<CalendarSyncControl {...props} provider="google" />
			<CalendarSyncControl
				{...props}
				provider="icloud"
				calendarStatus={props.icloudCalendarStatus}
				submittingGroupID={icloudSubmitting}
			/>
		</div>
	);
}

function calendarSyncPresentation({
	provider,
	calendarStatus,
	groupID,
	submittingGroupID,
	actionData,
}: {
	provider: "google" | "icloud";
	calendarStatus: ConfirmationCalendarStatus;
	groupID: string | null;
	submittingGroupID: string | null | undefined;
	actionData: Route.ComponentProps["actionData"];
}) {
	const isICloud = provider === "icloud";
	const calendarLabel = isICloud ? "iCloudカレンダー" : "Googleカレンダー";
	const settingsPath = isICloud
		? "/account#calendar-settings"
		: "/account#calendar-settings";
	const sync = calendarStatus.syncs.find((item) => item.group_id === groupID);
	const isSubmitting = submittingGroupID === groupID;
	const isCurrentAction =
		actionData?.group_id === groupID && actionData?.provider === provider;
	const hasCurrentActionMessage = isCurrentAction && Boolean(actionData);

	return {
		calendarStatus,
		groupID,
		actionData,
		isICloud,
		calendarLabel,
		settingsPath,
		sync,
		isSubmitting,
		isCurrentAction,
		hasCurrentActionMessage,
	};
}

function CalendarSyncControl(props: {
	provider: "google" | "icloud";
	calendarStatus: ConfirmationCalendarStatus;
	groupID: string | null;
	submittingGroupID: string | null | undefined;
	actionData: Route.ComponentProps["actionData"];
}) {
	const {
		calendarStatus,
		groupID,
		actionData,
		isICloud,
		calendarLabel,
		settingsPath,
		sync,
		isSubmitting,
		isCurrentAction,
		hasCurrentActionMessage,
	} = calendarSyncPresentation(props);
	if (calendarStatus.connection_status === "inactive") return null;
	if (
		calendarStatus.connection_status === "not_connected" ||
		calendarStatus.connection_status === "write_permission_required"
	) {
		return (
			<div className="calendar-sync-panel needs-connection">
				<p>
					{calendarStatus.connection_status === "not_connected"
						? `${calendarLabel}を連携すると、専用カレンダー「Vacaro」にこの予定を追加できます。`
						: "専用カレンダー「Vacaro」への登録には、再接続して専用カレンダーの作成・管理を許可してください。"}
				</p>
				<Link className="button button-primary" to={settingsPath}>
					<Icon name="calendar" size={17} />
					{calendarStatus.connection_status === "not_connected"
						? `${calendarLabel}を連携`
						: "連携権限を更新"}
				</Link>
			</div>
		);
	}
	if (calendarStatus.connection_status !== "connected") {
		return (
			<div className="calendar-sync-panel error">
				<p>{calendarLabel}連携の状態を確認できませんでした。</p>
			</div>
		);
	}
	return (
		<div className="calendar-sync-panel">
			{sync?.status === "failed" && !hasCurrentActionMessage && (
				<p className="calendar-sync-message error">
					自動登録に失敗しました。下のボタンから再試行してください。
				</p>
			)}
			{sync?.status === "synced" && !hasCurrentActionMessage && (
				<p className="calendar-sync-message success">
					{isICloud ? "iCloudの" : ""}専用カレンダー「Vacaro」に追加済みです。
				</p>
			)}
			{isCurrentAction && actionData?.kind === "error" && (
				<p className="calendar-sync-message error">
					{actionData.error.message}
				</p>
			)}
			{isCurrentAction && actionData?.kind === "success" && (
				<p className="calendar-sync-message success">{actionData.message}</p>
			)}
			<Form method="post">
				<input
					name="intent"
					type="hidden"
					value={isICloud ? "sync-icloud-calendar" : "sync-calendar"}
				/>
				{groupID && <input name="group_id" type="hidden" value={groupID} />}
				<button
					className="button button-primary"
					disabled={isSubmitting}
					type="submit"
				>
					<Icon name="calendar" size={17} />
					{isSubmitting
						? "追加しています…"
						: sync?.status === "failed"
							? `${calendarLabel}への追加を再試行`
							: sync?.status === "synced"
								? `${calendarLabel}へ再登録`
								: `${calendarLabel}に追加`}
				</button>
			</Form>
		</div>
	);
}
