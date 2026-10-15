import { AlertCircleIcon } from "lucide-react";
import type * as React from "react";
import { cn } from "~/lib/utils";

type ValidationMessageProps = React.ComponentProps<"div"> & {
	title?: string;
	compact?: boolean;
	fields?: Record<string, string> | null;
};

export function ValidationMessage({
	title = "入力内容を確認してください",
	compact = false,
	fields,
	className,
	children,
	...props
}: ValidationMessageProps) {
	return (
		<div
			role="alert"
			className={cn(
				"validation-message",
				compact && "validation-message-compact",
				className,
			)}
			{...props}
		>
			<span className="validation-message-icon" aria-hidden="true">
				<AlertCircleIcon size={20} />
			</span>
			<div className="validation-message-content">
				<strong>{title}</strong>
				{fields && Object.keys(fields).length > 0 ? (
					<ul>
						{Object.entries(fields).map(([name, message]) => (
							<li key={name}>{message}</li>
						))}
					</ul>
				) : children ? (
					<div>{children}</div>
				) : null}
			</div>
		</div>
	);
}

export function FieldError({
	className,
	children,
	...props
}: React.ComponentProps<"p">) {
	if (!children) return null;
	return (
		<p className={cn("field-error", className)} {...props}>
			<AlertCircleIcon size={16} aria-hidden="true" />
			<span className="field-error-text">{children}</span>
		</p>
	);
}
