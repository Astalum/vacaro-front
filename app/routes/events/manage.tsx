import { data, Form, Link, redirect, useNavigation } from "react-router";
import {
	Icon,
	InviteUrlReissue,
	PageShell,
	PersistentInviteUrl,
	WeekendText,
} from "../../components/ui";
import {
	ApiError,
	apiErrorData,
	apiRequest,
	type Event,
	eventDisplayStatus,
	formatDateRange,
	minutesLabel,
	type Participant,
	reissueEventInviteUrl,
	type SchedulingGroup,
	savedEventInviteUrl,
} from "../../lib/api";
import type { Route } from "./+types/manage";

export function meta({ loaderData }: Route.MetaArgs) {
	return [
		{
			title: loaderData
				? `イベント管理 — ${loaderData.event.title} | vacaro`
				: "イベント管理 | vacaro",
		},
	];
}

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
	const [event, participants] = await Promise.all([
		apiRequest<Event>(`/events/${params.eventId}`),
		apiRequest<Participant[]>(`/events/${params.eventId}/participants`),
	]);
	const groups =
		event.scheduling_mode === "groups"
			? await apiRequest<SchedulingGroup[]>(`/events/${event.id}/groups`)
			: [];
	const inviteUrl = savedEventInviteUrl(event.id);
	return { event, participants, groups, inviteUrl };
}
clientLoader.hydrate = true as const;

export async function clientAction({
	params,
	request,
}: Route.ClientActionArgs) {
	const formData = await request.formData();
	const intent = String(formData.get("intent") ?? "");
	const groupID = String(formData.get("group_id") ?? "");
	const createGroup = () =>
		apiRequest<SchedulingGroup>(`/events/${params.eventId}/groups`, {
			method: "POST",
			body: JSON.stringify({
				name: String(formData.get("name") ?? "").trim(),
				duration_minutes: Number(formData.get("duration_minutes")),
				participant_ids: formData.getAll("participant_ids").map(String),
			}),
		});
	try {
		switch (intent) {
			case "reissue-invite-url": {
				const inviteUrl = await reissueEventInviteUrl(params.eventId);
				return { success: "招待URLを再発行しました", inviteUrl };
			}
			case "create-first-group":
				await apiRequest<Event>(`/events/${params.eventId}`, {
					method: "PATCH",
					body: JSON.stringify({ scheduling_mode: "groups" }),
				});
				await createGroup();
				return { success: "小グループを作成しました" };
			case "create-group":
				await createGroup();
				return { success: "小グループを作成しました" };
			case "save-group":
				await apiRequest<SchedulingGroup>(
					`/events/${params.eventId}/groups/${groupID}`,
					{
						method: "PATCH",
						body: JSON.stringify({
							name: String(formData.get("name") ?? ""),
							duration_minutes: Number(formData.get("duration_minutes")),
						}),
					},
				);
				await apiRequest<SchedulingGroup>(
					`/events/${params.eventId}/groups/${groupID}/members`,
					{
						method: "PUT",
						body: JSON.stringify({
							participant_ids: formData.getAll("participant_ids").map(String),
						}),
					},
				);
				return { success: "グループ設定を保存しました" };
			case "delete-group":
				await apiRequest<void>(`/events/${params.eventId}/groups/${groupID}`, {
					method: "DELETE",
				});
				return { success: "小グループを削除しました" };
			case "cancel-event":
				await apiRequest<void>(`/events/${params.eventId}`, {
					method: "DELETE",
				});
				return redirect("/events");
			default:
				return data(
					{
						error: {
							code: "invalid_intent",
							message: "操作を確認してください",
						},
					},
					{ status: 400 },
				);
		}
	} catch (error) {
		const errorData = apiErrorData(error);
		return data(
			{ error: errorData },
			{ status: error instanceof ApiError ? error.status : 500 },
		);
	}
}

export function HydrateFallback() {
	return (
		<PageShell showPersistentInviteUrl={false}>
			<div className="page-loading">イベント設定を読み込んでいます…</div>
		</PageShell>
	);
}

