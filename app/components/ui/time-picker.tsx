import { CheckIcon, Clock3Icon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "~/lib/utils";
import { Button } from "./button";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

type TimePickerProps = {
	id: string;
	name?: string;
	value?: string;
	defaultValue?: string;
	onValueChange?: (value: string) => void;
	min?: string;
	max?: string;
	required?: boolean;
	disabled?: boolean;
	allowEndOfDay?: boolean;
	"aria-label"?: string;
	"aria-describedby"?: string;
	"aria-invalid"?: boolean;
	className?: string;
};

type TimePickerPanelProps = {
	value: string;
	onValueChange: (value: string) => void;
	min?: string;
	max?: string;
	allowEndOfDay?: boolean;
};

const pad = (value: number) => String(value).padStart(2, "0");

function timeParts(value: string) {
	const match = value.match(/^(\d{2}):(\d{2})$/);
	return match
		? { hour: match[1], minute: match[2] }
		: { hour: "09", minute: "00" };
}

function isAvailable(value: string, min?: string, max?: string) {
	return (!min || value >= min) && (!max || value <= max);
}

function isHourAvailable(hour: string, min?: string, max?: string) {
	const first = `${hour}:00`;
	const last = hour === "24" ? first : `${hour}:59`;
	return (!min || last >= min) && (!max || first <= max);
}

export function TimePickerPanel({
	value,
	onValueChange,
	min,
	max,
	allowEndOfDay = false,
}: TimePickerPanelProps) {
	const { hour, minute } = timeParts(value);
	const hours = Array.from({ length: allowEndOfDay ? 25 : 24 }, (_, index) =>
		pad(index),
	);
	const minutes = Array.from({ length: 60 }, (_, index) => pad(index));
	const selectedHourRef = useRef<HTMLButtonElement>(null);
	const selectedMinuteRef = useRef<HTMLButtonElement>(null);

	useEffect(() => {
		if (!value) return;
		selectedHourRef.current?.scrollIntoView?.({ block: "center" });
		selectedMinuteRef.current?.scrollIntoView?.({ block: "center" });
	}, [value]);

	const selectHour = (nextHour: string) => {
		let nextMinute = nextHour === "24" ? "00" : minute;
		let next = `${nextHour}:${nextMinute}`;
		if (!isAvailable(next, min, max) && min?.startsWith(`${nextHour}:`)) {
			nextMinute = min.slice(3, 5);
			next = `${nextHour}:${nextMinute}`;
		}
		if (!isAvailable(next, min, max) && max?.startsWith(`${nextHour}:`)) {
			nextMinute = max.slice(3, 5);
			next = `${nextHour}:${nextMinute}`;
		}
		if (isAvailable(next, min, max)) onValueChange(next);
	};
	const selectMinute = (nextMinute: string) => {
		const next = `${hour}:${hour === "24" ? "00" : nextMinute}`;
		if (isAvailable(next, min, max)) onValueChange(next);
	};

	return (
		<div className="grid gap-3 p-3">
			<div className="flex items-center justify-between rounded-xl bg-secondary px-4 py-3">
				<span className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
					<Clock3Icon className="size-4 text-primary" /> 選択中
				</span>
				<strong className="text-2xl tracking-tight text-foreground">
					{value}
				</strong>
			</div>
			<div className="grid grid-cols-[1fr_auto_1fr] gap-2">
				<div className="grid gap-1.5">
					<span className="text-center text-xs font-bold text-muted-foreground">
						時
					</span>
					<div
						role="listbox"
						aria-label="時"
						className="grid max-h-56 gap-1 overflow-y-auto overscroll-contain rounded-xl border border-border bg-muted/40 p-1.5"
					>
						{hours.map((item) => {
							const selected = item === hour;
							return (
								<button
									key={item}
									ref={selected ? selectedHourRef : undefined}
									type="button"
									role="option"
									aria-selected={selected}
									disabled={!isHourAvailable(item, min, max)}
									onClick={() => selectHour(item)}
									className={cn(
										"flex min-h-10 items-center justify-center gap-2 rounded-lg text-base font-extrabold outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/20 disabled:opacity-30",
										selected
											? "bg-primary text-white shadow-sm"
											: "bg-white text-foreground hover:bg-secondary",
									)}
								>
									{item}
									{selected && <CheckIcon className="size-3.5" />}
								</button>
							);
						})}
					</div>
				</div>
				<span className="pt-10 text-xl font-extrabold text-primary">:</span>
				<div className="grid gap-1.5">
					<span className="text-center text-xs font-bold text-muted-foreground">
						分
					</span>
					<div
						role="listbox"
						aria-label="分"
						className="grid max-h-56 gap-1 overflow-y-auto overscroll-contain rounded-xl border border-border bg-muted/40 p-1.5"
					>
						{minutes.map((item) => {
							const candidate = `${hour}:${hour === "24" ? "00" : item}`;
							const selected = item === minute;
							return (
								<button
									key={item}
									ref={selected ? selectedMinuteRef : undefined}
									type="button"
									role="option"
									aria-selected={selected}
									disabled={
										hour === "24"
											? item !== "00"
											: !isAvailable(candidate, min, max)
									}
									onClick={() => selectMinute(item)}
									className={cn(
										"flex min-h-10 items-center justify-center gap-2 rounded-lg text-base font-extrabold outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/20 disabled:opacity-30",
										selected
											? "bg-primary text-white shadow-sm"
											: "bg-white text-foreground hover:bg-secondary",
									)}
								>
									{item}
									{selected && <CheckIcon className="size-3.5" />}
								</button>
							);
						})}
					</div>
				</div>
			</div>
		</div>
	);
}

export function TimePicker({
	id,
	name,
	value,
	defaultValue = "09:00",
	onValueChange,
	min,
	max,
	required = false,
	disabled = false,
	allowEndOfDay = false,
	"aria-label": ariaLabel,
	"aria-describedby": ariaDescribedBy,
	"aria-invalid": ariaInvalid,
	className,
}: TimePickerProps) {
	const [open, setOpen] = useState(false);
	const [internalValue, setInternalValue] = useState(defaultValue);
	const currentValue = value ?? internalValue;
	const updateValue = (next: string) => {
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
					aria-label={ariaLabel ? `${ariaLabel} ${currentValue}` : undefined}
					aria-describedby={ariaDescribedBy}
					aria-invalid={ariaInvalid}
					className={cn(
						"border-input text-foreground flex h-14 w-full min-w-0 max-w-full items-center gap-3 rounded-xl border bg-white px-4 text-left text-lg font-extrabold shadow-[0_6px_18px_rgba(23,61,52,0.06)] outline-none transition-[border-color,box-shadow,background-color] hover:border-primary/50 focus-visible:border-ring focus-visible:bg-card focus-visible:ring-3 focus-visible:ring-ring/20 aria-invalid:border-destructive aria-invalid:ring-destructive/20 disabled:pointer-events-none disabled:opacity-50",
						className,
					)}
				>
					<span className="grid size-8 shrink-0 place-items-center rounded-lg bg-secondary text-primary">
						<Clock3Icon className="size-4" />
					</span>
					<span className="flex-1">{currentValue}</span>
					<span className="text-xs font-bold text-muted-foreground">変更</span>
				</button>
			</PopoverTrigger>
			<PopoverContent
				align="start"
				className="w-[min(20rem,calc(100vw-1.5rem))] overflow-hidden"
				collisionPadding={{ top: 88, right: 12, bottom: 12, left: 12 }}
			>
				<TimePickerPanel
					value={currentValue}
					onValueChange={updateValue}
					min={min}
					max={max}
					allowEndOfDay={allowEndOfDay}
				/>
				<div className="border-t border-border bg-muted/40 p-3">
					<Button
						type="button"
						size="sm"
						className="w-full"
						onClick={() => setOpen(false)}
					>
						この時刻にする
					</Button>
				</div>
			</PopoverContent>
		</Popover>
	);
}
