import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Page } from "@playwright/test";

// Keep the application's real fonts while avoiding repeated CDN downloads for
// every isolated page/viewport. Only public font assets are cached.
export async function cachePublicFonts(page: Page) {
	const directory = join(tmpdir(), "vacaro-layout-font-cache");
	await mkdir(directory, { recursive: true });
	await page.route(
		/^https:\/\/fonts\.(googleapis|gstatic)\.com\//,
		async (route) => {
			const key = createHash("sha256")
				.update(route.request().url())
				.digest("hex");
			const path = join(directory, key);
			let cached: { body: string; contentType: string };
			try {
				cached = JSON.parse(await readFile(path, "utf8"));
			} catch {
				const response = await route.fetch();
				if (!response.ok())
					throw new Error(
						`Font request failed: ${response.status()} ${route.request().url()}`,
					);
				cached = {
					body: (await response.body()).toString("base64"),
					contentType: response.headers()["content-type"],
				};
				const temporary = `${path}.${randomUUID()}`;
				await writeFile(temporary, JSON.stringify(cached));
				await rename(temporary, path);
			}
			await route.fulfill({
				body: Buffer.from(cached.body, "base64"),
				contentType: cached.contentType,
				headers: { "access-control-allow-origin": "*" },
			});
		},
	);
}
