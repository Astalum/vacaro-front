import { Link } from "react-router";
import { Icon, PageIntro, PageShell, WeekendText } from "../../components/ui";
import {
	apiRequest,
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
export async function clientLoader() {
	const [events, user] = await Promise.all([
		apiRequest<Event[]>("/events"),
		apiRequest<User>("/me"),
	]);
	return { events, currentUserId: user.id };
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
	const { events, currentUserId } = loaderData;
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
							<b>{acceptingEvents.length}件</b>
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
							<b>{closedEvents.length}件</b>
						</header>
						{closedEvents.length > 0 ? (
							<EventList events={closedEvents} currentUserId={currentUserId} />
						) : (
							<p className="event-section-empty">
								回答受付終了のイベントはありません。
							</p>
						)}
					</section>
				</div>
			)}
		</PageShell>
	);
}
