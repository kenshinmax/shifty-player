"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { PlayerFormDialog } from "@/components/player-form-dialog";
import { PlayersTable } from "@/components/players-table";
import { useRegistration } from "@/components/registration-provider";
import { Button } from "@/components/ui/button";
import type { Player } from "@/lib/types";

export default function DashboardPage() {
  const router = useRouter();
  const { user, canViewDashboard, canEdit } = useAuth();
  const {
    state,
    createPlayer,
    editPlayer,
    removePlayer,
    sendPaymentLink,
  } = useRegistration();

  const [playerDialogOpen, setPlayerDialogOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | undefined>();

  useEffect(() => {
    if (!canViewDashboard) {
      router.replace("/seasons");
    }
  }, [canViewDashboard, router]);

  if (!canViewDashboard || !user) {
    return <p className="text-muted-foreground">Redirecting to seasons…</p>;
  }

  const openAddPlayer = () => {
    setEditingPlayer(undefined);
    setPlayerDialogOpen(true);
  };

  const openEditPlayer = (player: Player) => {
    setEditingPlayer(player);
    setPlayerDialogOpen(true);
  };

  const sentCount = state.players.filter(
    (player) => player.paymentLinkSentAt,
  ).length;

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Admin Dashboard
        </h1>
        <p className="text-muted-foreground">
          Welcome, {user.name}. Manage registered players and send payment
          links.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border p-6">
          <p className="text-sm text-muted-foreground">Sessions</p>
          <p className="mt-1 font-heading text-3xl font-semibold">
            {state.sessions.length}
          </p>
        </div>
        <div className="rounded-xl border p-6">
          <p className="text-sm text-muted-foreground">Players</p>
          <p className="mt-1 font-heading text-3xl font-semibold">
            {state.players.length}
          </p>
        </div>
        <div className="rounded-xl border p-6">
          <p className="text-sm text-muted-foreground">Payment links sent</p>
          <p className="mt-1 font-heading text-3xl font-semibold">{sentCount}</p>
        </div>
      </div>

      <section className="space-y-4" data-testid="players-section">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-heading text-xl font-medium">Players</h2>
            <p className="text-sm text-muted-foreground">
              Send each player a payment link for their registration.
            </p>
          </div>
          <Button onClick={openAddPlayer}>
            <UserPlus data-icon="inline-start" />
            Add Player
          </Button>
        </div>
        <PlayersTable
          players={state.players}
          sessions={state.sessions}
          canEdit={canEdit}
          canSendPayment
          onEdit={openEditPlayer}
          onDelete={removePlayer}
          onSendPaymentLink={sendPaymentLink}
        />
      </section>

      <PlayerFormDialog
        open={playerDialogOpen}
        onOpenChange={setPlayerDialogOpen}
        player={editingPlayer}
        sessions={state.sessions}
        defaultSessionIds={state.sessions[0] ? [state.sessions[0].id] : []}
        onSubmit={(input) =>
          editingPlayer
            ? editPlayer(editingPlayer.id, input)
            : createPlayer(input)
        }
      />
    </div>
  );
}
