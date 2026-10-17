import { describe, expect, it } from "vitest";
import {
	createPageMeta,
	DEFAULT_DESCRIPTION,
	OGP_IMAGE_URL,
} from "~/lib/meta";

describe("createPageMeta", () => {
	it("creates Open Graph and X card metadata for a page", () => {
		const meta = createPageMeta("イベント一覧 | vacaro");

		expect(meta).toContainEqual({ title: "イベント一覧 | vacaro" });
		expect(meta).toContainEqual({
			name: "description",
			content: DEFAULT_DESCRIPTION,
		});
		expect(meta).toContainEqual({
			property: "og:title",
			content: "イベント一覧 | vacaro",
		});
		expect(meta).toContainEqual({
			property: "og:image",
			content: OGP_IMAGE_URL,
		});
		expect(meta).toContainEqual({
			name: "twitter:card",
			content: "summary_large_image",
		});
	});

	it("uses a route-specific description when provided", () => {
		const meta = createPageMeta("利用規約 | vacaro", "利用条件です。");

		expect(meta).toContainEqual({
			property: "og:description",
			content: "利用条件です。",
		});
		expect(meta).toContainEqual({
			name: "twitter:description",
			content: "利用条件です。",
		});
	});
});
