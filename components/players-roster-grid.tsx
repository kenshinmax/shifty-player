"use client";

import { useState } from "react";
import { Link2, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog";
import { buildPaymentLink } from "@/lib/payment";
import type { Player } from "@/lib/types";
import { cn } from "@/lib/utils";

type PlayersRosterGridProps = {
  players: Player[];
  canEdit?: boolean;
  canSendPayment?: boolean;
  onEdit: (player: Player) => void;
  onDelete: (playerId: string) => void;
  onSendPaymentLink?: (playerId: string) => void;
};

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function playerStatus(player: Player) {
  return player.paymentLinkSentAt ? "Paid" : "Pending";
}

export function PlayersRosterGrid({
  players,
  canEdit = false,
  canSendPayment = false,
  onEdit,
  onDelete,
  onSendPaymentLink,
}: PlayersRosterGridProps) {
  const [deleteTarget, setDeleteTarget] = useState<Player | null>(null);
  const showMenu = canEdit || canSendPayment;

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

  if (players.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
        No players registered yet.
      </div>
    );
  }

  return (
    <>
      <div
        data-testid="players-roster-grid"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        {players.map((player) => {
          const status = playerStatus(player);
          return (
            <article
              key={player.id}
              data-testid={`player-roster-card-${player.id}`}
              className="rounded-xl border bg-background p-4 shadow-sm ring-1 ring-foreground/5"
            >
              <div className="flex items-start gap-3">
                <Avatar size="sm" className="size-10">
                  {player.avatarUrl ? (
                    <AvatarImage
                      src={player.avatarUrl}
                      alt={`${player.name} profile photo`}
                    />
                  ) : null}
                  <AvatarFallback className="text-xs font-medium">
                    {initials(player.name)}
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{player.name}</p>
                      <p
                        className="text-sm text-muted-foreground"
                        data-testid={`player-grade-${player.id}`}
                      >
                        Grade {player.grade}
                      </p>
                    </div>

                    {showMenu ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          className={cn(
                            buttonVariants({
                              variant: "ghost",
                              size: "icon-sm",
                            }),
                            "shrink-0",
                          )}
                          aria-label={`Actions for ${player.name}`}
                          data-testid={`player-actions-${player.id}`}
                        >
                          <MoreHorizontal className="size-4" aria-hidden />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-40">
                          {canEdit ? (
                            <DropdownMenuItem onClick={() => onEdit(player)}>
                              <Pencil />
                              Edit
                            </DropdownMenuItem>
                          ) : null}
                          {canSendPayment ? (
                            <DropdownMenuItem
                              onClick={() => handleSendPayment(player)}
                            >
                              <Link2 />
                              {player.paymentLinkSentAt
                                ? "Resend link"
                                : "Send link"}
                            </DropdownMenuItem>
                          ) : null}
                          {canEdit ? (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={() => setDeleteTarget(player)}
                              >
                                <Trash2 />
                                Delete
                              </DropdownMenuItem>
                            </>
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : null}
                  </div>

                  <Badge
                    variant={status === "Paid" ? "secondary" : "outline"}
                    data-testid={`player-status-${player.id}`}
                  >
                    {status}
                  </Badge>
                </div>
              </div>
            </article>
          );
        })}
      </div>

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
