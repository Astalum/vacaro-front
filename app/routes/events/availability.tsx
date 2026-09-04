import { useState } from "react";
import { data, Form, Link, useNavigation } from "react-router";
import { Icon, PageShell } from "../../components/ui";
import {
	ApiError,
	apiErrorData,
	apiRequest,
	type AvailabilityInterval,
	type Event,
	formatDateRange,
	minutesLabel,
} from "../../lib/api";
import type { Route } from "./+types/availability";

type EditableInterval = {
	id: string;
	start: string;
	end: string;
};

export function meta({ loaderData }: Route.MetaArgs) {
	return [
		{
			title: loaderData
				? `参加可能時間を回答 — ${loaderData.event.title} | yotei`
				: "参加可能時間を回答 | yotei",
		},
	];
}

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
	const [event, availability] = await Promise.all([
		apiRequest<Event>(`/events/${params.eventId}`),
		apiRequest<{ response_status: string; intervals: AvailabilityInterval[] }>(
			`/events/${params.eventId}/my-availability`,
		),
	]);
	return { event, availability };
}
clientLoader.hydrate = true as const;

export async function clientAction({
	params,
	request,
}: Route.ClientActionArgs) {
	const formData = await request.formData();
	try {
		if (formData.get("intent") === "calendar-preview") {
			const result = await apiRequest<{ intervals: AvailabilityInterval[] }>(
				`/events/${params.eventId}/google-calendar-availability/preview`,
				{
					method: "POST",
					body: JSON.stringify({ calendar_ids: ["primary"] }),
				},
			);
			return { kind: "preview" as const, intervals: result.intervals };
		}
		const raw = formData.get("intervals");
		const editable =
			formData.get("intent") === "none"
				? []
				: (JSON.parse(
						typeof raw === "string" ? raw : "[]",
					) as EditableInterval[]);
		const intervals = editable.map((item) => ({
			start_at: new Date(item.start).toISOString(),
			end_at: new Date(item.end).toISOString(),
		}));
		const saved = await apiRequest<{
			response_status: string;
			intervals: AvailabilityInterval[];
		}>(`/events/${params.eventId}/my-availability`, {
			method: "PUT",
			body: JSON.stringify({ intervals }),
		});
		return { kind: "saved" as const, count: saved.intervals.length };
	} catch (error) {
		return data(
			{ kind: "error" as const, error: apiErrorData(error) },
			{ status: error instanceof ApiError ? error.status : 500 },
		);
	}
}

