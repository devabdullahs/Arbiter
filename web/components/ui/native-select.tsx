import type { ComponentPropsWithoutRef } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

type NativeSelectProps = ComponentPropsWithoutRef<"select"> & {
  wrapperClassName?: string;
};

export function NativeSelect({
  className,
  wrapperClassName,
  children,
  multiple,
  ...props
}: NativeSelectProps) {
  const selectClassName = cn(
    "border-input bg-background w-full rounded-lg border px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
    multiple ? "py-2" : "h-9 appearance-none pr-9",
    className,
  );

  if (multiple) {
    return (
      <select className={selectClassName} multiple {...props}>
        {children}
      </select>
    );
  }

  return (
    <div className={cn("relative", wrapperClassName)}>
      <select className={selectClassName} {...props}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}
