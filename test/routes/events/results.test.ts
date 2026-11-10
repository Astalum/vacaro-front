import { afterEach, describe, expect, it, vi } from "vitest";
import type { Event, SchedulingGroup } from "~/features/events/types";
import type { User } from "~/features/account/types";
import { clientAction, clientLoader } from "~/routes/events/results";

function response(data: unknown) {
	return Promise.resolve(
		new Response(JSON.stringify({ data }), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		}),
	);
}

describe("results clientLoader", () => {
	afterEach(() => vi.restoreAllMocks());

	it("loads availability for the group selected in the URL", async () => {
		const event = {
			id: "event-1",
			created_by_user_id: "user-1",
			title: "グループ調整",
			description: null,
			window_start_at: "2026-09-10T00:00:00Z",
			window_end_at: "2026-09-12T00:00:00Z",
			duration_minutes: 60,
			scheduling_mode: "groups",
			status: "open",
			confirmed_start_at: null,
			confirmed_end_at: null,
			response_deadline_at: null,
			results_visible_to_participants: true,
			created_at: "2026-09-01T00:00:00Z",
			updated_at: "2026-09-01T00:00:00Z",
		} satisfies Event;
		const user = { id: "user-1", time_zone: "Asia/Tokyo" } as User;
		const groupBase = {
			event_id: event.id,
			duration_minutes: 60,
			confirmed_start_at: null,
			confirmed_end_at: null,
			member_count: 0,
			members: [],
			created_at: "2026-09-01T00:00:00Z",
			updated_at: "2026-09-01T00:00:00Z",
		} satisfies Omit<SchedulingGroup, "id" | "name">;
		const groups: SchedulingGroup[] = [
			{ ...groupBase, id: "group-1", name: "A" },
			{ ...groupBase, id: "group-2", name: "B" },
		];
		const requestedPaths: string[] = [];
		vi.stubGlobal(
			"fetch",
			vi.fn((input: string | URL | Request) => {
				const path = String(input);
				requestedPaths.push(path);
				if (path.endsWith("/events/event-1")) return response(event);
				if (path.endsWith("/me")) return response(user);
				if (path.endsWith("/events/event-1/groups")) return response(groups);
				return response([]);
			}),
		);

		const loaded = await clientLoader({
			params: { eventId: event.id },
			request: new Request(
				"https://vacaro.test/events/event-1/results?group_id=group-2",
			),
		} as Parameters<typeof clientLoader>[0]);

		expect(loaded).not.toBeInstanceOf(Response);
		if (loaded instanceof Response) throw new Error("unexpected redirect");
		expect(loaded.activeGroup?.id).toBe("group-2");
		expect(requestedPaths.some((path) => path.includes("/candidates"))).toBe(
			false,
		);
		expect(requestedPaths).toContain(
			"/api/v1/events/event-1/groups/group-2/availability",
		);
	});

	it("loads whole-event availability when whole is selected", async () => {
		const event = {
			id: "event-1",
			created_by_user_id: "user-1",
			title: "グループ調整",
			description: null,
			window_start_at: "2026-09-10T00:00:00Z",
			window_end_at: "2026-09-12T00:00:00Z",
			duration_minutes: 60,
			scheduling_mode: "groups",
			status: "open",
			confirmed_start_at: null,
			confirmed_end_at: null,
			response_deadline_at: null,
			results_visible_to_participants: true,
			created_at: "2026-09-01T00:00:00Z",
			updated_at: "2026-09-01T00:00:00Z",
		} satisfies Event;
		const requestedPaths: string[] = [];
		vi.stubGlobal(
			"fetch",
			vi.fn((input: string | URL | Request) => {
				const path = String(input);
				requestedPaths.push(path);
				if (path.endsWith("/events/event-1")) return response(event);
				if (path.endsWith("/me"))
					if (path.endsWith("/events/event-1/groups")) return response([]);
				return response([]);
			}),
		);

		const loaded = await clientLoader({
			params: { eventId: event.id },
			request: new Request(
				"https://vacaro.test/events/event-1/results?scope=whole",
			),
		} as Parameters<typeof clientLoader>[0]);

		expect(loaded).not.toBeInstanceOf(Response);
		if (loaded instanceof Response) throw new Error("unexpected redirect");
		expect(loaded.activeGroup).toBeNull();
		expect(requestedPaths.some((path) => path.includes("/candidates"))).toBe(
			false,
		);
		expect(requestedPaths).toContain("/api/v1/events/event-1/availability");
	});

	it("treats the whole group as the default when small groups exist", async () => {
		const event = {
			id: "event-1",
			created_by_user_id: "user-1",
			title: "グループ調整",
			description: null,
			window_start_at: "2026-09-10T00:00:00Z",
			window_end_at: "2026-09-12T00:00:00Z",
			duration_minutes: 60,
			scheduling_mode: "groups",
			status: "open",
			confirmed_start_at: null,
			confirmed_end_at: null,
			response_deadline_at: null,
			results_visible_to_participants: true,
			created_at: "2026-09-01T00:00:00Z",
			updated_at: "2026-09-01T00:00:00Z",
		} satisfies Event;
		const groups = [
			{
				id: "group-1",
				event_id: event.id,
				name: "A",
				duration_minutes: 60,
				confirmed_start_at: null,
				confirmed_end_at: null,
				member_count: 0,
				members: [],
				created_at: "2026-09-01T00:00:00Z",
				updated_at: "2026-09-01T00:00:00Z",
			},
		] satisfies SchedulingGroup[];
		const requestedPaths: string[] = [];
		vi.stubGlobal(
			"fetch",
			vi.fn((input: string | URL | Request) => {
				const path = String(input);
				requestedPaths.push(path);
				if (path.endsWith("/events/event-1")) return response(event);
				if (path.endsWith("/me"))
					if (path.endsWith("/events/event-1/groups")) return response(groups);
				return response([]);
			}),
		);

		const loaded = await clientLoader({
			params: { eventId: event.id },
			request: new Request("https://vacaro.test/events/event-1/results"),
		} as Parameters<typeof clientLoader>[0]);

		expect(loaded).not.toBeInstanceOf(Response);
		if (loaded instanceof Response) throw new Error("unexpected redirect");
		expect(loaded.activeGroup).toBeNull();
		expect(requestedPaths.some((path) => path.includes("/candidates"))).toBe(
			false,
		);
		expect(requestedPaths).toContain("/api/v1/events/event-1/availability");
	});

	it("does not load result data when a participant cannot view results", async () => {
		const event = {
			id: "event-1",
			created_by_user_id: "owner-1",
			title: "非公開イベント",
			description: null,
			window_start_at: "2026-09-10T00:00:00Z",
			window_end_at: "2026-09-12T00:00:00Z",
			duration_minutes: 60,
			scheduling_mode: "groups",
			status: "open",
			confirmed_start_at: null,
			confirmed_end_at: null,
			response_deadline_at: null,
			results_visible_to_participants: false,
			created_at: "2026-09-01T00:00:00Z",
			updated_at: "2026-09-01T00:00:00Z",
		} satisfies Event;
		const requestedPaths: string[] = [];
		vi.stubGlobal(
			"fetch",
			vi.fn((input: string | URL | Request) => {
				const path = String(input);
				requestedPaths.push(path);
				if (path.endsWith("/events/event-1")) return response(event);
				if (path.endsWith("/me"))
					return response({ id: "member-1", time_zone: "Asia/Tokyo" });
			}),
		);

		const loaded = await clientLoader({
			params: { eventId: event.id },
			request: new Request("https://vacaro.test/events/event-1/results"),
		} as Parameters<typeof clientLoader>[0]);

		expect(loaded).not.toBeInstanceOf(Response);
		if (loaded instanceof Response) throw new Error("unexpected redirect");
		expect(loaded.restricted).toBe(true);
		expect(loaded.availability).toEqual([]);
		expect(requestedPaths).toHaveLength(2);
	});
});

