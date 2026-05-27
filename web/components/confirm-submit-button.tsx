"use client";

import type { ComponentPropsWithoutRef } from "react";
import { useRef, useState } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = ComponentPropsWithoutRef<typeof Button> & {
  confirmMessage: string;
  confirmTitle?: string;
  confirmActionLabel?: string;
};

export function ConfirmSubmitButton({
  confirmMessage,
  confirmTitle = "Are you sure?",
  confirmActionLabel = "Confirm",
  children,
  disabled,
  className,
  ...props
}: Props) {
  const [open, setOpen] = useState(false);
  const submitRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <Button
        {...props}
        type="button"
        disabled={disabled}
        className={className}
        onClick={() => setOpen(true)}
      >
        {children}
      </Button>
      <button
        ref={submitRef}
        type="submit"
        className="hidden"
        tabIndex={-1}
        aria-hidden="true"
        disabled={disabled}
      />
      <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/45 backdrop-blur-xs data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <DialogPrimitive.Content
            className={cn(
              "bg-background fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border p-5 shadow-lg",
              "data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            )}
          >
            <DialogPrimitive.Title className="text-lg font-semibold">
              {confirmTitle}
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="text-muted-foreground mt-2 text-sm leading-6">
              {confirmMessage}
            </DialogPrimitive.Description>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <DialogPrimitive.Close asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </DialogPrimitive.Close>
              <Button
                type="button"
                variant={props.variant === "destructive" ? "destructive" : "default"}
                onClick={() => {
                  setOpen(false);
                  submitRef.current?.form?.requestSubmit(submitRef.current);
                }}
              >
                {confirmActionLabel}
              </Button>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}
