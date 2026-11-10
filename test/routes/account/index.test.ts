import { afterEach, describe, expect, it, vi } from "vitest";
import { clientAction, clientLoader } from "~/routes/account/index";
const args = (suffix = "") =>
	({ request: new Request(`https://vacaro.test/account${suffix}`) }) as never;
const user = {
	id: "user-1",
	account_type: "registered",
	display_name: "User",
	time_zone: "Asia/Tokyo",
};
function response(data: unknown, status = 200) {
	return new Response(
		JSON.stringify(status === 200 ? { data } : { error: data }),
		{ status, headers: { "Content-Type": "application/json" } },
	);
}
afterEach(() => vi.unstubAllGlobals());
describe("combined user settings", () => {
	it.each(["available", "unavailable"])(
		"saves %s as the account's initial availability without changing the profile",
		async (value) => {
			const fetchMock = vi
				.fn()
				.mockResolvedValue(response({ ...user, availability_default: value }));
			vi.stubGlobal("fetch", fetchMock);
			const formData = new FormData();
			formData.set("intent", "update-availability-default");
			formData.set("availability_default", value);
			const result = await clientAction({
				request: new Request("https://vacaro.test/account", {
					method: "POST",
					body: formData,
				}),
			} as never);
			expect(result).toEqual({ kind: "availability-default-updated" });
			expect(fetchMock).toHaveBeenCalledOnce();
			expect(fetchMock.mock.calls[0][0]).toBe(
				"/api/v1/me/availability-default",
			);
			expect(fetchMock.mock.calls[0][1].method).toBe("PUT");
			expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
				availability_default: value,
			});
		},
	);
	it("rejects an invalid initial availability without sending a request", async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);
		const formData = new FormData();
		formData.set("intent", "update-availability-default");
		formData.set("availability_default", "invalid");
		const result = await clientAction({
			request: new Request("https://vacaro.test/account", {
				method: "POST",
				body: formData,
			}),
		} as never);
		expect(result).toMatchObject({
			init: { status: 422 },
			data: { kind: "error", scope: "availability" },
		});
		expect(fetchMock).not.toHaveBeenCalled();
	});
	it("reports a failed preference save instead of reporting success", async () => {
		vi.stubGlobal(
			"fetch",
			vi
				.fn()
				.mockResolvedValue(
					response(
						{ code: "internal_error", message: "保存できませんでした" },
						500,
					),
				),
		);
		const formData = new FormData();
		formData.set("intent", "update-availability-default");
		formData.set("availability_default", "available");
		const result = await clientAction({
			request: new Request("https://vacaro.test/account", {
				method: "POST",
				body: formData,
			}),
		} as never);
		expect(result).toMatchObject({
			init: { status: 500 },
			data: { kind: "error", scope: "availability" },
		});
	});
	it("loads the profile and only the selected service on the same page", async () => {
		const fetchMock = vi.fn((input: unknown) => {
			const path = String(input);
			if (path.endsWith("/me")) return Promise.resolve(response(user));
			if (path.endsWith("/calendar-preference"))
				return Promise.resolve(response({ provider: "icloud" }));
			if (path.endsWith("/icloud-calendar/calendars"))
				return Promise.resolve(
					response({ calendars: [], account: "apple@example.com" }),
				);
			throw new Error(`Unexpected request: ${path}`);
		});
		vi.stubGlobal("fetch", fetchMock);
		const loaded = await clientLoader(args());
		expect(loaded.user).toEqual(user);
		expect(loaded.calendar.settings?.provider).toBe("icloud");
		expect(loaded.calendar.settings?.icloud?.options.account).toBe(
			"apple@example.com",
		);
		expect(fetchMock).toHaveBeenCalledTimes(3);
	});
	it("keeps profile settings available when calendar preferences cannot load", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn((input: unknown) =>
				Promise.resolve(
					String(input).endsWith("/me")
						? response(user)
						: response({ code: "internal_error", message: "接続エラー" }, 500),
				),
			),
		);
		const loaded = await clientLoader(args());
		expect(loaded.user).toEqual(user);
		expect(loaded.calendar.settings).toBeNull();
		expect(loaded.calendar.error?.code).toBe("internal_error");
	});
	for (const result of ["connected", "permission_required", "error"]) {
		it(`retains the OAuth callback on the account page: ${result}`, async () => {
			vi.stubGlobal(
				"fetch",
				vi.fn((input: unknown) =>
					Promise.resolve(
						response(
							String(input).endsWith("/me") ? user : { provider: "none" },
						),
					),
				),
			);
			const loaded = await clientLoader(args(`?google_calendar=${result}`));
			expect(loaded).not.toBeInstanceOf(Response);
			expect(loaded.user).toEqual(user);
		});
	}
});
