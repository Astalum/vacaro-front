import { useCallback, useEffect, useRef, useState } from "react";
import { data, Link, useFetcher } from "react-router";
import { Icon, PageIntro, PageShell, WeekendText } from "~/components/app";
import {
	ApiError,
	apiErrorData,
	apiRequest,
	apiRequestWithMeta,
	type Event,
	eventDisplayStatus,
	formatDateTime,
	minutesLabel,
	type User,
} from "~/lib/api";
import type { Route } from "./+types/index";

export function meta() {
	return [{ title: "イベント一覧 | vacaro" }];
}
type EventsPageMeta = { next_cursor: string | null };

export async function clientLoader({ request }: Route.ClientLoaderArgs) {
	const cursor = new URL(request.url).searchParams.get("cursor");
	const query = new URLSearchParams({ limit: "20" });
	if (cursor) query.set("cursor", cursor);
	const userPromise = apiRequest<User>("/me");
	try {
		const [page, user] = await Promise.all([
			apiRequestWithMeta<Event[], EventsPageMeta>(`/events?${query}`),
			userPromise,
		]);
		return {
			events: page.data,
			currentUserId: user.id,
			nextCursor: page.meta?.next_cursor ?? null,
			requestedCursor: cursor,
			error: null,
		};
	} catch (error) {
		if (!cursor) throw error;
		const user = await userPromise;
		return {
			events: [] as Event[],
			currentUserId: user.id,
			nextCursor: null,
			requestedCursor: cursor,
			error: apiErrorData(error),
		};
	}
}
clientLoader.hydrate = true as const;

export async function clientAction({ request }: Route.ClientActionArgs) {
	const formData = await request.formData();
	const eventID = String(formData.get("event_id") ?? "");
	if (formData.get("intent") !== "leave-event" || !eventID) {
		return data(
			{ error: { code: "invalid_intent", message: "操作を確認してください" } },
			{ status: 400 },
		);
	}
	try {
		await apiRequest<void>(`/events/${eventID}/participants/me`, {
			method: "DELETE",
		});
		return { leftEventId: eventID };
	} catch (error) {
		return data(
			{ error: apiErrorData(error) },
			{ status: error instanceof ApiError ? error.status : 500 },
		);
	}
}

export function HydrateFallback() {
	return (
		<PageShell>
			<div className="page-loading">イベントを読み込んでいます…</div>
		</PageShell>
	);
}

export function EventList({
	events,
	currentUserId,
	onEventLeft,
}: {
	events: Event[];
	currentUserId: string;
	onEventLeft?: (eventID: string) => void;
}) {
	return (
		<div className="event-list">
			{events.map((event) => (
				<EventListItem
					key={event.id}
					event={event}
					currentUserId={currentUserId}
					onEventLeft={onEventLeft}
				/>
			))}
		</div>
	);
}

function EventListItem({
	event,
	currentUserId,
	onEventLeft,
}: {
	event: Event;
	currentUserId: string;
	onEventLeft?: (eventID: string) => void;
}) {
	const leaveFetcher = useFetcher<typeof clientAction>();
	const displayStatus = eventDisplayStatus(event);
	const canManage = event.created_by_user_id === currentUserId;
	const canViewResults = canManage || event.results_visible_to_participants;
	const leaving = leaveFetcher.state !== "idle";
	const leftEventID =
		leaveFetcher.data && "leftEventId" in leaveFetcher.data
			? leaveFetcher.data.leftEventId
			: null;
	useEffect(() => {
		if (leftEventID) onEventLeft?.(leftEventID);
	}, [leftEventID, onEventLeft]);
	if (leftEventID) return null;
	return (
		<article>
			<div className="event-list-body">
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
				<h2>{event.title}</h2>
				<div className="event-list-meta">
					<div className="event-list-period">
						<Icon name="calendar" size={15} />
						<span className="event-list-period-text">
							<span>
								<WeekendText>
									{formatDateTime(event.window_start_at, event.time_zone)}
								</WeekendText>
							</span>
							<span className="event-list-period-end">
								<span>〜</span>
								<WeekendText>
									{formatDateTime(event.window_end_at, event.time_zone)}
								</WeekendText>
							</span>
						</span>
					</div>
					<div className="event-list-duration">
						<Icon name="clock" size={15} />
						{minutesLabel(event.duration_minutes)}
					</div>
				</div>
			</div>
			<div className="event-list-actions">
				{displayStatus === "open" && (
					<Link
						className="button button-primary"
						to={`/events/${event.id}/availability`}
					>
						<span className="event-action-label-full">回答ページへ</span>
						<span className="event-action-label-compact">回答</span>
						<Icon name="arrow" size={15} />
					</Link>
				)}
				{displayStatus === "confirmed" && (
					<Link
						className="button button-primary"
						to={`/events/${event.id}/confirmed`}
					>
						<span className="event-action-label-full">確定日時を見る</span>
						<span className="event-action-label-compact">確定日時</span>
						<Icon name="calendar" size={15} />
					</Link>
				)}
				{canViewResults && (
					<Link
						className="button button-ghost"
						to={`/events/${event.id}/results`}
					>
						<span className="event-action-label-full">回答結果を見る</span>
						<span className="event-action-label-compact">結果</span>
						<Icon name="chart" size={15} />
					</Link>
				)}
				{canManage && (
					<Link
						className="button button-ghost"
						to={`/events/${event.id}/manage`}
					>
						<span className="event-action-label-full">管理画面へ</span>
						<span className="event-action-label-compact">管理</span>
						<Icon name="users" size={15} />
					</Link>
				)}
				{!canManage && (
					<leaveFetcher.Form
						method="post"
						className="event-leave-form"
						onSubmit={(submitEvent) => {
							if (
								!window.confirm(
									`「${event.title}」から退出しますか？回答内容も削除されます。`,
								)
							) {
								submitEvent.preventDefault();
							}
						}}
					>
						<input type="hidden" name="event_id" value={event.id} />
						<button
							type="submit"
							name="intent"
							value="leave-event"
							disabled={leaving}
						>
							<span className="event-action-label-full">
								{leaving ? "退出しています…" : "イベントから退出"}
							</span>
							<span className="event-action-label-compact">
								{leaving ? "退出中" : "退出"}
							</span>
						</button>
					</leaveFetcher.Form>
				)}
				{leaveFetcher.data && "error" in leaveFetcher.data && (
					<small className="event-leave-error">
						{leaveFetcher.data.error.message}
					</small>
				)}
			</div>
		</article>
	);
}