describe("results clientAction", () => {
	afterEach(() => vi.restoreAllMocks());

	it("updates whether participants can view results", async () => {
		const fetchMock = vi.fn(() =>
			response({ results_visible_to_participants: false }),
		);
		vi.stubGlobal("fetch", fetchMock);
		const formData = new FormData();
		formData.set("intent", "update-results-visibility");
		formData.set("visible", "false");

		const result = await clientAction({
			params: { eventId: "event-1" },
			request: new Request("https://vacaro.test/events/event-1/results", {
				method: "POST",
				body: formData,
			}),
		} as Parameters<typeof clientAction>[0]);

		expect(result).toEqual({
			success: "回答者への結果公開を無効にしました",
		});
		expect(fetchMock).toHaveBeenCalledWith(
			"/api/v1/events/event-1/results-visibility",
			expect.objectContaining({
				method: "PATCH",
				body: JSON.stringify({ visible: false }),
			}),
		);
	});

	it("confirms the whole event when no group is selected", async () => {
		const fetchMock = vi.fn(() => response({ status: "confirmed" }));
		vi.stubGlobal("fetch", fetchMock);
		const formData = new FormData();
		formData.set("intent", "confirm");
		formData.set("group_id", "");
		formData.set("confirmation_date", "2026-09-10");
		formData.set("confirmation_time", "10:00");
		formData.set("duration_minutes", "60");
		formData.set("time_zone", "Asia/Tokyo");

		const result = await clientAction({
			params: { eventId: "event-1" },
			request: new Request("https://vacaro.test/events/event-1/results", {
				method: "POST",
				body: formData,
			}),
		} as Parameters<typeof clientAction>[0]);

		expect(result).toEqual({ success: "開催日時を確定しました" });
		expect(fetchMock).toHaveBeenCalledWith(
			"/api/v1/events/event-1/confirmation",
			expect.objectContaining({
				method: "PUT",
				body: JSON.stringify({
					start_at: "2026-09-10T01:00:00.000Z",
					end_at: "2026-09-10T02:00:00.000Z",
				}),
			}),
		);
	});

	it("confirms a group from a manually entered start time", async () => {
		const fetchMock = vi.fn(() => response({ status: "confirmed" }));
		vi.stubGlobal("fetch", fetchMock);
		const formData = new FormData();
		formData.set("intent", "confirm");
		formData.set("group_id", "group-1");
		formData.set("confirmation_date", "2026-09-10");
		formData.set("confirmation_time", "19:00");
		formData.set("duration_minutes", "45");
		formData.set("time_zone", "America/New_York");

		const result = await clientAction({
			params: { eventId: "event-1" },
			request: new Request("https://vacaro.test/events/event-1/results", {
				method: "POST",
				body: formData,
			}),
		} as Parameters<typeof clientAction>[0]);

		expect(result).toEqual({ success: "開催日時を確定しました" });
		expect(fetchMock).toHaveBeenCalledWith(
			"/api/v1/events/event-1/groups/group-1/confirmation",
			expect.objectContaining({
				method: "PUT",
				body: JSON.stringify({
					start_at: "2026-09-10T23:00:00.000Z",
					end_at: "2026-09-10T23:45:00.000Z",
				}),
			}),
		);
	});

	it("cancels the selected group's confirmation", async () => {
		const fetchMock = vi.fn(() => response({ confirmed_start_at: null }));
		vi.stubGlobal("fetch", fetchMock);
		const formData = new FormData();
		formData.set("intent", "unconfirm");
		formData.set("group_id", "group-1");

		const result = await clientAction({
			params: { eventId: "event-1" },
			request: new Request("https://vacaro.test/events/event-1/results", {
				method: "POST",
				body: formData,
			}),
		} as Parameters<typeof clientAction>[0]);

		expect(result).toEqual({ success: "確定を取り消しました" });
		expect(fetchMock).toHaveBeenCalledWith(
			"/api/v1/events/event-1/groups/group-1/confirmation",
			expect.objectContaining({ method: "DELETE" }),
		);
	});
});
