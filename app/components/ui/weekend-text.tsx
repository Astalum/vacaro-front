function weekendTextParts(children: string) {
	let offset = 0;
	const parts = children
		.split(/(\(土\)|\(日\)|（土）|（日）|土曜日|日曜日)/g)
		.filter(Boolean)
		.map((text) => {
			const start = offset;
			offset += text.length;
			const className = /(?:\(土\)|（土）|土曜日)$/.test(text)
				? "weekday-saturday"
				: /^(?:\(日\)|（日）|日曜日)$/.test(text)
					? "weekday-sunday"
					: undefined;
			return { start, text, className };
		});

	return parts;
}

export function WeekendText({ children }: { children: string }) {
	const parts = weekendTextParts(children);
	return (
		<>
			{parts.map(({ start, text, className }) => (
				<span key={`${start}-${text}`} className={className}>
					{text}
				</span>
			))}
		</>
	);
}
