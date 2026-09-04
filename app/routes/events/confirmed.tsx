import { Link } from "react-router";
import { Icon, PageShell } from "../../components/ui";
import {
	apiRequest,
	type Event,
	formatDateRange,
	minutesLabel,
} from "../../lib/api";
import type { Route } from "./+types/confirmed";

export function meta({ loaderData }: Route.MetaArgs) {
	return [
		{
			title: loaderData
				? `日程が決まりました — ${loaderData.title} | yotei`
				: "確定した日程 | yotei",
		},
	];
}
export async function clientLoader({ params }: Route.ClientLoaderArgs) {
	return apiRequest<Event>(`/events/${params.eventId}`);
}
clientLoader.hydrate = true as const;
export function HydrateFallback() {
	return (
		<PageShell narrow>
			<div className="page-loading">確定した日程を読み込んでいます…</div>
		</PageShell>
	);
}

export default function Confirmed({ loaderData: event }: Route.ComponentProps) {
	const confirmed = event.confirmed_start_at && event.confirmed_end_at;
	if (!confirmed)
		return (
			<PageShell narrow>
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
		<PageShell narrow>
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
								timeZone: event.time_zone,
								month: "short",
							})
								.format(start)
								.toUpperCase()}
						</small>
						<strong>
							{new Intl.DateTimeFormat("ja-JP", {
								timeZone: event.time_zone,
								day: "numeric",
							}).format(start)}
						</strong>
					</div>
					<span />
					<div>
						<b>
							{new Intl.DateTimeFormat("ja-JP", {
								timeZone: event.time_zone,
								weekday: "long",
							}).format(start)}
						</b>
						<strong>
							{formatDateRange(
								event.confirmed_start_at as string,
								event.confirmed_end_at as string,
								event.time_zone,
							)
								.split(" ")
								.slice(-3)
								.join(" ")}
						</strong>
					</div>
				</div>
				<div className="confirmed-details">
					<p>
						<Icon name="calendar" size={17} />{" "}
						{formatDateRange(
							event.confirmed_start_at as string,
							event.confirmed_end_at as string,
							event.time_zone,
						)}
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
			</section>
			<div className="confirmed-actions">
				<button className="button button-primary" type="button">
					<Icon name="calendar" size={17} /> Googleカレンダーに追加
				</button>
				<Link
					className="button button-ghost"
					to={`/events/${event.id}/results`}
				>
					回答結果を見る
				</Link>
			</div>
		</PageShell>
	);
}
