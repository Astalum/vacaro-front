import { Link } from "react-router";
import { Icon, PageShell } from "../components/ui";

export function meta() {
	return [{ title: "ページが見つかりません | vacaro" }];
}

export default function NotFound() {
	return (
		<PageShell>
			<div className="not-found">
				<span>404</span>
				<div className="empty-calendar">
					<Icon name="calendar" size={42} />
				</div>
				<h1>ページが見つかりません</h1>
				<p>URLが間違っているか、イベントの公開が終了した可能性があります。</p>
				<Link className="button button-primary" to="/">
					トップへ戻る <Icon name="arrow" size={17} />
				</Link>
			</div>
		</PageShell>
	);
}
