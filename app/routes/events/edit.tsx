import { data, Form, Link, redirect, useNavigation } from "react-router";
import {
	Icon,
	InviteUrlReissue,
	PageIntro,
	PageShell,
	PersistentInviteUrl,
} from "../../components/ui";
import { DateTimePicker } from "../../components/ui/date-time-picker";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "../../components/ui/select";
import {
	ApiError,
	apiErrorData,
	apiRequest,
	type Event,
	localDateTimeToIso,
	reissueEventInviteUrl,
	savedEventInviteUrl,
} from "../../lib/api";
import { isTimeValue, TIME_INPUT_STEP_SECONDS } from "../../lib/time";
import type { Route } from "./+types/edit";

export function meta({ loaderData }: Route.MetaArgs) {
	return [
		{
			title: loaderData
				? `編集 — ${loaderData.event.title} | vacaro`
				: "イベントを編集 | vacaro",
		},
	];
}
export async function clientLoader({ params }: Route.ClientLoaderArgs) {
	const event = await apiRequest<Event>(`/events/${params.eventId}`);
	const inviteUrl = savedEventInviteUrl(event.id);
	return { event, inviteUrl };
}
clientLoader.hydrate = true as const;
export async function clientAction({
	params,
	request,
}: Route.ClientActionArgs) {
	const formData = await request.formData();
	const intent = String(formData.get("intent") ?? "");
	if (intent === "reissue-invite-url") {
		try {
			const inviteUrl = await reissueEventInviteUrl(params.eventId);
			return { success: "招待URLを再発行しました", inviteUrl };
		} catch (error) {
			return data(
				{ error: apiErrorData(error) },
				{ status: error instanceof ApiError ? error.status : 500 },
			);
		}
	}
	const windowStartDate = String(formData.get("window_start_date") ?? "");
	const windowEndDate = String(formData.get("window_end_date") ?? "");
	const dailyStartTime = String(formData.get("daily_start_time") ?? "");
	const dailyEndTime = String(formData.get("daily_end_time") ?? "");
	if (
		!windowStartDate ||
		!windowEndDate ||
		windowStartDate > windowEndDate ||
		!isTimeValue(dailyStartTime) ||
		!isTimeValue(dailyEndTime) ||
		dailyStartTime >= dailyEndTime
	) {
		return data(
			{
				error: {
					code: "validation_failed",
					message: "回答を集める期間と時間帯を確認してください",
					fields: null,
				},
			},
			{ status: 422 },
		);
	}
	const windowStartAt = `${windowStartDate}T${dailyStartTime}`;
	const windowEndAt = `${windowEndDate}T${dailyEndTime}`;
	try {
		await apiRequest<Event>(`/events/${params.eventId}`, {
			method: "PATCH",
			body: JSON.stringify({
				title: String(formData.get("title") ?? ""),
				description: String(formData.get("description") ?? "") || null,
				time_zone: String(formData.get("time_zone") ?? "Asia/Tokyo"),
				window_start_at: localDateTimeToIso(windowStartAt),
				window_end_at: localDateTimeToIso(windowEndAt),
				duration_minutes: Number(formData.get("duration_minutes")),
				response_deadline_at: localDateTimeToIso(
					formData.get("response_deadline_at"),
				),
			}),
		});
		return redirect(`/events/${params.eventId}/manage`);
	} catch (error) {
		return data(
			{ error: apiErrorData(error) },
			{ status: error instanceof ApiError ? error.status : 500 },
		);
	}
}

