import { LinkDiscordButton } from "@/components/link-discord";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {description ? (
        <p className="text-muted-foreground text-sm">{description}</p>
      ) : null}
    </div>
  );
}

export function NoOrgAccess({ discordId }: { discordId: string | null }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">No organization access</CardTitle>
        <CardDescription>
          {discordId
            ? "Your linked Discord account isn't an owner, admin, or referee in any organization the bot manages."
            : "Link your Discord account to access the organizations where you're an admin or referee."}
        </CardDescription>
      </CardHeader>
      {!discordId ? (
        <CardContent>
          <LinkDiscordButton />
        </CardContent>
      ) : null}
    </Card>
  );
}

const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  LIVE: "default",
  DISPUTED: "destructive",
  COMPLETE: "secondary",
  PENDING: "outline",
  VETO: "outline",
  CANCELLED: "outline",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={STATUS_VARIANT[status] ?? "outline"}>
      {status.toLowerCase()}
    </Badge>
  );
}

export function SimpleTable({
  head,
  rows,
  empty,
}: {
  head: string[];
  rows: ReactNode[][];
  empty: string;
}) {
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              {head.map((h) => (
                <TableHead key={h}>{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={head.length}
                  className="text-muted-foreground py-8 text-center"
                >
                  {empty}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row, i) => (
                <TableRow key={i}>
                  {row.map((cell, j) => (
                    <TableCell key={j}>{cell}</TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
