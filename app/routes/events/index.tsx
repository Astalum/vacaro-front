import { Link } from "react-router";
import { Icon, PageIntro, PageShell } from "../../components/ui";
import {
	apiRequest,
	type Event,
	formatDateRange,
	minutesLabel,
} from "../../lib/api";
import type { Route } from "./+types/index";

export function meta() {
	return [{ title: "イベント一覧 | yotei" }];
}
export async function clientLoader() {
	return apiRequest<Event[]>("/events");
}
clientLoader.hydrate = true as const;
export function HydrateFallback() {
	return (
		<PageShell>
			<div className="page-loading">イベントを読み込んでいます…</div>
		</PageShell>
	);
}

export default function EventsIndex({
	loaderData: events,
}: Route.ComponentProps) {
	return (
		<PageShell>
			<PageIntro
				eyebrow="MY EVENTS"
				title="参加中のイベント"
				description="作成したイベントと、招待されたイベントを確認できます。"
			/>
			{events.length === 0 ? (
				<div className="empty-state">
					<Icon name="calendar" size={35} />
					<h2>参加中のイベントはありません</h2>
					<p>新しいイベントを作るか、招待URLから参加してください。</p>
					<Link className="button button-primary" to="/events/new">
						イベントを作る
					</Link>
				</div>
			) : (
				<div className="event-list">
					{events.map((event) => (
						<article key={event.id}>
							<div className="event-list-date">
								<b>{new Date(event.window_start_at).getDate()}</b>
								<small>START</small>
							</div>
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
						</article>
					))}
				</div>
			)}
		</PageShell>
	);
}
