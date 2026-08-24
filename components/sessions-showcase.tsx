"use client";

import { useState } from "react";
import { CalendarDays, Pencil, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog";
import { formatMonth, formatSessionLabel } from "@/lib/format";
import { getLatestSession } from "@/lib/session-showcase";
import type { Session } from "@/lib/types";
import { cn } from "@/lib/utils";

type SessionsShowcaseProps = {
  sessions: Session[];
  playerCounts: Record<string, number>;
  canEdit?: boolean;
  fullBleed?: boolean;
  onEdit: (session: Session) => void;
  onDelete: (sessionId: string) => void;
};

const darkActionClass =
  "border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white";

function SessionActions({
  session,
  onEdit,
  onDeleteClick,
  size = "sm",
}: {
  session: Session;
  onEdit: (session: Session) => void;
  onDeleteClick: (session: Session) => void;
  size?: "sm" | "default";
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        size={size}
        className={darkActionClass}
        onClick={() => onEdit(session)}
        aria-label={`Edit ${formatSessionLabel(session.year, session.month, session.label)}`}
      >
        <Pencil data-icon="inline-start" />
        Edit
      </Button>
      <Button
        variant="outline"
        size={size}
        className={darkActionClass}
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
  canEdit = false,
  fullBleed = false,
  onEdit,
  onDelete,
}: SessionsShowcaseProps) {
  const [deleteTarget, setDeleteTarget] = useState<Session | null>(null);
  const featured = getLatestSession(sessions);

  if (!featured) {
    return (
      <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
        No sessions yet. Add one to get started.
      </div>
    );
  }

  const featuredCount = playerCounts[featured.id] ?? 0;

  return (
    <>
      <section
        data-testid="session-megatron"
        className={cn(
          "group relative overflow-hidden bg-zinc-900 text-white",
          fullBleed
            ? "relative left-1/2 w-screen max-w-[100vw] -translate-x-1/2"
            : "flex min-h-[22rem] flex-col justify-end rounded-2xl border border-white/10 p-8 ring-1 ring-white/5 transition-transform duration-500 hover:-translate-y-1",
        )}
      >
        <div
          className="pointer-events-none absolute inset-0 bg-linear-to-br from-cyan-400/25 via-transparent to-transparent"
          aria-hidden
        />
        <div
          className={cn(
            "pointer-events-none absolute font-heading font-semibold leading-none text-white/5 transition-colors duration-500 group-hover:text-white/10",
            fullBleed
              ? "-top-20 -right-8 text-[11rem] sm:text-[14rem]"
              : "-top-16 -right-10 text-[9rem]",
          )}
          aria-hidden
        >
          01
        </div>
        <div
          className={cn(
            "relative",
            fullBleed
              ? "mx-auto flex min-h-[min(70vh,36rem)] w-full max-w-6xl flex-col justify-end gap-8 px-6 py-14 sm:flex-row sm:items-end sm:justify-between sm:py-20"
              : "flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between",
          )}
        >
          <div className="space-y-5">
            <span className="inline-flex size-11 items-center justify-center rounded-full border border-white/15 bg-white/5">
              <CalendarDays className="size-5" aria-hidden />
            </span>
            <div className="space-y-3">
              <p className="text-xs font-semibold tracking-[0.22em] text-white/55 uppercase">
                Latest program
              </p>
              <h3
                className={cn(
                  "font-heading font-semibold tracking-tight uppercase",
                  fullBleed
                    ? "text-5xl sm:text-6xl lg:text-7xl"
                    : "text-4xl sm:text-5xl",
                )}
              >
                {featured.label ?? formatMonth(featured.month)}
              </h3>
              <p className="text-lg font-medium text-white sm:text-xl">
                {formatMonth(featured.month)} {featured.year}
              </p>
              <p className="flex items-center gap-2 text-sm text-white/65 sm:text-base">
                <Users className="size-4" aria-hidden />
                <span className="font-medium text-white">{featuredCount}</span>
                registered {featuredCount === 1 ? "player" : "players"}
              </p>
            </div>
          </div>
          {canEdit ? (
            <SessionActions
              session={featured}
              onEdit={onEdit}
              onDeleteClick={setDeleteTarget}
              size="default"
            />
          ) : null}
        </div>
      </section>

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
