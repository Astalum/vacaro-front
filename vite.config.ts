import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
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
		tsconfigPaths: true,
	},
});
