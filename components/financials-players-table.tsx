"use client";

import { useMemo, useState } from "react";
import { Link2 } from "lucide-react";
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
import { formatSessionLabel } from "@/lib/format";
import {
  buildPaymentLink,
  filterPlayersByPaymentStatus,
  formatTransactionDate,
  formatUsdAmount,
  getPlayerPaymentAmount,
  getPlayerTenure,
  isPlayerPaid,
  sortPlayersByTransactionDate,
  type FinancialsPaymentFilter,
} from "@/lib/payment";
import type { Player, Program, Session } from "@/lib/types";
import { cn } from "@/lib/utils";

type FinancialsPlayersTableProps = {
  players: Player[];
  sessions: Session[];
  programs: Program[];
  onSendPaymentLink?: (playerId: string) => void;
};

function getSessionBadges(player: Player, sessions: Session[]) {
  return player.sessionIds
    .map((id) => sessions.find((session) => session.id === id))
    .filter((session): session is Session => Boolean(session));
}

function TwoLineCell({
  primary,
  secondary,
  className,
}: {
  primary: React.ReactNode;
  secondary: React.ReactNode;
  className?: string;
}) {
  return (
    <TableCell className={className}>
      <div className="flex min-h-12 flex-col justify-center gap-0.5 py-1">
        <div className="font-medium leading-snug">{primary}</div>
        <div className="text-xs leading-snug text-muted-foreground">
          {secondary}
        </div>
      </div>
    </TableCell>
  );
}

const FILTER_TABS: {
  id: FinancialsPaymentFilter;
  label: string;
}[] = [
  { id: "all", label: "All" },
  { id: "paid", label: "Paid" },
  { id: "unpaid", label: "Unpaid" },
];

export function FinancialsPlayersTable({
  players,
  sessions,
  programs,
  onSendPaymentLink,
}: FinancialsPlayersTableProps) {
  const [filter, setFilter] = useState<FinancialsPaymentFilter>("all");

  const paidCount = useMemo(
    () => players.filter((player) => isPlayerPaid(player)).length,
    [players],
  );
  const unpaidCount = players.length - paidCount;

  const visiblePlayers = useMemo(
    () =>
      sortPlayersByTransactionDate(
        filterPlayersByPaymentStatus(players, filter),
      ),
    [players, filter],
  );

  const handleSendPayment = async (player: Player) => {
    const link = buildPaymentLink(player);
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      // Clipboard may be unavailable; still mark as sent.
    }
    onSendPaymentLink?.(player.id);
    toast.success(`Payment link sent to ${player.name}`, {
      description: `Copied link for ${player.email}`,
    });
  };

  const tabCount = (id: FinancialsPaymentFilter) => {
    if (id === "paid") return paidCount;
    if (id === "unpaid") return unpaidCount;
    return players.length;
  };

  return (
    <div className="space-y-4" data-testid="financials-players-table">
      <div
        role="tablist"
        aria-label="Filter by payment status"
        className="inline-flex flex-wrap gap-1 rounded-lg border bg-muted/40 p-1"
        data-testid="financials-status-tabs"
      >
        {FILTER_TABS.map((tab) => {
          const isActive = filter === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              data-testid={`financials-tab-${tab.id}`}
              onClick={() => setFilter(tab.id)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-zinc-900 text-white"
                  : "text-muted-foreground hover:bg-background hover:text-foreground",
              )}
            >
              {tab.label}
              <span className="ml-1.5 tabular-nums opacity-80">
                ({tabCount(tab.id)})
              </span>
            </button>
          );
        })}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Player</TableHead>
            <TableHead>Programs</TableHead>
            <TableHead>Transaction</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visiblePlayers.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={5}
                className="h-16 text-center text-muted-foreground"
              >
                {filter === "paid"
                  ? "No paid transactions yet."
                  : filter === "unpaid"
                    ? "No unpaid players."
                    : "No players registered yet."}
              </TableCell>
            </TableRow>
          ) : (
            visiblePlayers.map((player) => {
              const paid = isPlayerPaid(player);
              const amount = getPlayerPaymentAmount(player);
              const tenure = getPlayerTenure(player, programs);
              const sessionBadges = getSessionBadges(player, sessions);
              const programNames = player.programIds
                .map(
                  (programId) =>
                    programs.find((program) => program.id === programId)?.name,
                )
                .filter((name): name is string => Boolean(name));

              return (
                <TableRow
                  key={player.id}
                  className="align-top"
                  data-testid={`financials-player-row-${player.id}`}
                >
                  <TwoLineCell
                    primary={player.name}
                    secondary={
                      <>
                        {player.email}
                        <span className="mx-1.5 text-border">·</span>
                        Grade {player.grade}
                        <span className="mx-1.5 text-border">·</span>
                        <span className="capitalize">{player.level}</span>
                      </>
                    }
                  />
                  <TwoLineCell
                    className="whitespace-normal"
                    primary={
                      programNames.length > 0
                        ? programNames.join(", ")
                        : "No program"
                    }
                    secondary={
                      sessionBadges.length > 0 ? (
                        <span className="flex flex-wrap gap-1">
                          {sessionBadges.map((session) => (
                            <Badge key={session.id} variant="secondary">
                              {formatSessionLabel(
                                session.year,
                                session.month,
                                session.label,
                              )}
                            </Badge>
                          ))}
                        </span>
                      ) : (
                        "No clinics"
                      )
                    }
                  />
                  <TwoLineCell
                    primary={formatUsdAmount(amount)}
                    secondary={
                      paid
                        ? `Paid ${formatTransactionDate(player.paymentLinkSentAt)}`
                        : "Transaction pending"
                    }
                  />
                  <TwoLineCell
                    primary={
                      <Badge
                        variant={
                          tenure === "returning" ? "secondary" : "outline"
                        }
                      >
                        {tenure === "returning" ? "Returning" : "New player"}
                      </Badge>
                    }
                    secondary={
                      paid ? (
                        <Badge variant="secondary">Enrolled / Paid</Badge>
                      ) : (
                        <Badge variant="outline">Unpaid</Badge>
                      )
                    }
                  />
                  <TableCell className="text-right">
                    <div className="flex min-h-12 items-center justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSendPayment(player)}
                      >
                        <Link2 data-icon="inline-start" />
                        {paid ? "Resend" : "Send link"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
