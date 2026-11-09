import { redirect } from "react-router";
import type { Route } from "./+types/legacy-calendar-settings";

export function loader({ params, request }: Route.LoaderArgs) {
	if (
		params.calendarProvider !== "icloud" &&
		params.calendarProvider !== "timetree"
	) {
		throw new Response("Not Found", { status: 404 });
	}
	return redirect(
		`/calendars/${params.calendarProvider}${new URL(request.url).search}`,
		302,
	);
}