function localDateTime(value: string, timeZone: string) {
	const parts = new Intl.DateTimeFormat("en-CA", {
		timeZone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		hourCycle: "h23",
	}).formatToParts(new Date(value));
	const get = (type: Intl.DateTimeFormatPartTypes) =>
		parts.find((part) => part.type === type)?.value ?? "";
	return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

export function HydrateFallback() {
	return (
		<PageShell narrow>
			<div className="page-loading">回答内容を読み込んでいます…</div>
		</PageShell>
	);
}

export default function Availability({
	loaderData,
	actionData,
}: Route.ComponentProps) {
	const { event, availability } = loaderData;
	const navigation = useNavigation();
	const [intervals, setIntervals] = useState<EditableInterval[]>(() =>
		availability.intervals.map((interval) => ({
			id: interval.id ?? crypto.randomUUID(),
			start: localDateTime(interval.start_at, event.time_zone),
			end: localDateTime(interval.end_at, event.time_zone),
		})),
	);
	const add = () => {
		const start = new Date(event.window_start_at);
		const end = new Date(start.getTime() + event.duration_minutes * 60_000);
		setIntervals((current) => [
			...current,
			{
				id: crypto.randomUUID(),
				start: localDateTime(start.toISOString(), event.time_zone),
				end: localDateTime(end.toISOString(), event.time_zone),
			},
		]);
	};
	const remove = (id: string) =>
		setIntervals((current) => current.filter((interval) => interval.id !== id));
	const update = (
		id: string,
		field: keyof Omit<EditableInterval, "id">,
		value: string,
	) =>
		setIntervals((current) =>
			current.map((interval) =>
				interval.id === id ? { ...interval, [field]: value } : interval,
			),
		);
	const submitting = navigation.state === "submitting";
	const submittingIntent = navigation.formData?.get("intent");
	const applyPreview = () => {
		if (actionData?.kind !== "preview") return;
		setIntervals(
			actionData.intervals.map((interval) => ({
				id: crypto.randomUUID(),
				start: localDateTime(interval.start_at, event.time_zone),
				end: localDateTime(interval.end_at, event.time_zone),
			})),
		);
	};

	return (
		<PageShell narrow>
			<div className="share-page-head">
				<span className="page-eyebrow">YOUR AVAILABILITY</span>
				<div className="event-summary">
					<span className="status-pill">
						<i /> {event.status === "open" ? "回答受付中" : "受付終了"}
					</span>
					<h2>{event.title}</h2>
					{event.description && <p>{event.description}</p>}
					<div className="event-meta">
						<span>
							<Icon name="calendar" size={17} />{" "}
							{formatDateRange(
								event.window_start_at,
								event.window_end_at,
								event.time_zone,
							)}
						</span>
						<span>
							<Icon name="clock" size={17} /> 必要時間：
							{minutesLabel(event.duration_minutes)}
						</span>
					</div>
				</div>
			</div>
			{actionData?.kind === "saved" && (
				<div className="confirm-banner">
					<Icon name="check" />
					<div>
						<strong>参加可能時間を保存しました</strong>
						<span>{actionData.count}件の時間帯を登録しています。</span>
					</div>
					<Link to={`/events/${event.id}/results`}>
						共通候補を見る <Icon name="arrow" size={15} />
					</Link>
				</div>
			)}
			{actionData?.kind === "error" && (
				<div className="form-error">
					<Icon name="info" size={17} />
					<span>
						<strong>{actionData.error.message}</strong>
						{actionData.error.fields &&
							Object.values(actionData.error.fields).join(" / ")}
						{(actionData.error.code === "calendar_not_connected" ||
							actionData.error.code === "google_authentication_required" ||
							actionData.error.code === "permission_denied") && (
							<Link className="inline-error-link" to="/account">
								Googleアカウントとカレンダーを設定する
							</Link>
						)}
					</span>
				</div>
			)}
			<div className="availability-guide">
				<Icon name="sparkle" size={18} />
				<div>
					<strong>空いている時間を、そのまま教えてください</strong>
					<p>
						決められた候補から選ぶ必要はありません。調整期間の中で参加できる時間を登録できます。
					</p>
				</div>
			</div>
			<Form method="post">
				<input
					type="hidden"
					name="intervals"
					value={JSON.stringify(intervals)}
				/>
				<section className="respond-panel">
					<div className="panel-heading">
						<div>
							<span className="step-circle">1</span>
							<div>
								<h2>参加できる時間を入力</h2>
								<p>開始と終了を1組として、複数登録できます。</p>
							</div>
						</div>
						<button
							className="button button-ghost calendar-import-button"
							type="submit"
							name="intent"
							value="calendar-preview"
							disabled={submitting}
						>
							<span className="google-mark" aria-hidden="true">
								G
							</span>
							{submittingIntent === "calendar-preview"
								? "確認しています…"
								: "カレンダーから取込"}
						</button>
					</div>
					{actionData?.kind === "preview" && (
						<div className="calendar-preview">
							<div>
								<strong>
									{actionData.intervals.length}件の空き時間が見つかりました
								</strong>
								<p>
									現在の入力をこのプレビューで置き換えます。反映後に自由に編集できます。
								</p>
							</div>
							<button
								className="button button-primary button-small"
								type="button"
								onClick={applyPreview}
							>
								入力に反映
							</button>
						</div>
					)}
					<div className="interval-list">
						{intervals.map((interval, index) => (
							<div className="interval-row" key={interval.id}>
								<span className="candidate-number">{index + 1}</span>
								<div className="field">
									<label htmlFor={`start-${interval.id}`}>開始日時</label>
									<input
										id={`start-${interval.id}`}
										type="datetime-local"
										value={interval.start}
										onChange={(e) =>
											update(interval.id, "start", e.target.value)
										}
									/>
								</div>
								<span className="time-divider">〜</span>
								<div className="field">
									<label htmlFor={`end-${interval.id}`}>終了日時</label>
									<input
										id={`end-${interval.id}`}
										type="datetime-local"
										value={interval.end}
										onChange={(e) => update(interval.id, "end", e.target.value)}
									/>
								</div>
								<button
									className="icon-button danger"
									type="button"
									aria-label="時間帯を削除"
									onClick={() => remove(interval.id)}
								>
									<Icon name="trash" size={18} />
								</button>
							</div>
						))}
					</div>
					<button className="add-row-button" type="button" onClick={add}>
						<Icon name="plus" size={18} /> 参加できる時間を追加
					</button>
				</section>
				<div className="availability-actions">
					<button
						className="button button-ghost"
						type="submit"
						name="intent"
						value="none"
						disabled={submitting}
					>
						参加できる時間はない
					</button>
					<button
						className="button button-primary button-large"
						type="submit"
						name="intent"
						value="save"
						disabled={submitting || event.status !== "open"}
					>
						{submittingIntent === "save"
							? "保存しています…"
							: availability.response_status === "submitted"
								? "回答を更新する"
								: "この内容で回答する"}
						<Icon name="arrow" size={18} />
					</button>
				</div>
			</Form>
		</PageShell>
	);
}
