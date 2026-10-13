import { AlertCircleIcon } from "lucide-react";
import type * as React from "react";
import { cn } from "~/lib/utils";

type ValidationMessageProps = React.ComponentProps<"div"> & {
	title?: string;
	compact?: boolean;
};

export function ValidationMessage({
	title = "入力内容を確認してください",
	compact = false,
	className,
	children,
	...props
}: ValidationMessageProps) {
	return (
		<div
			role="alert"
			className={cn(
				"flex items-start gap-3 rounded-2xl border border-destructive/25 bg-destructive/10 text-destructive shadow-[0_10px_30px_rgba(176,69,53,0.08)]",
				compact ? "px-3 py-2.5" : "p-4",
				className,
			)}
			{...props}
		>
			<span
				className={cn(
					"grid shrink-0 place-items-center rounded-xl bg-destructive text-white shadow-sm",
					compact ? "size-8" : "size-10",
				)}
			>
				<AlertCircleIcon className={compact ? "size-4" : "size-5"} />
			</span>
			<span className="grid min-w-0 gap-1 pt-0.5">
				<strong className="text-sm font-extrabold text-foreground">
					{title}
				</strong>
				<span className="text-sm font-semibold leading-relaxed">
					{children}
				</span>
			</span>
		</div>
	);
}

export function FieldError({
	className,
	children,
	...props
}: React.ComponentProps<"p">) {
	return (
		<p
			className={cn(
				"flex items-start gap-2 text-sm font-bold leading-relaxed text-destructive",
				className,
			)}
			{...props}
		>
			<span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-destructive text-xs text-white">
				!
			</span>
			<span>{children}</span>
		</p>
	);
}
