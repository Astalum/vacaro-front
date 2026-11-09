import { redirect } from "react-router";
export function loader({ request }: { request: Request }) {
	return redirect(
		`/account${new URL(request.url).search}#calendar-settings`,
		302,
	);
}