export default function EventsIndex({ loaderData }: Route.ComponentProps) {
	const { currentUserId } = loaderData;
	const fetcher = useFetcher<typeof clientLoader>();
	const [events, setEvents] = useState(loaderData.events);
	const [nextCursor, setNextCursor] = useState(loaderData.nextCursor);
	const removeEvent = useCallback(
		(eventID: string) =>
			setEvents((current) => current.filter((event) => event.id !== eventID)),
		[],
	);
	const consumedCursor = useRef<string | null>(null);
	useEffect(() => {
		const page = fetcher.data;
		if (
			!page ||
			page.error ||
			!page.requestedCursor ||
			consumedCursor.current === page.requestedCursor
		) {
			return;
		}
		consumedCursor.current = page.requestedCursor;
		setEvents((current) => {
			const knownIDs = new Set(current.map((event) => event.id));
			return [
				...current,
				...page.events.filter((event) => !knownIDs.has(event.id)),
			];
		});
		setNextCursor(page.nextCursor);
	}, [fetcher.data]);
	const acceptingEvents = events.filter(
		(event) => eventDisplayStatus(event) === "open",
	);
	const closedEvents = events.filter(
		(event) => eventDisplayStatus(event) !== "open",
	);
	const hasEvents = events.length > 0;
	return (
		<PageShell>
			<PageIntro eyebrow="MY EVENTS" title="参加中のイベント" />
			{!hasEvents ? (
				<div className="empty-state">
					<Icon name="calendar" size={35} />
					<h2>参加中のイベントはありません</h2>
					<p>新しいイベントを作るか、招待URLから参加してください。</p>
					<Link
						className="button button-primary event-create-button"
						to="/events/new"
					>
						イベントを作る
					</Link>
				</div>
			) : (
				<div className="event-sections">
					<section className="event-section event-section-accepting">
						<header className="event-section-heading">
							<div>
								<span>ACCEPTING RESPONSES</span>
								<h2>回答受付中のイベント</h2>
							</div>
							<b>{acceptingEvents.length}件</b>
						</header>
						{acceptingEvents.length > 0 ? (
							<EventList
								events={acceptingEvents}
								currentUserId={currentUserId}
								onEventLeft={removeEvent}
							/>
						) : (
							<p className="event-section-empty">
								回答受付中のイベントはありません。
							</p>
						)}
					</section>
					<section className="event-section event-section-closed">
						<header className="event-section-heading">
							<div>
								<span>CLOSED RESPONSES</span>
								<h2>回答受付終了のイベント</h2>
							</div>
							<b>{closedEvents.length}件</b>
						</header>
						{closedEvents.length > 0 ? (
							<EventList
								events={closedEvents}
								currentUserId={currentUserId}
								onEventLeft={removeEvent}
							/>
						) : (
							<p className="event-section-empty">
								回答受付終了のイベントはありません。
							</p>
						)}
					</section>
					{nextCursor && (
						<div className="event-pagination">
							{fetcher.data?.error && (
								<p className="event-pagination-error" role="alert">
									{fetcher.data.error.message}
								</p>
							)}
							<button
								className="button button-ghost"
								disabled={fetcher.state !== "idle"}
								onClick={() =>
									fetcher.load(
										`/events?cursor=${encodeURIComponent(nextCursor)}`,
									)
								}
								type="button"
							>
								{fetcher.state !== "idle"
									? "読み込んでいます…"
									: "さらに読み込む"}
							</button>
						</div>
					)}
				</div>
			)}
		</PageShell>
	);
}
