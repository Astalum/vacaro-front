import type * as React from "react";
import { cn } from "~/lib/utils";

const variants = {
	default:
		"bg-[var(--button-emerald)] text-[var(--button-emerald-foreground)] shadow-sm hover:bg-[var(--button-emerald-hover)] focus-visible:ring-primary/25",
	secondary:
		"bg-secondary text-secondary-foreground hover:bg-secondary/80 focus-visible:ring-ring/20",
	outline:
		"border border-border bg-background text-foreground shadow-xs hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring/20",
	ghost:
		"text-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring/20",
	destructive:
		"bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/25",
};

const sizes = {
	default: "h-11 px-5 text-base",
	sm: "h-9 rounded-lg px-3 text-sm",
	lg: "h-14 rounded-xl px-8 text-lg",
	icon: "size-11",
};

export function Button({
	className,
	variant = "default",
	size = "default",
	type = "button",
	...props
}: React.ComponentProps<"button"> & {
	variant?: keyof typeof variants;
	size?: keyof typeof sizes;
}) {
	return (
		<button
			type={type}
			data-slot="button"
			className={cn(
				"inline-flex shrink-0 items-center justify-center gap-2 rounded-lg font-bold whitespace-nowrap outline-none transition-[background-color,color,box-shadow,transform] focus-visible:ring-3 disabled:pointer-events-none disabled:opacity-50 active:translate-y-px",
				variants[variant],
				sizes[size],
				className,
			)}
			{...props}
		/>
	);
}
