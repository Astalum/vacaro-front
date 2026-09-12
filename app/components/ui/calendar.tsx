import {
	ChevronDownIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
	ChevronUpIcon,
} from "lucide-react";
import type * as React from "react";
import { DayPicker, getDefaultClassNames } from "react-day-picker";
import { cn } from "~/lib/utils";

export function Calendar({
	className,
	classNames,
	showOutsideDays = true,
	...props
}: React.ComponentProps<typeof DayPicker>) {
	const defaultClassNames = getDefaultClassNames();

	return (
		<DayPicker
			showOutsideDays={showOutsideDays}
			className={cn("p-3", className)}
			classNames={{
				root: cn("w-fit", defaultClassNames.root),
				months: "relative flex flex-col gap-4 sm:flex-row",
				month: "flex w-full flex-col gap-4",
				month_caption: "flex h-9 items-center justify-center px-10",
				caption_label: "text-base font-extrabold text-foreground",
				nav: "absolute inset-x-0 top-0 flex h-9 items-center justify-between",
				button_previous:
					"grid size-9 place-items-center rounded-lg border border-border bg-white text-primary outline-none transition-colors hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring/20 disabled:opacity-40",
				button_next:
					"grid size-9 place-items-center rounded-lg border border-border bg-white text-primary outline-none transition-colors hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring/20 disabled:opacity-40",
				month_grid: "w-full border-collapse",
				weekdays: "flex",
				weekday: "w-9 py-2 text-center text-sm font-bold text-muted-foreground",
				week: "mt-1 flex w-full",
				day: "relative size-9 p-0 text-center text-sm [&:has([aria-selected])]:rounded-lg [&:has([aria-selected])]:bg-primary [&:has([aria-selected])]:text-white",
				day_button:
					"grid size-9 place-items-center rounded-lg font-semibold outline-none transition-colors hover:bg-secondary hover:text-secondary-foreground focus-visible:ring-3 focus-visible:ring-ring/20",
				today:
					"rounded-lg bg-secondary font-extrabold text-secondary-foreground",
				outside: "text-muted-foreground opacity-35",
				disabled: "pointer-events-none text-muted-foreground opacity-30",
				hidden: "invisible",
				selected: "rounded-lg bg-primary text-white shadow-sm",
				range_start: "rounded-l-lg bg-primary text-white",
				range_middle: "rounded-none bg-secondary text-secondary-foreground",
				range_end: "rounded-r-lg bg-primary text-white",
				...classNames,
			}}
			components={{
				Chevron: ({ className: iconClassName, orientation }) => {
					const Icon =
						orientation === "left"
							? ChevronLeftIcon
							: orientation === "right"
								? ChevronRightIcon
								: orientation === "up"
									? ChevronUpIcon
									: ChevronDownIcon;
					return <Icon className={cn("size-4", iconClassName)} />;
				},
				...props.components,
			}}
			{...props}
		/>
	);
}
