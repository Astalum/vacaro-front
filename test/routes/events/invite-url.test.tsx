import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EVENT_INVITE_URLS_STORAGE_KEY, savedEventInviteUrl } from "~/lib/api";
import {
	clientAction as createdAction,
	clientLoader as createdLoader,
} from "~/routes/events/created";
import {
	clientAction as editAction,
	clientLoader as editLoader,
} from "~/routes/events/edit";
import {
	clientAction as manageAction,
	clientLoader as manageLoader,
} from "~/routes/events/manage";

const event = {
	id: "event-1",
	created_by_user_id: "owner-1",
	title: "招待URLのテスト",
	description: null,
	time_zone: "Asia/Tokyo",
	window_start_at: "2026-10-20T00:00:00Z",
	window_end_at: "2026-10-20T09:00:00Z",
	duration_minutes: 60,
	scheduling_mode: "whole_event" as const,
	status: "open" as const,
	confirmed_start_at: null,
	confirmed_end_at: null,
	response_deadline_at: null,
	results_visible_to_participants: true,
	created_at: "2026-10-01T00:00:00Z",
	updated_at: "2026-10-01T00:00:00Z",
};

function response(data: unknown) {
	return Promise.resolve(
		new Response(JSON.stringify({ data }), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		}),
	);
}

function actionRequest(path: string) {
	const formData = new FormData();
	formData.set("intent", "reissue-invite-url");
	return new Request(`https://vacaro.test${path}`, {
		method: "POST",
		body: formData,
	});
}

describe("event invite URL loading", () => {
	beforeEach(() => {
		window.localStorage.removeItem(EVENT_INVITE_URLS_STORAGE_KEY);
	});

	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	it("does not reissue a token when the manage screen has no locally saved URL", async () => {
		const fetchMock = vi
			.fn()
			.mockImplementation((input: string | URL | Request) =>
				String(input).endsWith("/participants")
					? response([])
					: response(event),
			);
		vi.stubGlobal("fetch", fetchMock);

		const result = await manageLoader({
			params: { eventId: event.id },
		} as Parameters<typeof manageLoader>[0]);

		expect(result.inviteUrl).toBeNull();
		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(fetchMock.mock.calls).not.toContainEqual([
			`/api/v1/events/${event.id}/invite-token`,
			expect.anything(),
		]);
	});

	it("does not reissue a token when the edit screen has no locally saved URL", async () => {
		const fetchMock = vi.fn().mockImplementation(() => response(event));
		vi.stubGlobal("fetch", fetchMock);

		const result = await editLoader({
			params: { eventId: event.id },
		} as Parameters<typeof editLoader>[0]);

		expect(result.inviteUrl).toBeNull();
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(fetchMock.mock.calls[0][0]).toBe(`/api/v1/events/${event.id}`);
	});

	it("does not reissue a token when the created screen is opened directly", async () => {
		const fetchMock = vi.fn().mockImplementation(() => response(event));
		vi.stubGlobal("fetch", fetchMock);

		const result = await createdLoader({
			params: { eventId: event.id },
			request: new Request(`https://vacaro.test/events/${event.id}/created`),
		} as Parameters<typeof createdLoader>[0]);

		expect(result.inviteUrl).toBeNull();
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(fetchMock.mock.calls[0][0]).toBe(`/api/v1/events/${event.id}`);
	});
});

describe("explicit event invite URL reissue", () => {
	beforeEach(() => {
		window.localStorage.removeItem(EVENT_INVITE_URLS_STORAGE_KEY);
	});

	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	it.each([
		["manage", manageAction, `/events/${event.id}/manage`],
		["edit", editAction, `/events/${event.id}/edit`],
		["created", createdAction, `/events/${event.id}/created`],
	])(
		"reissues only after the %s action is submitted",
		async (_, action, path) => {
			const inviteUrl = "https://vacaro.test/invitations/new-token";
			const fetchMock = vi.fn().mockImplementation(() =>
				response({
					...event,
					invite_token: "new-token",
					invite_url: inviteUrl,
				}),
			);
			vi.stubGlobal("fetch", fetchMock);

			const result = await action({
				params: { eventId: event.id },
				request: actionRequest(path),
			} as never);

			expect(fetchMock).toHaveBeenCalledTimes(1);
			expect(fetchMock.mock.calls[0][0]).toBe(
				`/api/v1/events/${event.id}/invite-token`,
			);
			expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "POST" });
			expect(result).toEqual({
				success: "招待URLを再発行しました",
				inviteUrl,
			});
			expect(savedEventInviteUrl(event.id)).toBe(inviteUrl);
		},
	);
});
