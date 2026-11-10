import { afterEach, describe, expect, it, vi } from "vitest";
import { clientLoader } from "~/routes/account/index";
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
