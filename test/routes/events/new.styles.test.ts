// @vitest-environment node

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(
	new URL("../../../app/styles/routes/events/new.scss", import.meta.url),
	"utf8",
);

describe("new event responsive styles", () => {
	it("allows the daily time fields to shrink inside their bordered area", () => {
		expect(styles).toMatch(
			/\.new-event-time-range,\s*\.new-event-time-range\s*>\s*\[data-slot="field"\]\s*\{[^}]*min-width:\s*0/,
		);
		expect(styles).toMatch(
			/\.new-event-time-range\s+input\[type="time"\]\s*\{[^}]*display:\s*block[^}]*max-width:\s*100%/,
		);
	});
});
