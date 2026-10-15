import { ChevronDownIcon, type LucideIcon } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "~/lib/utils";

type PickerTriggerProps = ComponentProps<"button"> & {
	icon: LucideIcon;
	placeholder?: boolean;
};

export function PickerTrigger({
	icon: Icon,
	placeholder,
	className,
	children,
	...props
}: PickerTriggerProps) {
	return (
		<button
			type="button"
			className={cn("picker-trigger w-full min-w-0 max-w-full", className)}
			{...props}
		>
			<span className="picker-trigger-icon" aria-hidden="true">
				<Icon size={18} />
			</span>
			<span
				className="picker-trigger-value"
				data-placeholder={placeholder || undefined}
			>
				{children}
			</span>
			<ChevronDownIcon
				className="picker-trigger-chevron"
				size={16}
				aria-hidden="true"
			/>
		</button>
	);
}
