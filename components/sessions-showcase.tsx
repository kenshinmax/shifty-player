"use client";

import { useState } from "react";
import {
  CalendarDays,
  Pencil,
  Trash2,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog";
import { formatMonth, formatSessionLabel } from "@/lib/format";
import { sliceSessionsForShowcase } from "@/lib/session-showcase";
import { formatSessionStatus, type Session } from "@/lib/types";

type SessionsShowcaseProps = {
  sessions: Session[];
  playerCounts: Record<string, number>;
  highlightedSessionIds?: string[];
  canEdit?: boolean;
  onEdit: (session: Session) => void;
  onDelete: (sessionId: string) => void;
};

function SessionActions({
  session,
  onEdit,
  onDeleteClick,
  size = "sm",
  tone = "default",
}: {
  session: Session;
  onEdit: (session: Session) => void;
  onDeleteClick: (session: Session) => void;
  size?: "sm" | "default";
  tone?: "default" | "onPrimary";
}) {
  const onPrimaryClass =
    tone === "onPrimary"
      ? "border-primary-foreground/30 bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20 hover:text-primary-foreground"
      : undefined;

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        size={size}
        className={onPrimaryClass}
        onClick={() => onEdit(session)}
        aria-label={`Edit ${formatSessionLabel(session.year, session.month, session.label)}`}
      >
        <Pencil data-icon="inline-start" />
        Edit
      </Button>
      <Button
        variant="outline"
        size={size}
        className={onPrimaryClass}
        onClick={() => onDeleteClick(session)}
        aria-label={`Delete ${formatSessionLabel(session.year, session.month, session.label)}`}
      >
        <Trash2 data-icon="inline-start" />
        Delete
      </Button>
    </div>
  );
}

export function SessionsShowcase({
  sessions,
  playerCounts,
  highlightedSessionIds = [],
  canEdit = false,
  onEdit,
  onDelete,
}: SessionsShowcaseProps) {
  const [deleteTarget, setDeleteTarget] = useState<Session | null>(null);
  const { featured, cards, table } = sliceSessionsForShowcase(sessions);

  if (!featured) {
    return (
      <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
        No sessions yet. Add one to get started.
      </div>
    );
  }

  const featuredCount = playerCounts[featured.id] ?? 0;
  const featuredHighlighted = highlightedSessionIds.includes(featured.id);

  return (
    <>
      <div className="space-y-6">
        <article
          data-testid="session-megatron"
          className={`relative overflow-hidden rounded-2xl bg-primary text-primary-foreground ring-1 ring-foreground/10 ${
            featuredHighlighted ? "ring-2 ring-ring" : ""
          }`}
        >
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,oklch(1_0_0_/_0.12),transparent_55%)]" />
          <div className="relative flex flex-col gap-6 p-8 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-4">
              <Badge
                variant="secondary"
                className="bg-primary-foreground/15 text-primary-foreground"
              >
                Most recent
              </Badge>
              <div className="space-y-2">
                <h3 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
                  {featured.label ?? formatMonth(featured.month)}
                </h3>
                <p className="flex items-center gap-2 text-primary-foreground/80">
                  <CalendarDays className="size-4" aria-hidden />
                  {formatMonth(featured.month)} {featured.year}
                </p>
              </div>
              <p className="flex items-center gap-2 text-lg">
                <Users className="size-5" aria-hidden />
                <span className="font-medium">{featuredCount}</span>
                <span className="text-primary-foreground/80">
                  registered {featuredCount === 1 ? "player" : "players"}
                </span>
              </p>
            </div>
            {canEdit ? (
              <SessionActions
                session={featured}
                onEdit={onEdit}
                onDeleteClick={setDeleteTarget}
                size="default"
                tone="onPrimary"
              />
            ) : null}
          </div>
        </article>

        {cards.length > 0 ? (
          <div
            data-testid="session-cards"
            className="grid gap-4 sm:grid-cols-2"
          >
            {cards.map((session) => {
              const count = playerCounts[session.id] ?? 0;
              const highlighted = highlightedSessionIds.includes(session.id);
              return (
                <Card
                  key={session.id}
                  className={highlighted ? "ring-2 ring-ring" : undefined}
                >
                  <CardHeader>
                    <CardTitle className="font-heading text-lg">
                      {session.label ?? formatMonth(session.month)}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-1.5">
                      <CalendarDays className="size-3.5" aria-hidden />
                      {formatMonth(session.month)} {session.year}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="flex items-center gap-2 text-muted-foreground">
                      <Users className="size-4" aria-hidden />
                      {count} {count === 1 ? "player" : "players"}
                    </p>
                  </CardContent>
                  {canEdit ? (
                    <CardFooter className="justify-end gap-2 border-t-0 bg-transparent">
                      <SessionActions
                        session={session}
                        onEdit={onEdit}
                        onDeleteClick={setDeleteTarget}
                      />
                    </CardFooter>
                  ) : null}
                </Card>
              );
            })}
          </div>
        ) : null}

        {table.length > 0 ? (
          <div data-testid="session-table" className="space-y-3">
            <h3 className="font-heading text-sm font-medium text-muted-foreground">
              More sessions
            </h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Year</TableHead>
                  <TableHead>Month</TableHead>
                  <TableHead>Label</TableHead>
                  <TableHead>Status</TableHead>
                  {canEdit ? (
                    <TableHead className="text-right">Actions</TableHead>
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {table.map((session) => {
                  const highlighted = highlightedSessionIds.includes(
                    session.id,
                  );
                  return (
                    <TableRow
                      key={session.id}
                      className={highlighted ? "bg-muted/40" : undefined}
                    >
                      <TableCell>{session.year}</TableCell>
                      <TableCell>{formatMonth(session.month)}</TableCell>
                      <TableCell>{session.label ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {formatSessionStatus(session.status)}
                        </Badge>
                      </TableCell>
                      {canEdit ? (
                        <TableCell className="text-right">
                          <div className="flex justify-end">
                            <SessionActions
                              session={session}
                              onEdit={onEdit}
                              onDeleteClick={setDeleteTarget}
                            />
                          </div>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : null}
      </div>

      <DeleteConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete session?"
        description={
          deleteTarget
            ? `This will remove the ${formatMonth(deleteTarget.month)} ${deleteTarget.year} session and unregister all players from it.`
            : ""
        }
        onConfirm={() => {
          if (deleteTarget) onDelete(deleteTarget.id);
          setDeleteTarget(null);
        }}
      />
    </>
  );
}
