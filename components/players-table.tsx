"use client";

import { useState } from "react";
import { Link2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
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
import { formatSessionLabel } from "@/lib/format";
import { buildPaymentLink } from "@/lib/payment";
import type { Player, Session } from "@/lib/types";

type PlayersTableProps = {
  players: Player[];
  sessions: Session[];
  canEdit?: boolean;
  canSendPayment?: boolean;
  onEdit: (player: Player) => void;
  onDelete: (playerId: string) => void;
  onSendPaymentLink?: (playerId: string) => void;
};

function getSessionBadges(player: Player, sessions: Session[]) {
  return player.sessionIds
    .map((id) => sessions.find((session) => session.id === id))
    .filter((session): session is Session => Boolean(session));
}

export function PlayersTable({
  players,
  sessions,
  canEdit = false,
  canSendPayment = false,
  onEdit,
  onDelete,
  onSendPaymentLink,
}: PlayersTableProps) {
  const [deleteTarget, setDeleteTarget] = useState<Player | null>(null);
  const showActions = canEdit || canSendPayment;

  const handleSendPayment = async (player: Player) => {
    const link = buildPaymentLink(player);
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      // Clipboard may be unavailable in some environments; still mark as sent.
    }
    onSendPaymentLink?.(player.id);
    toast.success(`Payment link sent to ${player.name}`, {
      description: `Copied link for ${player.email}`,
    });
  };

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Grade</TableHead>
            <TableHead>Level</TableHead>
            <TableHead>Sessions</TableHead>
            {canSendPayment ? <TableHead>Payment</TableHead> : null}
            {showActions ? (
              <TableHead className="text-right">Actions</TableHead>
            ) : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {players.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={4 + (canSendPayment ? 1 : 0) + (showActions ? 1 : 0) + 1}
                className="text-center text-muted-foreground"
              >
                No players registered yet.
              </TableCell>
            </TableRow>
          ) : (
            players.map((player) => (
              <TableRow key={player.id}>
                <TableCell className="font-medium">{player.name}</TableCell>
                <TableCell className="text-muted-foreground">
                  {player.email}
                </TableCell>
                <TableCell>{player.grade}</TableCell>
                <TableCell className="capitalize">{player.level}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {getSessionBadges(player, sessions).map((session) => (
                      <Badge key={session.id} variant="secondary">
                        {formatSessionLabel(
                          session.year,
                          session.month,
                          session.label,
                        )}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                {canSendPayment ? (
                  <TableCell>
                    {player.paymentLinkSentAt ? (
                      <Badge variant="secondary">Sent</Badge>
                    ) : (
                      <Badge variant="outline">Not sent</Badge>
                    )}
                  </TableCell>
                ) : null}
                {showActions ? (
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {canSendPayment ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSendPayment(player)}
                        >
                          <Link2 data-icon="inline-start" />
                          {player.paymentLinkSentAt ? "Resend" : "Send link"}
                        </Button>
                      ) : null}
                      {canEdit ? (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onEdit(player)}
                          >
                            <Pencil data-icon="inline-start" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDeleteTarget(player)}
                          >
                            <Trash2 data-icon="inline-start" />
                            Delete
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </TableCell>
                ) : null}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <DeleteConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete player?"
        description={
          deleteTarget
            ? `This will permanently remove ${deleteTarget.name} from the registration list.`
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
