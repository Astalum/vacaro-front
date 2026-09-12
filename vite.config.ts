import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
	cacheDir: ".react-router/vite",
	optimizeDeps: {
		include: [
			"@radix-ui/react-popover",
			"@radix-ui/react-select",
			"date-fns",
			"date-fns/locale",
			"lucide-react",
			"react-day-picker",
		],
	},
	plugins: [tailwindcss(), reactRouter()],
	server: {
		port: 3000,
		proxy: {
			"/api": {
				target: process.env.VACARO_API_URL ?? "http://localhost:8080",
				changeOrigin: true,
			},
		},
	},
	resolve: {
		dedupe: ["react", "react-dom"],
		tsconfigPaths: true,
	},
});
