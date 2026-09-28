import { Link } from "react-router";
import { Icon, PageShell, WeekendText } from "../../components/ui";
import {
	apiRequest,
	type Event,
	formatDateRange,
	minutesLabel,
	type SchedulingGroup,
} from "../../lib/api";
import type { Route } from "./+types/confirmed";

export function meta({ loaderData }: Route.MetaArgs) {
	return [
		{
			title: loaderData
				? `日程が決まりました — ${loaderData.event.title} | vacaro`
				: "確定した日程 | vacaro",
		},
	];
}
export async function clientLoader({ params }: Route.ClientLoaderArgs) {
	const event = await apiRequest<Event>(`/events/${params.eventId}`);
	const groups =
		event.scheduling_mode === "groups"
			? await apiRequest<SchedulingGroup[]>(`/events/${event.id}/groups`)
			: [];
	return { event, groups };
}
clientLoader.hydrate = true as const;
export function HydrateFallback() {
	return (
		<PageShell>
			<div className="page-loading">確定した日程を読み込んでいます…</div>
		</PageShell>
	);
}

export default function Confirmed({ loaderData }: Route.ComponentProps) {
	const { event, groups } = loaderData;
	if (event.scheduling_mode === "groups") {
		const allConfirmed =
			Boolean(event.confirmed_start_at) &&
			groups.every((group) => group.confirmed_start_at);
		return (
			<PageShell>
				<div className="confirmed-hero">
					<div className="success-badge">
						<Icon name="check" size={32} />
					</div>
					<span className="page-eyebrow">GROUP DATES</span>
					<h1>
						{allConfirmed
							? "全グループの日程が決まりました！"
							: "グループごとの確定日程"}
					</h1>
					<p>{event.title}</p>
				</div>
				<div className="confirmed-group-grid">
					<article
						className={event.confirmed_start_at ? "confirmed" : "pending"}
					>
						<header>
							<span
								className={`group-state ${event.confirmed_start_at ? "confirmed" : "open"}`}
							>
								{event.confirmed_start_at ? "確定済み" : "調整中"}
							</span>
							<h2>全体</h2>
						</header>
						{event.confirmed_start_at && event.confirmed_end_at ? (
							<strong>
								<WeekendText>
									{formatDateRange(
										event.confirmed_start_at,
										event.confirmed_end_at,
										event.time_zone,
									)}
								</WeekendText>
							</strong>
						) : (
							<p>日程はまだ確定していません。</p>
						)}
						<div>
							<span>
								<Icon name="clock" size={15} />{" "}
								{minutesLabel(event.duration_minutes)}
							</span>
							<span>
								<Icon name="users" size={15} /> 全参加者
							</span>
						</div>
						<Link
							className="button button-ghost"
							to={`/events/${event.id}/results?scope=whole`}
						>
							結果を見る
						</Link>
					</article>
					{groups.map((group) => (
						<article
							key={group.id}
							className={group.confirmed_start_at ? "confirmed" : "pending"}
						>
							<header>
								<span
									className={`group-state ${group.confirmed_start_at ? "confirmed" : "open"}`}
								>
									{group.confirmed_start_at ? "確定済み" : "調整中"}
								</span>
								<h2>{group.name}</h2>
							</header>
							{group.confirmed_start_at && group.confirmed_end_at ? (
								<strong>
									<WeekendText>
										{formatDateRange(
											group.confirmed_start_at,
											group.confirmed_end_at,
											event.time_zone,
										)}
									</WeekendText>
								</strong>
							) : (
								<p>日程はまだ確定していません。</p>
							)}
							<div>
								<span>
									<Icon name="clock" size={15} />{" "}
									{minutesLabel(group.duration_minutes)}
								</span>
								<span>
									<Icon name="users" size={15} /> {group.members.length}人
								</span>
							</div>
							<Link
								className="button button-ghost"
								to={`/events/${event.id}/results?group_id=${group.id}`}
							>
								結果を見る
							</Link>
						</article>
					))}
				</div>
			</PageShell>
		);
	}
	const confirmed = event.confirmed_start_at && event.confirmed_end_at;
	if (!confirmed)
		return (
			<PageShell>
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
		<PageShell>
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
							<WeekendText>
								{new Intl.DateTimeFormat("ja-JP", {
									timeZone: event.time_zone,
									weekday: "long",
								}).format(start)}
							</WeekendText>
						</b>
						<strong>
							<WeekendText>
								{formatDateRange(
									event.confirmed_start_at as string,
									event.confirmed_end_at as string,
									event.time_zone,
								)
									.split(" ")
									.slice(-3)
									.join(" ")}
							</WeekendText>
						</strong>
					</div>
				</div>
				<div className="confirmed-details">
					<p>
						<Icon name="calendar" size={17} />{" "}
						<WeekendText>
							{formatDateRange(
								event.confirmed_start_at as string,
								event.confirmed_end_at as string,
								event.time_zone,
							)}
						</WeekendText>
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
