"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { KeyRound, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { friendlyPasskeyError } from "@/lib/auth-errors";
import { authClient } from "@/lib/auth-client";

import { deletePasskey, renamePasskey } from "./actions";

type PasskeyRow = {
  id: string;
  name: string | null;
  deviceType: string;
  backedUp: boolean;
  transports: string | null;
  createdAt: string | null;
};

export function PasskeyManager({ passkeys }: { passkeys: PasskeyRow[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [isMutating, startMutation] = useTransition();

  async function handleAddPasskey(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const res = await authClient.passkey.addPasskey({
      name: name.trim() || undefined,
    });
    setPending(false);

    if (res?.error) {
      toast.error(friendlyPasskeyError(res.error.message));
      return;
    }

    toast.success("Passkey registered. You can use it to sign in next time.");
    setName("");
    router.refresh();
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
      <form onSubmit={handleAddPasskey} className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Passkey name, e.g. Windows Hello on laptop"
          maxLength={64}
        />
        <Button type="submit" disabled={pending} className="sm:w-44">
          <KeyRound className="mr-2 h-4 w-4" />
          Add Passkey
        </Button>
      </form>

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
