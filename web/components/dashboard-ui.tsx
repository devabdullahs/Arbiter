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

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="truncate text-2xl font-semibold tracking-tight md:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="text-muted-foreground mt-1 max-w-3xl text-sm leading-6">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      ) : null}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardContent className="flex min-h-48 flex-col items-center justify-center gap-2 py-10 text-center">
        {Icon ? (
          <span className="bg-muted text-muted-foreground flex size-11 items-center justify-center rounded-full">
            <Icon />
          </span>
        ) : null}
        <p className="text-sm font-medium">{title}</p>
        {description ? (
          <p className="text-muted-foreground max-w-sm text-sm">{description}</p>
        ) : null}
        {action ? <div className="mt-1">{action}</div> : null}
      </CardContent>
    </Card>
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
      <CardContent className="overflow-x-auto p-0">
        <Table className="min-w-[42rem]">
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
