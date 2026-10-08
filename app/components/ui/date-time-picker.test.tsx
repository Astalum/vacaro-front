// @vitest-environment happy-dom

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { DateTimePicker } from "./date-time-picker";

describe("DateTimePicker", () => {
	it("opens the calendar and updates the submitted date and time", async () => {
		const user = userEvent.setup();
		const { container } = render(
			<form>
				<DateTimePicker
					id="meeting-at"
					name="meeting_at"
					defaultValue="2026-06-14T09:00"
					required
				/>
			</form>,
		);

		await user.click(screen.getByRole("button", { name: /2026年6月14日/ }));
		expect(await screen.findByRole("grid")).toBeTruthy();
		expect(screen.getAllByRole("gridcell")).toHaveLength(42);
		expect(screen.getByRole("dialog").className).toContain(
			"max-h-[var(--radix-popover-content-available-height)]",
		);
		expect(screen.getByRole("dialog").className).toContain("z-[100]");
		await user.click(
			within(screen.getByRole("dialog")).getByRole("button", {
				name: /2026年6月14日/,
			}),
		);
		expect(
			container.querySelector<HTMLInputElement>('input[name="meeting_at"]')
				?.value,
		).toBe("2026-06-14T09:00");

		await user.click(screen.getByRole("button", { name: /2026年6月15日/ }));
		const timeInput = screen.getByLabelText("時刻");
		expect((timeInput as HTMLInputElement).step).toBe("60");
		await user.clear(timeInput);
		await user.type(timeInput, "10:30");
		await user.click(screen.getByRole("button", { name: "決定" }));

		await waitFor(() => {
			expect(
				screen.getByRole("button", { name: /2026年6月15日.*10:30/ }),
			).toBeTruthy();
		});
		expect(
			container.querySelector<HTMLInputElement>('input[name="meeting_at"]')
				?.value,
		).toBe("2026-06-15T10:30");
	});
});
