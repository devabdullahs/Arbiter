import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { NoOrgAccess, PageHeader } from "@/components/dashboard-ui";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getAccessContext } from "@/lib/auth-session";
import { OrgMemberRole } from "@/lib/generated/prisma";
import { prisma } from "@/lib/prisma";

import { deleteOrgRulesPreset, upsertOrgRulesPreset } from "../actions";

function canManage(role: OrgMemberRole | undefined) {
  return (
    role === OrgMemberRole.OWNER ||
    role === OrgMemberRole.ADMIN ||
    role === OrgMemberRole.MANAGER ||
    role === OrgMemberRole.HEAD_REF
  );
}

export default async function OrgPresetsPage() {
  const ctx = await getAccessContext();
  if (!ctx) return null;

  if (ctx.orgIds.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Presets" />
        <NoOrgAccess discordId={ctx.discordId} />
      </div>
    );
  }

  const roleByOrg = new Map(ctx.orgs.map((org) => [org.id, org.role]));
  const orgs = await prisma.organization.findMany({
    where: { id: { in: ctx.orgIds } },
    orderBy: { name: "asc" },
    include: { rulesPresets: { orderBy: { label: "asc" } } },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rules presets"
        description="Map pools, character pools, and default veto modes per game."
      />

      {orgs.map((org) => {
        const editable = canManage(roleByOrg.get(org.id));
        return (
          <Card key={org.id}>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base">{org.name}</CardTitle>
                  <CardDescription>
                    Presets are available when creating or editing matches.
                  </CardDescription>
                </div>
                <Badge variant="secondary">
                  {(roleByOrg.get(org.id) ?? "").toLowerCase()}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.75fr)]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Preset</TableHead>
                    <TableHead>Game</TableHead>
                    <TableHead>Veto</TableHead>
                    <TableHead>Maps</TableHead>
                    <TableHead>Characters</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {org.rulesPresets.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-muted-foreground py-8 text-center"
                      >
                        No presets yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    org.rulesPresets.map((preset) => (
                      <TableRow key={preset.id}>
                        <TableCell>
                          <div className="font-medium">{preset.label}</div>
                          <div className="text-muted-foreground text-xs">
                            {preset.key}
                          </div>
                        </TableCell>
                        <TableCell>{preset.gameTitle ?? "-"}</TableCell>
                        <TableCell>{preset.vetoMode.replaceAll("_", " ")}</TableCell>
                        <TableCell>
                          {Array.isArray(preset.mapPool) ? preset.mapPool.length : 0}
                        </TableCell>
                        <TableCell>
                          {Array.isArray(preset.characterPool)
                            ? preset.characterPool.length
                            : 0}
                        </TableCell>
                        <TableCell className="text-right">
                          {editable ? (
                            <form action={deleteOrgRulesPreset}>
                              <input type="hidden" name="presetId" value={preset.id} />
                              <ConfirmSubmitButton
                                type="submit"
                                size="sm"
                                variant="ghost"
                                confirmMessage={`Delete the ${preset.label} preset?`}
                              >
                                Delete
                              </ConfirmSubmitButton>
                            </form>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>

              {editable ? (
                <form action={upsertOrgRulesPreset} className="flex flex-col gap-3 rounded-lg border p-3">
                  <input type="hidden" name="organizationId" value={org.id} />
                  <div>
                    <h2 className="text-sm font-medium">Create or update preset</h2>
                    <p className="text-muted-foreground text-xs">
                      Reusing the same preset name updates that preset.
                    </p>
                  </div>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium">Preset name</span>
                    <input
                      name="label"
                      required
                      maxLength={80}
                      placeholder="SEL Overwatch First to 3"
                      className="border-input bg-background h-9 rounded-lg border px-2.5 text-sm"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium">Game</span>
                    <input
                      name="gameTitle"
                      maxLength={80}
                      placeholder="Overwatch 2"
                      className="border-input bg-background h-9 rounded-lg border px-2.5 text-sm"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium">Default veto mode</span>
                    <NativeSelect name="vetoMode" defaultValue="series_picks" className="h-9">
                      <option value="series_picks">Series picks</option>
                      <option value="final_map_ban">Final map from bans</option>
                      <option value="manual_picks">Manual picks</option>
                    </NativeSelect>
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium">Maps / game pool</span>
                    <textarea
                      name="mapPool"
                      required
                      rows={7}
                      placeholder="One map per line"
                      className="border-input bg-background rounded-lg border px-2.5 py-2 text-sm outline-none"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium">Characters / agents / heroes</span>
                    <textarea
                      name="characterPool"
                      rows={7}
                      placeholder="Optional, one character per line"
                      className="border-input bg-background rounded-lg border px-2.5 py-2 text-sm outline-none"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium">Notes</span>
                    <textarea
                      name="notes"
                      rows={3}
                      maxLength={500}
                      placeholder="Optional referee notes"
                      className="border-input bg-background rounded-lg border px-2.5 py-2 text-sm outline-none"
                    />
                  </label>
                  <PendingSubmitButton pendingChildren="Saving preset...">
                    Save preset
                  </PendingSubmitButton>
                </form>
              ) : null}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
