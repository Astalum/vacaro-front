// @vitest-environment node

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(
	new URL("../../../app/styles/routes/events/index.scss", import.meta.url),
	"utf8",
);

describe("event section ordering", () => {
	it("shows closed events on the left and accepting events on the right", () => {
		expect(styles).toMatch(
			/\.event-section-accepting\s*\{[^}]*grid-column:\s*2[^}]*grid-row:\s*1/,
		);
		expect(styles).toMatch(
			/\.event-section-closed\s*\{[^}]*grid-column:\s*1[^}]*grid-row:\s*1/,
		);
	});

	it("restores document order with accepting events first on mobile", () => {
		expect(styles).toMatch(
			/@media\s*\(max-width:\s*900px\)[\s\S]*?\.event-section-accepting,\s*\.event-section-closed\s*\{[^}]*grid-column:\s*auto[^}]*grid-row:\s*auto/,
		);
	});
});
