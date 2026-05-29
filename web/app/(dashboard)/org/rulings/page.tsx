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
import { Input } from "@/components/ui/input";
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
import { RESULT_LABEL_OPTIONS } from "@/lib/score-format";

import { deleteOrgRulingPreset, upsertOrgRulingPreset } from "../actions";

function canManage(role: OrgMemberRole | undefined) {
  return (
    role === OrgMemberRole.OWNER ||
    role === OrgMemberRole.ADMIN ||
    role === OrgMemberRole.MANAGER ||
    role === OrgMemberRole.HEAD_REF
  );
}

function formatAppliesTo(value: string) {
  if (value === "subject_wins") return "Subject wins";
  if (value === "no_contest") return "No contest";
  return "Subject loses";
}

export default async function OrgRulingsPage() {
  const ctx = await getAccessContext();
  if (!ctx) return null;

  if (ctx.orgIds.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Rulings" />
        <NoOrgAccess discordId={ctx.discordId} />
      </div>
    );
  }

  const roleByOrg = new Map(ctx.orgs.map((org) => [org.id, org.role]));
  const orgs = await prisma.organization.findMany({
    where: { id: { in: ctx.orgIds } },
    orderBy: { name: "asc" },
    include: { rulingPresets: { orderBy: { label: "asc" } } },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ruling presets"
        description="Reusable DQ, forfeit, no-contest, and admin-decision templates."
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
                    These templates keep referee rulings consistent across events.
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
                    <TableHead>Ruling</TableHead>
                    <TableHead>Label</TableHead>
                    <TableHead>Default score</TableHead>
                    <TableHead>Applies to</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {org.rulingPresets.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-muted-foreground py-8 text-center"
                      >
                        No ruling presets yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    org.rulingPresets.map((preset) => (
                      <TableRow key={preset.id}>
                        <TableCell>
                          <div className="font-medium">{preset.label}</div>
                          <div className="text-muted-foreground text-xs">
                            {preset.key}
                          </div>
                        </TableCell>
                        <TableCell>{preset.resultLabel}</TableCell>
                        <TableCell className="tabular-nums">
                          {preset.defaultSubjectScore}-{preset.defaultOpponentScore}
                        </TableCell>
                        <TableCell>{formatAppliesTo(preset.appliesTo)}</TableCell>
                        <TableCell className="text-right">
                          {editable ? (
                            <form action={deleteOrgRulingPreset}>
                              <input type="hidden" name="presetId" value={preset.id} />
                              <ConfirmSubmitButton
                                type="submit"
                                size="sm"
                                variant="ghost"
                                confirmMessage={`Delete the ${preset.label} ruling preset?`}
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
                <form action={upsertOrgRulingPreset} className="flex flex-col gap-3 rounded-lg border p-3">
                  <input type="hidden" name="organizationId" value={org.id} />
                  <div>
                    <h2 className="text-sm font-medium">Create or update ruling</h2>
                    <p className="text-muted-foreground text-xs">
                      Use names like Team forfeit, Player DQ, Admin no-contest.
                    </p>
                  </div>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium">Ruling name</span>
                    <Input name="label" required maxLength={80} placeholder="Team forfeit" />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium">Result label</span>
                    <NativeSelect name="resultLabel" defaultValue="FT" className="h-9">
                      {RESULT_LABEL_OPTIONS.filter((option) => option.value).map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </NativeSelect>
                  </label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="flex flex-col gap-1 text-sm">
                      <span className="font-medium">Subject score</span>
                      <Input
                        name="defaultSubjectScore"
                        type="number"
                        min={0}
                        max={99}
                        defaultValue={0}
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                      <span className="font-medium">Opponent score</span>
                      <Input
                        name="defaultOpponentScore"
                        type="number"
                        min={0}
                        max={99}
                        defaultValue={3}
                      />
                    </label>
                  </div>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium">How to apply</span>
                    <NativeSelect name="appliesTo" defaultValue="subject_loses" className="h-9">
                      <option value="subject_loses">Subject team loses</option>
                      <option value="subject_wins">Subject team wins</option>
                      <option value="no_contest">No contest</option>
                    </NativeSelect>
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium">Default note</span>
                    <textarea
                      name="notes"
                      rows={4}
                      maxLength={500}
                      placeholder="Optional ruling context or rule reference"
                      className="border-input bg-background rounded-lg border px-2.5 py-2 text-sm outline-none"
                    />
                  </label>
                  <PendingSubmitButton pendingChildren="Saving ruling...">
                    Save ruling
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