function inputDateTime(value: string | null) {
	if (!value) return "";
	const date = new Date(value);
	const parts = new Intl.DateTimeFormat("en-CA", {
		timeZone: "Asia/Tokyo",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		hourCycle: "h23",
	}).formatToParts(date);
	const get = (type: Intl.DateTimeFormatPartTypes) =>
		parts.find((part) => part.type === type)?.value ?? "";
	return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

export function HydrateFallback() {
	return (
		<PageShell>
			<div className="page-loading">イベントを読み込んでいます…</div>
		</PageShell>
	);
}

export default function EditEvent({
	loaderData: { event, inviteUrl },
	actionData,
}: Route.ComponentProps) {
	const navigation = useNavigation();
	const saving = navigation.state === "submitting";
	const reissuingInviteUrl =
		saving && navigation.formData?.get("intent") === "reissue-invite-url";
	const currentInviteUrl =
		actionData && "inviteUrl" in actionData ? actionData.inviteUrl : inviteUrl;
	return (
		<PageShell showPersistentInviteUrl={false}>
			<PageIntro
				eyebrow="EDIT EVENT"
				title="イベントを編集"
				description="変更内容は参加者の回答可能範囲にも影響します。"
				backTo={`/events/${event.id}/manage`}
				backLabel="管理画面へ戻る"
			/>
			<div className="change-warning">
				<Icon name="info" size={17} />
				<span>
					<strong>調整期間を変更するときはご注意ください</strong>
					登録済みの参加可能時間を除外する変更はAPIによって拒否されます。
				</span>
			</div>
			{actionData && "success" in actionData && (
				<div className="confirm-banner compact-banner">
					<Icon name="check" size={18} />
					<strong>{actionData.success}</strong>
				</div>
			)}
			<Form className="form-stack" method="post">
				{actionData && "error" in actionData && (
					<div className="form-error">
						<Icon name="info" size={17} />
						<span>
							<strong>{actionData.error.message}</strong>
							{actionData.error.fields &&
								Object.values(actionData.error.fields).join(" / ")}
						</span>
					</div>
				)}
				<section className="form-section compact-section">
					<div className="field">
						<label htmlFor="edit-title">
							イベント名 <em>必須</em>
						</label>
						<input
							id="edit-title"
							name="title"
							defaultValue={event.title}
							required
						/>
					</div>
					<div className="field">
						<label htmlFor="edit-description">
							説明 <small>任意</small>
						</label>
						<textarea
							id="edit-description"
							name="description"
							rows={4}
							defaultValue={event.description ?? ""}
						/>
					</div>
					<div className="two-cols">
						<div className="field">
							<label htmlFor="edit-deadline">回答期限</label>
							<DateTimePicker
								id="edit-deadline"
								name="response_deadline_at"
								defaultValue={inputDateTime(event.response_deadline_at)}
							/>
						</div>
						<div className="field">
							<label htmlFor="edit-timezone">タイムゾーン</label>
							<Select name="time_zone" defaultValue={event.time_zone}>
								<SelectTrigger id="edit-timezone">
									<SelectValue placeholder="タイムゾーンを選択" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="Asia/Tokyo">
										日本時間（Asia/Tokyo）
									</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>
				</section>
				<section className="form-section">
					<div className="form-section-title">
						<span>02</span>
						<div>
							<h2>調整条件</h2>
							<p>回答済みの時間を範囲外にする変更は保存できません。</p>
						</div>
					</div>
					<div className="window-fields">
						<div className="field">
							<label htmlFor="edit-window-start-date">開始日</label>
							<input
								id="edit-window-start-date"
								name="window_start_date"
								type="date"
								defaultValue={inputDateTime(event.window_start_at).slice(0, 10)}
								required
							/>
						</div>
						<span className="window-arrow">→</span>
						<div className="field">
							<label htmlFor="edit-window-end-date">終了日</label>
							<input
								id="edit-window-end-date"
								name="window_end_date"
								type="date"
								defaultValue={inputDateTime(event.window_end_at).slice(0, 10)}
								required
							/>
						</div>
					</div>
					<div className="daily-window-settings">
						<div>
							<strong>毎日の回答受付時間</strong>
							<p>参加者は各日、この時間帯の中で回答できます。</p>
						</div>
						<div className="daily-window-fields">
							<div className="field">
								<label htmlFor="edit-daily-start-time">受付開始</label>
								<input
									id="edit-daily-start-time"
									name="daily_start_time"
									type="time"
									step={TIME_INPUT_STEP_SECONDS}
									defaultValue={inputDateTime(event.window_start_at).slice(
										11,
										16,
									)}
									required
								/>
							</div>
							<span>〜</span>
							<div className="field">
								<label htmlFor="edit-daily-end-time">受付終了</label>
								<input
									id="edit-daily-end-time"
									name="daily_end_time"
									type="time"
									step={TIME_INPUT_STEP_SECONDS}
									defaultValue={inputDateTime(event.window_end_at).slice(
										11,
										16,
									)}
									required
								/>
							</div>
						</div>
					</div>
					<div className="field">
						<label htmlFor="edit-duration">イベントに必要な時間（分）</label>
						<input
							id="edit-duration"
							name="duration_minutes"
							type="number"
							min={5}
							max={1440}
							step={5}
							defaultValue={event.duration_minutes}
						/>
					</div>
				</section>
				<div className="form-actions horizontal">
					<Link
						className="button button-ghost"
						to={`/events/${event.id}/manage`}
					>
						キャンセル
					</Link>
					<button
						className="button button-primary"
						type="submit"
						disabled={saving}
					>
						{saving ? "保存しています…" : "変更を保存する"}
					</button>
				</div>
			</Form>
			<section className="form-section edit-invite-section">
				<div className="form-section-title">
					<span>URL</span>
					<div>
						<h2>参加者用の招待URL</h2>
						<p>共有済みURLの再発行は、必要な場合だけ行ってください。</p>
					</div>
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
		</PageShell>
	);
}
