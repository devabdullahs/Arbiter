"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { KeyRound, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { friendlyPasskeyError } from "@/lib/auth-errors";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

import { deletePasskey, renamePasskey } from "./actions";

type PasskeyRow = {
  id: string;
  name: string | null;
  deviceType: string;
  backedUp: boolean;
  transports: string | null;
  createdAt: string | null;
  lastUsedAt: string | null;
};

export function PasskeyManager({ passkeys }: { passkeys: PasskeyRow[] }) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [passkeyName, setPasskeyName] = useState("");
  const [pending, setPending] = useState(false);
  const [isMutating, startMutation] = useTransition();

  async function handleAddPasskey(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = passkeyName.trim();
    if (!name) {
      toast.error("Name this passkey before registering it.");
      return;
    }

    setPending(true);
    const res = await authClient.passkey.addPasskey({
      name,
    });
    setPending(false);

    if (res?.error) {
      toast.error(friendlyPasskeyError(res.error.message));
      return;
    }

    toast.success("Passkey registered. You can use it to sign in next time.");
    setPasskeyName("");
    setDialogOpen(false);
    router.refresh();
  }

  function handleCancelAdd() {
    if (pending) return;
    setPasskeyName("");
    setDialogOpen(false);
  }

  function handleRename(formData: FormData) {
    startMutation(async () => {
      try {
        await renamePasskey(formData);
        toast.success("Passkey renamed.");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not rename passkey.");
      }
    });
  }

  function handleDelete(formData: FormData) {
    startMutation(async () => {
      try {
        await deletePasskey(formData);
        toast.success("Passkey deleted.");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not delete passkey.");
      }
    });
  }

  return (
    <div className="space-y-6">
      <DialogPrimitive.Root
        open={dialogOpen}
        onOpenChange={(open) => {
          if (pending) return;
          setDialogOpen(open);
          if (!open) setPasskeyName("");
        }}
      >
        <DialogPrimitive.Trigger asChild>
          <Button type="button">
            <KeyRound className="mr-2 h-4 w-4" />
            Add Passkey
          </Button>
        </DialogPrimitive.Trigger>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <DialogPrimitive.Content
            className={cn(
              "bg-background fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border p-6 shadow-lg",
              "data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            )}
          >
            <DialogPrimitive.Title className="text-lg font-semibold">
              Name this passkey
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="text-muted-foreground mt-1 text-sm">
              Choose a name that helps you recognize the device later.
            </DialogPrimitive.Description>
            <form onSubmit={handleAddPasskey} className="mt-5 space-y-4">
              <Input
                value={passkeyName}
                onChange={(e) => setPasskeyName(e.target.value)}
                placeholder="Windows Hello on laptop"
                maxLength={64}
                required
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancelAdd}
                  disabled={pending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={pending}>
                  Save And Register
                </Button>
              </div>
            </form>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <div className="divide-y rounded-md border">
        {passkeys.length === 0 ? (
          <div className="text-muted-foreground p-6 text-center text-sm">
            No passkeys registered yet.
          </div>
        ) : (
          passkeys.map((passkey) => (
            <div key={passkey.id} className="grid gap-3 p-4 lg:grid-cols-[1fr_auto]">
              <div className="space-y-1">
                <p className="font-medium">{passkey.name || "Unnamed passkey"}</p>
                <p className="text-muted-foreground text-sm">
                  {passkey.deviceType} - {passkey.backedUp ? "synced" : "not synced"}
                  {passkey.transports ? ` - ${passkey.transports}` : ""}
                  {passkey.createdAt ? ` - added ${passkey.createdAt}` : ""}
                  {" - "}
                  {passkey.lastUsedAt ? `last used ${passkey.lastUsedAt}` : "never used"}
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <form action={handleRename} className="flex gap-2">
                  <input type="hidden" name="id" value={passkey.id} />
                  <Input
                    name="name"
                    defaultValue={passkey.name ?? ""}
                    placeholder="Rename passkey"
                    maxLength={64}
                    className="w-52"
                  />
                  <Button type="submit" variant="outline" disabled={isMutating}>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Rename
                  </Button>
                </form>

                <form action={handleDelete}>
                  <input type="hidden" name="id" value={passkey.id} />
                  <Button type="submit" variant="destructive" disabled={isMutating}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </form>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
