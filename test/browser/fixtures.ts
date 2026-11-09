import type { Page } from "@playwright/test";
import { cachePublicFonts } from "./font-cache";

export type Scenario = {
	anonymous?: boolean;
	guest?: boolean;
	longText?: boolean;
	groups?: boolean;
	empty?: boolean;
	restricted?: boolean;
	calendarDisconnected?: boolean;
	icloudConnected?: boolean;
	icloudImportError?: boolean;
	calendarWritePermissionRequired?: boolean;
	calendarImportError?: string;
	changingCounts?: boolean;
};

export const eventID = "event-1";
export const token = "abcdefghijklmnopqrstuvwxyzABCDEFGH123456789";

export async function installFixtures(page: Page, scenario: Scenario = {}) {
	await cachePublicFonts(page);
	const unknownRequests: string[] = [];
	const now = new Date();
	const start = Date.UTC(
		now.getUTCFullYear(),
		now.getUTCMonth(),
		now.getUTCDate() + 1,
	);
	const iso = (hours: number) =>
		new Date(start + hours * 3_600_000).toISOString();
	const longName = "東京大阪合同チームのとても長い表示名".repeat(4);
	const user = {
		id: scenario.restricted ? "member-1" : "owner-1",
		account_type: scenario.guest ? "guest" : "registered",
		display_name: scenario.longText ? longName : "山田 太郎",
		time_zone: "Asia/Tokyo",
		email: scenario.guest
			? null
			: scenario.longText
				? `${"long-email-address-".repeat(5)}@example.com`
				: "yamada@example.com",
		guest_expires_at: null,
		created_at: iso(-24),
		updated_at: iso(-24),
	};
	const event = {
		id: eventID,
		created_by_user_id: "owner-1",
		title: scenario.longText
			? "東京・大阪の合同チームによる長い名前のイベント／".repeat(4)
			: "チームミーティング",
		description: scenario.longText
			? `${"長い説明文も枠に収まることを確認します。".repeat(12)}\nhttps://example.com/${"unbroken-path-".repeat(12)}`
			: "みんなの予定を合わせるイベントです。",
		window_start_at: iso(0),
		window_end_at: iso(24 * 14 + 12),
		duration_minutes: 90,
		scheduling_mode: scenario.groups ? "groups" : "whole_event",
		status: "open",
		confirmed_start_at: null as string | null,
		confirmed_end_at: null as string | null,
		response_deadline_at: iso(24 * 7),
		results_visible_to_participants: !scenario.restricted,
		created_at: iso(-24),
		updated_at: iso(-24),
	};
	const participants = Array.from({ length: 6 }, (_, index) => ({
		id: `participant-${index}`,
		event_id: eventID,
		user_id: index ? `member-${index}` : "owner-1",
		display_name: scenario.longText
			? `${longName}${index + 1}`
			: [
					"山田 太郎",
					"佐藤 花子",
					"鈴木 次郎",
					"田中 一郎",
					"高橋 美咲",
					"伊藤 健",
				][index],
		role: index ? "member" : "organizer",
		response_status: index === 5 ? "pending" : "submitted",
		created_at: iso(-24),
		updated_at: iso(-24),
	}));
	const groups = [0, 1].map((index) => ({
		id: `group-${index + 1}`,
		event_id: eventID,
		name: scenario.longText
			? `とても長いグループ名を含むチーム分けの表示確認${longName}`
			: `チーム${index + 1}`,
		duration_minutes: 90,
		confirmed_start_at: index ? null : iso(24),
		confirmed_end_at: index ? null : iso(25.5),
		member_count: 3,
		members: participants.slice(index * 3, index * 3 + 3),
		created_at: iso(-24),
		updated_at: iso(-24),
	}));
	const intervals = scenario.empty
		? []
		: [{ start_at: iso(0), end_at: iso(8), source: "manual" }];
	const availability = scenario.empty
		? []
		: participants.map((participant, index) => ({
				participant,
				intervals: scenario.changingCounts
					? (
							[[[0, 8]], [[0, 3]], [[3, 6]], [[1, 2]], [], [[0, 8]]][index] ??
							[]
						).map(([start, end]) => ({
							start_at: iso(start),
							end_at: iso(end),
							source: "manual",
						}))
					: intervals,
			}));
	const candidates = scenario.empty
		? []
		: [1, 2, 3, 25, 26, 27, 49].map((hour) => ({
				start_at: iso(hour),
				end_at: iso(hour + 1.5),
				available_participant_count: 5,
				total_participant_count: 6,
				available_participant_ids: participants
					.slice(0, 5)
					.map((participant) => participant.id),
			}));
	const calendars = [0, 1, 2].map((index) => ({
		id: `calendar-${index}`,
		summary: scenario.longText
			? `${longName}の長いカレンダー名`
			: ["仕事", "家族", "個人"][index],
		primary: index === 0,
		selected: true,
		background_color: "#2da982",
	}));
	calendars.push({
		id: "ja.japanese.official#holiday@group.v.calendar.google.com",
		summary: "日本の祝日",
		primary: false,
		selected: true,
		background_color: "#4285f4",
	});
	await page.addInitScript(
		({ eventID, token }) => {
			localStorage.setItem(
				"vacaro.event-invite-urls",
				JSON.stringify({
					[eventID]: `https://vacaro.astalum.dev/invitations/${token}`,
				}),
			);
			localStorage.setItem(
				"vacaro.response-edit-urls",
				JSON.stringify({
					[eventID]: `https://vacaro.astalum.dev/responses/edit#${token}`,
				}),
			);
		},
		{ eventID, token },
	);
	let icloudConnected = Boolean(scenario.icloudConnected);
	await page.route("**/api/v1/**", async (route) => {
		const request = route.request();
		const url = new URL(request.url());
		const path = url.pathname.replace("/api/v1", "");
		const json = async (data: unknown, meta?: unknown) =>
			route.fulfill({ json: { data, ...(meta ? { meta } : {}) } });
		const failure = async (status: number, code: string) =>
			route.fulfill({
				status,
				json: { error: { code, message: "設定内容を確認してください。" } },
			});
		if (path === "/me" || path.endsWith("/response-user")) {
			if (scenario.anonymous) return failure(401, "unauthorized");
			return json(user);
		}
		if (path === "/integrations/icloud-calendar") {
			if (request.method() === "POST") {
				icloudConnected = true;
				return json({ connected: true });
			}
			if (request.method() === "DELETE") {
				icloudConnected = false;
				return route.fulfill({ status: 204 });
			}
		}
		if (path === "/integrations/icloud-calendar/calendars") {
			if (!scenario.icloudConnected)
				return failure(409, "icloud_not_connected");
			return json({
				account: "apple@example.com",
				calendars: [
					{
						id: "https://p01-caldav.icloud.com/user/calendars/personal/",
						summary: scenario.longText
							? `${longName}のiCloudカレンダー`
							: "iCloudの個人",
						is_vacaro: false,
					},
					{
						id: "https://p01-caldav.icloud.com/user/calendars/vacaro/",
						summary: "Vacaro",
						is_vacaro: true,
					},
				],
			});
		}
		if (path.endsWith("/icloud-calendar-availability/preview")) {
			if (scenario.icloudImportError)
				return failure(409, "icloud_reconnect_required");
			return json({ intervals });
		}
		if (path.endsWith("/icloud-confirmation-calendar"))
			return json({
				connection_status: scenario.icloudConnected
					? "connected"
					: "not_connected",
				syncs: scenario.icloudConnected
					? [{ group_id: null, status: "synced", attempted_at: iso(0) }]
					: [],
			});
		if (path.endsWith("/google-calendar-availability/preview")) {
			if (scenario.calendarImportError)
				return failure(409, scenario.calendarImportError);
			return json({ intervals });
		}
		if (path.endsWith("/calendars")) {
			if (scenario.calendarDisconnected || scenario.guest || scenario.anonymous)
				return failure(409, "calendar_not_connected");
			return json({
				calendars,
				write_enabled: !scenario.calendarWritePermissionRequired,
			});
		}
		if (path === "/events")
			return json(
				scenario.empty
					? []
					: [
							event,
							{
								...event,
								id: "confirmed-event",
								status: "confirmed",
								confirmed_start_at: iso(24),
								confirmed_end_at: iso(25.5),
							},
						],
				{ next_cursor: null },
			);
		if (path.startsWith("/invitations/")) return json(event);
		if (path.endsWith("/participants"))
			return json(scenario.empty ? [] : participants);
		if (path.endsWith("/groups")) return json(scenario.empty ? [] : groups);
		if (path.endsWith("/my-availability"))
			return json({ response_status: "submitted", intervals });
		if (path.endsWith("/availability")) return json(availability);
		if (path.endsWith("/candidates")) return json(candidates);
		if (path.endsWith("/confirmation-calendar"))
			return json({
				connection_status: scenario.calendarDisconnected
					? "not_connected"
					: scenario.calendarWritePermissionRequired
						? "write_permission_required"
						: "connected",
				syncs: [
					{
						event_id: eventID,
						group_id: null,
						status: "synced",
						attempted_at: iso(0),
					},
				],
			});
		if (path === "/response-sessions") return json({ event_id: eventID });
		if (path.endsWith("/response-edit-link"))
			return json({
				response_edit_url: `https://vacaro.astalum.dev/responses/edit#${token}`,
			});
		if (path === `/events/${eventID}` || path === "/events/confirmed-event") {
			const confirmed =
				page.url().includes("/confirmed") || path === "/events/confirmed-event";
			return json(
				confirmed
					? {
							...event,
							status: "confirmed",
							confirmed_start_at: iso(24),
							confirmed_end_at: iso(25.5),
						}
					: event,
			);
		}
		unknownRequests.push(`${request.method()} ${path}`);
		return failure(404, "fixture_not_found");
	});
	return { unknownRequests };
}
