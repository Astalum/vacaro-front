import { redirect } from "react-router";
export function loader({ request }: { request: Request }) {
	return redirect(`/account${new URL(request.url).search}#timetree-guide`, 302);
}
