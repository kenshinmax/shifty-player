"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { getMoreSessions } from "@/lib/session-showcase";
import { formatSessionStatus, type Session } from "@/lib/types";

type SessionsTableProps = {
  sessions: Session[];
  canEdit?: boolean;
  onEdit: (session: Session) => void;
  onDelete: (sessionId: string) => void;
};

const darkActionClass =
  "border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white";

export function SessionsTable({
  sessions,
  canEdit = false,
  onEdit,
  onDelete,
}: SessionsTableProps) {
  const [deleteTarget, setDeleteTarget] = useState<Session | null>(null);
  const rows = getMoreSessions(sessions);

  if (rows.length === 0) {
    return null;
  }

  return (
    <>
      <div
        data-testid="session-table"
        className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 text-white ring-1 ring-white/5"
      >
        <div className="border-b border-white/10 px-6 py-5">
          <div className="space-y-1">
            <p className="text-xs font-semibold tracking-[0.22em] text-white/55 uppercase">
              More sessions
            </p>
            <h3 className="font-heading text-2xl font-semibold tracking-tight">
              Upcoming and completed
            </h3>
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="border-white/10 hover:bg-transparent">
              <TableHead className="h-12 px-6 text-xs font-semibold tracking-[0.18em] text-white/55 uppercase">
                Year
              </TableHead>
              <TableHead className="h-12 text-xs font-semibold tracking-[0.18em] text-white/55 uppercase">
                Month
              </TableHead>
              <TableHead className="h-12 text-xs font-semibold tracking-[0.18em] text-white/55 uppercase">
                Label
              </TableHead>
              <TableHead className="h-12 text-xs font-semibold tracking-[0.18em] text-white/55 uppercase">
                Status
              </TableHead>
              {canEdit ? (
                <TableHead className="h-12 px-6 text-right text-xs font-semibold tracking-[0.18em] text-white/55 uppercase">
                  Actions
                </TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((session) => (
              <TableRow
                key={session.id}
                className="border-white/10 hover:bg-white/5"
              >
                <TableCell className="px-6 py-4 font-heading text-base font-semibold">
                  {session.year}
                </TableCell>
                <TableCell className="py-4 text-base font-medium">
                  {formatMonth(session.month)}
                </TableCell>
                <TableCell className="py-4 font-heading text-base font-semibold">
                  {session.label ?? "—"}
                </TableCell>
                <TableCell className="py-4">
                  <Badge className="border-white/15 bg-white/10 text-white capitalize hover:bg-white/15">
                    {formatSessionStatus(session.status)}
                  </Badge>
                </TableCell>
                {canEdit ? (
                  <TableCell className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className={darkActionClass}
                        onClick={() => onEdit(session)}
                        aria-label={`Edit ${formatSessionLabel(session.year, session.month, session.label)}`}
                      >
                        <Pencil data-icon="inline-start" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className={darkActionClass}
                        onClick={() => setDeleteTarget(session)}
                        aria-label={`Delete ${formatSessionLabel(session.year, session.month, session.label)}`}
                      >
                        <Trash2 data-icon="inline-start" />
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
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
