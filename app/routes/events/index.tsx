import { Link } from "react-router";
import { Icon, PageIntro, PageShell } from "../../components/ui";
import {
	apiRequest,
	type Event,
	formatDateRange,
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
	return {
		createdEvents: events.filter(
			(event) => event.created_by_user_id === user.id,
		),
		joinedEvents: events.filter(
			(event) => event.created_by_user_id !== user.id,
		),
	};
}
clientLoader.hydrate = true as const;
export function HydrateFallback() {
	return (
		<PageShell>
			<div className="page-loading">イベントを読み込んでいます…</div>
		</PageShell>
	);
}

function EventList({
	events,
	showAnswerLink = false,
	showManageLink = false,
}: {
	events: Event[];
	showAnswerLink?: boolean;
	showManageLink?: boolean;
}) {
	return (
		<div className="event-list">
			{events.map((event) => (
				<article key={event.id}>
					<div className="event-list-body">
						<span className="status-pill">
							<i />{" "}
							{event.status === "open"
								? "回答受付中"
								: event.status === "confirmed"
									? "日程確定"
									: "取消済み"}
						</span>
						<h2>{event.title}</h2>
						<p>
							<Icon name="calendar" size={15} />{" "}
							{formatDateRange(
								event.window_start_at,
								event.window_end_at,
								event.time_zone,
							)}
							<span>・</span>
							<Icon name="clock" size={15} />{" "}
							{minutesLabel(event.duration_minutes)}
						</p>
					</div>
					<div className="event-list-actions">
						{showAnswerLink && event.status === "open" && (
							<Link
								className="button button-primary"
								to={`/events/${event.id}/availability`}
							>
								回答ページへ <Icon name="arrow" size={15} />
							</Link>
						)}
						{showManageLink && (
							<Link
								className="button button-ghost"
								to={`/events/${event.id}/manage`}
							>
								管理画面へ <Icon name="users" size={15} />
							</Link>
						)}
						<Link
							className="button button-ghost"
							to={
								event.status === "confirmed"
									? `/events/${event.id}/confirmed`
									: `/events/${event.id}/results`
							}
						>
							詳細を見る <Icon name="chevron" size={15} />
						</Link>
					</div>
				</article>
			))}
		</div>
	);
}

export default function EventsIndex({ loaderData }: Route.ComponentProps) {
	const { createdEvents, joinedEvents } = loaderData;
	const hasEvents = createdEvents.length + joinedEvents.length > 0;
	return (
		<PageShell>
			<PageIntro
				eyebrow="MY EVENTS"
				title="参加中のイベント"
				description="作成したイベントと、招待されたイベントを確認できます。"
			/>
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
								<span>HOSTED BY ME</span>
								<h2>自分が作成したイベント</h2>
							</div>
							<b>{createdEvents.length}件</b>
						</header>
						{createdEvents.length > 0 ? (
							<EventList events={createdEvents} showAnswerLink showManageLink />
						) : (
							<p className="event-section-empty">
								作成したイベントはまだありません。
							</p>
						)}
					</section>
					<section className="event-section">
						<header className="event-section-heading">
							<div>
								<span>JOINED EVENTS</span>
								<h2>参加したイベント</h2>
							</div>
							<b>{joinedEvents.length}件</b>
						</header>
						{joinedEvents.length > 0 ? (
							<EventList events={joinedEvents} showAnswerLink />
						) : (
							<p className="event-section-empty">
								参加したイベントはまだありません。
							</p>
						)}
					</section>
				</div>
			)}
		</PageShell>
	);
}
