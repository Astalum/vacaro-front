import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { CalendarIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { WeekendText } from "~/components/app";
import { cn } from "~/lib/utils";
import { Button } from "./button";
import { Calendar } from "./calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

type DatePickerProps = {
	id: string;
	name?: string;
	value?: string;
	defaultValue?: string;
	onValueChange?: (value: string) => void;
	required?: boolean;
	disabled?: boolean;
	"aria-label"?: string;
	"aria-describedby"?: string;
	"aria-invalid"?: boolean;
	className?: string;
};

const pad = (value: number) => String(value).padStart(2, "0");

function parseDate(value?: string) {
	const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
	return match
		? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
		: undefined;
}

function serializeDate(date?: Date) {
	return date
		? `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
		: "";
}

export function DatePicker({
	id,
	name,
	value,
	defaultValue,
	onValueChange,
	required = false,
	disabled = false,
	"aria-label": ariaLabel,
	"aria-describedby": ariaDescribedBy,
	"aria-invalid": ariaInvalid,
	className,
}: DatePickerProps) {
	const [open, setOpen] = useState(false);
	const [internalValue, setInternalValue] = useState(defaultValue ?? "");
	const currentValue = value ?? internalValue;
	const selected = parseDate(currentValue);
	const updateValue = (date?: Date) => {
		const next = serializeDate(date);
		if (value === undefined) setInternalValue(next);
		onValueChange?.(next);
	};

	return (
		<Popover open={open} onOpenChange={setOpen}>
			{name && <input type="hidden" name={name} value={currentValue} />}
			<PopoverTrigger asChild>
				<button
					id={id}
					type="button"
					disabled={disabled}
					data-required={required || undefined}
					aria-label={ariaLabel}
					aria-describedby={ariaDescribedBy}
					aria-invalid={ariaInvalid}
					className={cn(
						"border-input text-foreground flex h-14 w-full min-w-0 max-w-full items-center gap-3 rounded-xl border bg-white px-4 text-left text-base font-extrabold shadow-[0_6px_18px_rgba(23,61,52,0.06)] outline-none transition-[border-color,box-shadow,background-color] hover:border-primary/50 focus-visible:border-ring focus-visible:bg-card focus-visible:ring-3 focus-visible:ring-ring/20 aria-invalid:border-destructive aria-invalid:ring-destructive/20 disabled:pointer-events-none disabled:opacity-50",
						className,
					)}
				>
					<span className="grid size-8 shrink-0 place-items-center rounded-lg bg-secondary text-primary">
						<CalendarIcon className="size-4" />
					</span>
					<span
						className={cn(
							"min-w-0 flex-1 truncate",
							!selected && "text-muted-foreground",
						)}
					>
						{selected ? (
							<WeekendText>
								{format(selected, "yyyy年M月d日(E)", { locale: ja })}
							</WeekendText>
						) : (
							"日付を選択"
						)}
					</span>
				</button>
			</PopoverTrigger>
			<PopoverContent
				align="start"
				className="w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden"
				collisionPadding={{ top: 88, right: 12, bottom: 12, left: 12 }}
			>
				<Calendar
					mode="single"
					required={required}
					selected={selected}
					onSelect={(date: Date | undefined) => {
						updateValue(date);
						if (date) setOpen(false);
					}}
					defaultMonth={selected}
					locale={ja}
					fixedWeeks
				/>
				{!required && selected && (
					<div className="border-t border-border bg-muted/40 p-3">
						<Button
							type="button"
							variant="ghost"
							size="sm"
							className="w-full"
							onClick={() => updateValue(undefined)}
						>
							<XIcon className="size-4" /> 選択をクリア
						</Button>
					</div>
				)}
			</PopoverContent>
		</Popover>
	);
}
