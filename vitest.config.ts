import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		alias: {
			"~": fileURLToPath(new URL("./app", import.meta.url)),
		},
	},
	test: {
		environment: "happy-dom",
		exclude: [...configDefaults.exclude, "test/browser/**"],
	},
});
