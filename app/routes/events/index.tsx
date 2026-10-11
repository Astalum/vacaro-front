import { useEffect, useRef, useState } from "react";
import { Link, useFetcher } from "react-router";
import { Icon, PageIntro, PageShell, WeekendText } from "../../components/ui";
import {
	apiErrorData,
	apiRequest,
	apiRequestWithMeta,
	type Event,
	eventDisplayStatus,
	formatDateTime,
	minutesLabel,
	type User,
} from "../../lib/api";
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
}: {
	events: Event[];
	currentUserId: string;
}) {
	return (
		<div className="event-list">
			{events.map((event) => {
				const displayStatus = eventDisplayStatus(event);
				const canManage = event.created_by_user_id === currentUserId;
				const canViewResults =
					canManage || event.results_visible_to_participants;
				return (
					<article key={event.id}>
						<div className="event-list-body">
							<h2>{event.title}</h2>
							<div className="event-list-meta">
								<span className="event-list-period">
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
								</span>
								<span className="event-list-meta-separator" aria-hidden="true">
									・
								</span>
								<span className="event-list-duration">
									<Icon name="clock" size={15} />
									{minutesLabel(event.duration_minutes)}
								</span>
							</div>
						</div>
						<div className="event-list-actions">
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
									<span className="event-action-label-full">
										確定日時を見る
									</span>
									<span className="event-action-label-compact">確定日時</span>
									<Icon name="calendar" size={15} />
								</Link>
							)}
							{canViewResults && (
								<Link
									className="button button-ghost"
									to={`/events/${event.id}/results`}
								>
									<span className="event-action-label-full">
										回答結果を見る
									</span>
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
						</div>
					</article>
				);
			})}
		</div>
	);
}

export default function EventsIndex({ loaderData }: Route.ComponentProps) {
	const { currentUserId } = loaderData;
	const fetcher = useFetcher<typeof clientLoader>();
	const [events, setEvents] = useState(loaderData.events);
	const [nextCursor, setNextCursor] = useState(loaderData.nextCursor);
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
					<section className="event-section">
						<header className="event-section-heading">
							<div>
								<span>ACCEPTING RESPONSES</span>
								<h2>回答受付中のイベント</h2>
							</div>
							<b>{acceptingEvents.length}件表示</b>
						</header>
						{acceptingEvents.length > 0 ? (
							<EventList
								events={acceptingEvents}
								currentUserId={currentUserId}
							/>
						) : (
							<p className="event-section-empty">
								回答受付中のイベントはありません。
							</p>
						)}
					</section>
					<section className="event-section">
						<header className="event-section-heading">
							<div>
								<span>CLOSED RESPONSES</span>
								<h2>回答受付終了のイベント</h2>
							</div>
							<b>{closedEvents.length}件表示</b>
						</header>
						{closedEvents.length > 0 ? (
							<EventList events={closedEvents} currentUserId={currentUserId} />
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
