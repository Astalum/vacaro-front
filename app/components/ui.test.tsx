// @vitest-environment happy-dom

import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRoutesStub, MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EVENT_INVITE_URLS_STORAGE_KEY, saveEventInviteUrl } from "../lib/api";
import { AppHeader, InviteUrlReissue, PageShell, WeekendText } from "./ui";

describe("AppHeader mobile menu", () => {
	beforeEach(() => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(
				new Response(
					JSON.stringify({
						error: { code: "unauthorized", message: "認証が必要です" },
					}),
					{ status: 401, headers: { "Content-Type": "application/json" } },
				),
			),
		);
	});

	afterEach(() => vi.unstubAllGlobals());

	it("shows every destination and closes after choosing a link", async () => {
		const user = userEvent.setup();
		render(
			<MemoryRouter>
				<AppHeader />
			</MemoryRouter>,
		);

		const menuButton = screen.getByRole("button", { name: "メニューを開く" });
		await user.click(menuButton);

		expect(menuButton.getAttribute("aria-expanded")).toBe("true");
		expect(
			screen.getByRole("link", { name: /イベントを作る/ }).getAttribute("href"),
		).toBe("/events/new");
		expect(
			screen.getByRole("link", { name: "イベント一覧" }).getAttribute("href"),
		).toBe("/events");
		expect(
			screen
				.getByRole("link", { name: /Googleでログイン/ })
				.getAttribute("href"),
		).toBe("/api/v1/auth/google/start");

		await user.click(screen.getByRole("link", { name: "イベント一覧" }));
		expect(menuButton.getAttribute("aria-expanded")).toBe("false");
	});
});

describe("PageShell invite URL", () => {
	beforeEach(() => {
		window.localStorage.removeItem(EVENT_INVITE_URLS_STORAGE_KEY);
	});

	it("keeps the saved invite URL visible at the bottom and reflects updates", async () => {
		const eventID = "event-123";
		const originalUrl = "https://vacaro.test/invitations/original";
		const regeneratedUrl = "https://vacaro.test/invitations/regenerated";
		saveEventInviteUrl(eventID, originalUrl);

		render(
			<MemoryRouter initialEntries={[`/events/${eventID}/availability`]}>
				<PageShell fullScreen>回答画面</PageShell>
			</MemoryRouter>,
		);

		const inviteLink = await screen.findByRole("link", {
			name: originalUrl,
		});
		expect(inviteLink.getAttribute("href")).toBe(originalUrl);
		expect(inviteLink.closest("main")).not.toBeNull();
		expect(inviteLink.closest("section")?.previousSibling?.textContent).toBe(
			"回答画面",
		);

		act(() => saveEventInviteUrl(eventID, regeneratedUrl));

		await waitFor(() => {
			expect(
				screen.getByRole("link", { name: regeneratedUrl }).getAttribute("href"),
			).toBe(regeneratedUrl);
		});
	});
});

describe("InviteUrlReissue", () => {
	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	it("warns that the saved URL stays valid and requires confirmation", async () => {
		const user = userEvent.setup();
		const action = vi.fn(() => ({ ok: true }));
		const confirm = vi.fn(() => false);
		vi.stubGlobal("confirm", confirm);
		const RouterStub = createRoutesStub([
			{
				path: "/events/event-1/manage",
				Component: () => (
					<InviteUrlReissue hasInviteUrl={false} canReissue busy={false} />
				),
				action,
			},
		]);

		render(<RouterStub initialEntries={["/events/event-1/manage"]} />);

		expect(screen.getByText(/共有済みのURLは引き続き有効です/)).toBeTruthy();
		const button = screen.getByRole("button", { name: /招待URLを再発行/ });
		await user.click(button);
		expect(confirm).toHaveBeenCalledTimes(1);
		expect(action).not.toHaveBeenCalled();

		confirm.mockReturnValue(true);
		await user.click(button);
		await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
	});
});

describe("WeekendText", () => {
	it("colors only Saturday and Sunday labels", () => {
		const { container } = render(
			<WeekendText>10月3日(土) 〜 10月4日(日)</WeekendText>,
		);

		expect(container.querySelector(".weekday-saturday")?.textContent).toBe(
			"(土)",
		);
		expect(container.querySelector(".weekday-sunday")?.textContent).toBe(
			"(日)",
		);
		expect(container.textContent).toBe("10月3日(土) 〜 10月4日(日)");
	});
});
