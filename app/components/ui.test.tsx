// @vitest-environment happy-dom

import { act, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it } from "vitest";
import { EVENT_INVITE_URLS_STORAGE_KEY, saveEventInviteUrl } from "../lib/api";
import { PageShell } from "./ui";

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
