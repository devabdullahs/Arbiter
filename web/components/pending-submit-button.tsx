"use client";

import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";

type Props = ComponentPropsWithoutRef<typeof Button> & {
  pendingChildren?: ReactNode;
};

export function PendingSubmitButton({
  children,
  pendingChildren = "Working...",
  disabled,
  ...props
}: Props) {
  const { pending } = useFormStatus();

  return (
    <Button
      {...props}
      type="submit"
      disabled={disabled || pending}
      aria-busy={pending}
    >
      {pending ? (
        <>
          <LoaderCircle data-icon="inline-start" className="animate-spin" />
          <span>{pendingChildren}</span>
        </>
      ) : (
        children
      )}
    </Button>
  );
}
