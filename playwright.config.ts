import { defineConfig } from "@playwright/test";

const viewports = [
	{ name: "phone-320", width: 320, height: 740 },
	{ name: "phone-375", width: 375, height: 812 },
	{ name: "phone-390", width: 390, height: 844 },
	{ name: "phone-430", width: 430, height: 932 },
	{ name: "landscape", width: 667, height: 375 },
	{ name: "tablet-768", width: 768, height: 1024 },
	{ name: "desktop-1024", width: 1024, height: 900 },
	{ name: "desktop-1440", width: 1440, height: 1000 },
];

export default defineConfig({
	testDir: "./test/browser",
	fullyParallel: true,
	workers: 2,
	timeout: 45_000,
	retries: 0,
	reporter: [["list"], ["html", { open: "never" }]],
	use: {
		browserName: "webkit",
		baseURL: process.env.LAYOUT_BASE_URL ?? "http://127.0.0.1:8080",
		locale: "ja-JP",
		timezoneId: "Asia/Tokyo",
		screenshot: "only-on-failure",
		trace: "retain-on-failure",
	},
	projects: [
		...viewports.map(({ name, ...viewport }) => ({
			name: `webkit-${name}`,
			testMatch: "**/layout.spec.ts",
			use: {
				viewport,
				isMobile: viewport.width < 768,
				hasTouch: viewport.width < 1024,
			},
		})),
		{
			name: "webkit-breakpoints",
			testMatch: "**/breakpoints.spec.ts",
			use: { viewport: { width: 720, height: 1000 } },
		},
	],
	webServer: {
		command: "pnpm dev --host 127.0.0.1",
		url: "http://127.0.0.1:8080",
		reuseExistingServer: !process.env.CI,
		timeout: 60_000,
	},
});