function GroupCreationForm({
	event,
	participants,
	busy,
	firstGroup = false,
}: {
	event: Event;
	participants: Participant[];
	busy: boolean;
	firstGroup?: boolean;
}) {
	return (
		<Form
			method="post"
			className={`group-create-form ${firstGroup ? "first-group-create-form" : ""}`}
		>
			<div className="group-create-fields">
				<label>
					<span>グループ名</span>
					<input
						name="name"
						placeholder="例：デザインチーム"
						required
						maxLength={100}
					/>
				</label>
				<label>
					<span>必要時間</span>
					<span className="duration-input">
						<input
							name="duration_minutes"
							type="number"
							min={5}
							max={1440}
							step={5}
							defaultValue={event.duration_minutes}
							required
							aria-label="必要時間（分）"
						/>
						<small>分</small>
					</span>
				</label>
			</div>
			{participants.length > 0 && (
				<fieldset className="group-create-members">
					<legend>最初のメンバー</legend>
					<p>メンバーは作成後も追加・変更できます。</p>
					<div className="group-member-list">
						{participants.map((participant) => (
							<label key={participant.id}>
								<input
									type="checkbox"
									name="participant_ids"
									value={participant.id}
								/>
								<span className="avatar mint">
									{participant.display_name.slice(0, 1)}
								</span>
								<strong>{participant.display_name}</strong>
								<small>
									{participant.response_status === "submitted"
										? "回答済み"
										: "未回答"}
								</small>
							</label>
						))}
					</div>
				</fieldset>
			)}
			<div className="group-create-actions">
				<button
					className="button button-primary"
					type="submit"
					name="intent"
					value={firstGroup ? "create-first-group" : "create-group"}
					disabled={busy || event.status !== "open"}
				>
					<Icon name="plus" size={16} />
					グループを作成
				</button>
			</div>
		</Form>
	);
}

