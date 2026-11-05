// @vitest-environment happy-dom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { createRoutesStub, useLocation } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import Home from "~/routes/home";

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

function renderHome(entry: string) {
	const RouterStub = createRoutesStub([
		{
			path: "/",
			Component: () => {
				const location = useLocation();
				return (
					<>
						<Home />
						<span data-testid="location">
							{location.pathname + location.search + location.hash}
						</span>
					</>
				);
			},
		},
	]);
	return render(
		<StrictMode>
			<RouterStub initialEntries={[entry]} />
		</StrictMode>,
	);
}

describe("Home OAuth notice", () => {
	it.each(["Asia/Tokyo", "America/New_York", "UTC"])(
		"preserves the saved %s setting after Google login",
		async (timeZone) => {
			const options = Intl.DateTimeFormat().resolvedOptions();
			vi.spyOn(
				Intl.DateTimeFormat.prototype,
				"resolvedOptions",
			).mockReturnValue({
				...options,
				timeZone: "Europe/Paris",
			});
			const fetchMock = vi.fn<typeof fetch>().mockImplementation(
				async () =>
					new Response(
						JSON.stringify({
							data: {
								id: "user-1",
								account_type: "registered",
								display_name: "User",
								time_zone: timeZone,
							},
						}),
					),
			);
			vi.stubGlobal("fetch", fetchMock);
			renderHome("/?google_login=success&keep=value#how");

			await waitFor(() => {
				expect(screen.getByTestId("location").textContent).toBe(
					"/?keep=value#how",
				);
			});
			expect(screen.getByRole("status").textContent).toContain(
				"Googleログインが完了しました。",
			);
			expect(fetchMock.mock.calls.length).toBeGreaterThan(0);
			expect(fetchMock.mock.calls.every(([, init]) => !init?.method)).toBe(
				true,
			);

			await userEvent.click(screen.getByRole("button", { name: "閉じる" }));
			expect(screen.queryByRole("status")).toBeNull();
			expect(screen.getByTestId("location").textContent).toBe(
				"/?keep=value#how",
			);
		},
	);

	it.each([
		[
			"google_login=error",
			"alert",
			"Googleログインを完了できませんでした。もう一度お試しください。",
		],
		["logout=success", "status", "ログアウトしました。"],
	])(
		"shows and dismisses %s without changing unrelated URL state",
		async (marker, role, message) => {
			vi.stubGlobal(
				"fetch",
				vi.fn().mockResolvedValue(new Response(null, { status: 401 })),
			);
			renderHome(`/?${marker}&keep=value#how`);

			expect((await screen.findByRole(role)).textContent).toContain(message);
			await userEvent.click(screen.getByRole("button", { name: "閉じる" }));
			expect(screen.queryByRole(role)).toBeNull();
			expect(screen.getByTestId("location").textContent).toBe(
				"/?keep=value#how",
			);
		},
	);

	it("keeps a successful login usable when the profile lookup fails", async () => {
		const fetchMock = vi
			.fn<typeof fetch>()
			.mockRejectedValue(new Error("Network unavailable"));
		vi.stubGlobal("fetch", fetchMock);
		renderHome("/?google_login=success");

		await waitFor(() =>
			expect(screen.getByTestId("location").textContent).toBe("/"),
		);
		expect(screen.getByRole("status").textContent).toContain(
			"Googleログインが完了しました。",
		);
		expect(screen.queryByRole("alert")).toBeNull();
		expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
		expect(fetchMock.mock.calls.every(([, init]) => !init?.method)).toBe(true);
	});
});
