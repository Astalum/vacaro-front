import { data, Form, Link, redirect, useNavigation } from "react-router";
import { Icon, PageIntro, PageShell } from "../../components/ui";
import {
	ApiError,
	apiErrorData,
	apiRequest,
	type Event,
	localDateTimeToIso,
} from "../../lib/api";
import type { Route } from "./+types/edit";

export function meta({ loaderData }: Route.MetaArgs) {
	return [
		{
			title: loaderData
				? `編集 — ${loaderData.title} | yotei`
				: "イベントを編集 | yotei",
		},
	];
}
export async function clientLoader({ params }: Route.ClientLoaderArgs) {
	return apiRequest<Event>(`/events/${params.eventId}`);
}
clientLoader.hydrate = true as const;
export async function clientAction({
	params,
	request,
}: Route.ClientActionArgs) {
	const formData = await request.formData();
	try {
		await apiRequest<Event>(`/events/${params.eventId}`, {
			method: "PATCH",
			body: JSON.stringify({
				title: String(formData.get("title") ?? ""),
				description: String(formData.get("description") ?? "") || null,
				time_zone: String(formData.get("time_zone") ?? "Asia/Tokyo"),
				window_start_at: localDateTimeToIso(formData.get("window_start_at")),
				window_end_at: localDateTimeToIso(formData.get("window_end_at")),
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
		<PageShell narrow>
			<div className="page-loading">イベントを読み込んでいます…</div>
		</PageShell>
	);
}

export default function EditEvent({
	loaderData: event,
	actionData,
}: Route.ComponentProps) {
	const navigation = useNavigation();
	const saving = navigation.state === "submitting";
	return (
		<PageShell narrow>
			<PageIntro
				eyebrow="EDIT EVENT"
				title="イベントを編集"
				description="変更内容は参加者の回答可能範囲にも影響します。"
				backTo={`/events/${event.id}/manage`}
				backLabel="管理画面へ戻る"
			/>
			<Form className="form-stack" method="post">
				{actionData?.error && (
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
							<label htmlFor="edit-timezone">タイムゾーン</label>
							<select
								id="edit-timezone"
								name="time_zone"
								defaultValue={event.time_zone}
							>
								<option value="Asia/Tokyo">日本時間（Asia/Tokyo）</option>
							</select>
						</div>
						<div className="field">
							<label htmlFor="edit-deadline">回答期限</label>
							<input
								id="edit-deadline"
								name="response_deadline_at"
								type="datetime-local"
								defaultValue={inputDateTime(event.response_deadline_at)}
							/>
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
							<label htmlFor="edit-window-start">期間の開始</label>
							<input
								id="edit-window-start"
								name="window_start_at"
								type="datetime-local"
								defaultValue={inputDateTime(event.window_start_at)}
							/>
						</div>
						<span className="window-arrow">→</span>
						<div className="field">
							<label htmlFor="edit-window-end">期間の終了</label>
							<input
								id="edit-window-end"
								name="window_end_at"
								type="datetime-local"
								defaultValue={inputDateTime(event.window_end_at)}
							/>
						</div>
					</div>
					<div className="field">
						<label htmlFor="edit-duration">イベントに必要な時間</label>
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
					<div className="change-warning">
						<Icon name="info" size={17} />
						<span>
							<strong>調整期間を変更するときはご注意ください</strong>
							登録済みの参加可能時間を除外する変更はAPIによって拒否されます。
						</span>
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
		</PageShell>
	);
}