export default function ManageEvent({
	loaderData,
	actionData,
}: Route.ComponentProps) {
	const { event, participants, groups, inviteUrl } = loaderData;
	const navigation = useNavigation();
	const busy = navigation.state === "submitting";
	const reissuingInviteUrl =
		busy && navigation.formData?.get("intent") === "reissue-invite-url";
	const currentInviteUrl =
		actionData && "inviteUrl" in actionData ? actionData.inviteUrl : inviteUrl;
	const submittedParticipants = participants.filter(
		(participant) => participant.response_status === "submitted",
	).length;
	const groupsMode = event.scheduling_mode === "groups";
	const displayStatus = eventDisplayStatus(event);

	return (
		<PageShell showPersistentInviteUrl={false}>
			<div className="manage-heading">
				<div>
					<Link className="back-link" to="/events">
						<Icon name="back" size={17} /> イベント一覧へ
					</Link>
					<div className="manage-title">
						<span className={`status-pill status-${displayStatus}`}>
							<i />{" "}
							{displayStatus === "open"
								? "回答受付中"
								: displayStatus === "confirmed"
									? "日程確定"
									: displayStatus === "expired"
										? "回答期限超過"
										: "取消済み"}
						</span>
						<h1>{event.title}</h1>
					</div>
					<p>
						<WeekendText>
							{formatDateRange(
								event.window_start_at,
								event.window_end_at,
								event.time_zone,
							)}
						</WeekendText>
					</p>
				</div>
				<div className="manage-actions">
					<Link className="button button-ghost" to={`/events/${event.id}/edit`}>
						<Icon name="edit" size={17} /> 編集
					</Link>
				</div>
			</div>

			{actionData && "error" in actionData && (
				<div className="form-error">
					<Icon name="info" size={17} />
					<span>
						<strong>{actionData.error.message}</strong>
					</span>
				</div>
			)}
			{actionData && "success" in actionData && (
				<div className="confirm-banner compact-banner">
					<Icon name="check" size={18} />
					<strong>{actionData.success}</strong>
				</div>
			)}

			<div className="stats-row">
				<article>
					<span className="stat-icon coral">
						<Icon name="users" />
					</span>
					<div>
						<small>参加者</small>
						<b>{participants.length}</b>
					</div>
				</article>
				<article>
					<span className="stat-icon mint">
						<Icon name="clock" />
					</span>
					<div>
						<small>標準の必要時間</small>
						<b>{minutesLabel(event.duration_minutes)}</b>
					</div>
				</article>
				<article>
					<span className="stat-icon yellow">
						<Icon name="users" />
					</span>
					<div>
						<small>グループ</small>
						<b>{groups.length + 1}</b>
					</div>
				</article>
			</div>

			{groupsMode ? (
				<section className="group-management">
					<header className="group-management-heading">
						<div>
							<span className="page-eyebrow">SMALL GROUPS</span>
							<h2>グループを管理</h2>
							<p>全参加者の「全体」に加えて、小グループを追加できます。</p>
						</div>
					</header>
					<GroupCreationForm
						event={event}
						participants={participants}
						busy={busy}
					/>

					<div className="group-card-grid">
						<article className="group-card whole-group-card">
							<header>
								<div>
									<span
										className={`group-state ${event.confirmed_start_at ? "confirmed" : "open"}`}
									>
										{event.confirmed_start_at ? "日程確定" : "調整中"}
									</span>
									<strong>全体</strong>
									<small>
										{submittedParticipants} / {participants.length}人回答
									</small>
								</div>
								<Link to={`/events/${event.id}/results?scope=whole`}>
									日程を調整 <Icon name="arrow" size={15} />
								</Link>
							</header>
							<div className="whole-group-summary">
								<span>
									<Icon name="users" size={16} /> 全参加者
								</span>
								<span>
									<Icon name="clock" size={16} />{" "}
									{minutesLabel(event.duration_minutes)}
								</span>
							</div>
						</article>
						{groups.map((group) => {
							const confirmed = Boolean(group.confirmed_start_at);
							const memberIDs = new Set(
								group.members.map((member) => member.id),
							);
							return (
								<article className="group-card" key={group.id}>
									<header>
										<div>
											<span
												className={`group-state ${confirmed ? "confirmed" : "open"}`}
											>
												{confirmed ? "日程確定" : "調整中"}
											</span>
											<strong>{group.name}</strong>
											<small>
												{
													group.members.filter(
														(member) => member.response_status === "submitted",
													).length
												}{" "}
												/ {group.members.length}人回答
											</small>
										</div>
										<Link
											to={`/events/${event.id}/results?group_id=${group.id}`}
										>
											日程を調整 <Icon name="arrow" size={15} />
										</Link>
									</header>
									<Form method="post" className="group-edit-form">
										<input type="hidden" name="group_id" value={group.id} />
										<div className="group-fields">
											<label>
												<span>グループ名</span>
												<input
													name="name"
													defaultValue={group.name}
													maxLength={100}
													required
												/>
											</label>
											<label>
												<span>必要時間（分）</span>
												<input
													name="duration_minutes"
													type="number"
													min={5}
													max={1440}
													step={5}
													defaultValue={group.duration_minutes}
													disabled={confirmed}
													required
												/>
											</label>
										</div>
										<fieldset disabled={confirmed || event.status !== "open"}>
											<legend>メンバー（{group.members.length}人）</legend>
											<div className="group-member-list">
												{participants.map((participant) => (
													<label key={participant.id}>
														<input
															type="checkbox"
															name="participant_ids"
															value={participant.id}
															defaultChecked={memberIDs.has(participant.id)}
														/>
														<span className="avatar navy">
															{participant.display_name.slice(0, 1)}
														</span>
														<strong>{participant.display_name}</strong>
														<small>
															{participant.response_status === "submitted"
																? "回答済み"
																: "未回答"}
														</small>
													</label>
												))}
											</div>
										</fieldset>
										<button
											className="button button-primary"
											type="submit"
											name="intent"
											value="save-group"
											disabled={busy || confirmed || event.status !== "open"}
										>
											変更を保存
										</button>
									</Form>
									<Form
										method="post"
										className="group-delete-form"
										onSubmit={(submitEvent) => {
											if (
												!window.confirm(`「${group.name}」を削除しますか？`)
											) {
												submitEvent.preventDefault();
											}
										}}
									>
										<input type="hidden" name="group_id" value={group.id} />
										<button
											type="submit"
											name="intent"
											value="delete-group"
											disabled={busy || confirmed || event.status !== "open"}
										>
											<Icon name="trash" size={15} /> グループを削除
										</button>
									</Form>
									{confirmed && (
										<p className="group-locked-note">
											<Icon name="lock" size={14} />{" "}
											確定解除後に編成を変更できます。
										</p>
									)}
								</article>
							);
						})}
					</div>
				</section>
			) : (
				<section className="whole-event-management group-onboarding">
					<header>
						<span className="stat-icon mint">
							<Icon name="users" />
						</span>
						<div>
							<span className="page-eyebrow">SMALL GROUPS</span>
							<h2>グループを追加</h2>
							<p>
								「全体」はそのまま利用でき、必要に応じて小グループを追加できます。
							</p>
						</div>
						<Link
							className="whole-event-results-link"
							to={`/events/${event.id}/results`}
						>
							全体の結果を見る <Icon name="arrow" size={14} />
						</Link>
					</header>
					<GroupCreationForm
						event={event}
						participants={participants}
						busy={busy}
						firstGroup
					/>
				</section>
			)}

			<section className="manage-invite-section">
				<div className="manage-invite-heading">
					<div>
						<span className="page-eyebrow">INVITATION</span>
						<h2>参加者を招待</h2>
					</div>
					<p>このURLを参加者へ共有してください。</p>
				</div>
				{currentInviteUrl && (
					<PersistentInviteUrl inviteUrl={currentInviteUrl} />
				)}
				<InviteUrlReissue
					hasInviteUrl={Boolean(currentInviteUrl)}
					canReissue={event.status === "open"}
					busy={reissuingInviteUrl}
				/>
			</section>

			<Form
				method="post"
				className="event-danger-zone"
				onSubmit={(submitEvent) => {
					if (!window.confirm("このイベントを取り消しますか？")) {
						submitEvent.preventDefault();
					}
				}}
			>
				<div>
					<strong>イベントを削除</strong>
					<span>参加者は回答や結果を変更できなくなります。</span>
				</div>
				<button
					type="submit"
					name="intent"
					value="cancel-event"
					disabled={busy || event.status === "cancelled"}
				>
					イベントを削除
				</button>
			</Form>
		</PageShell>
	);
}
