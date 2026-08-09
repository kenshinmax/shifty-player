"use client";

import { useMemo, useState } from "react";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { PlayerFormDialog } from "@/components/player-form-dialog";
import { useRegistration } from "@/components/registration-provider";
import { SessionsShowcase } from "@/components/sessions-showcase";
import { Button } from "@/components/ui/button";
import { sortSessionsByRecent } from "@/lib/session-showcase";

export function SeasonsRegistration() {
  const { canAddPlayer, canManageSessions } = useAuth();
  const { state, createPlayer, countPlayersForSession } = useRegistration();

  const [playerDialogOpen, setPlayerDialogOpen] = useState(false);

  const playerCounts = useMemo(() => {
    return Object.fromEntries(
      state.sessions.map((session) => [
        session.id,
        countPlayersForSession(session.id),
      ]),
    );
  }, [state.sessions, countPlayersForSession]);

  const mostRecentSessionId = useMemo(() => {
    return sortSessionsByRecent(state.sessions)[0]?.id;
  }, [state.sessions]);

  return (
    <div className="flex flex-1 flex-col gap-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="font-heading text-3xl font-semibold tracking-tight">
            Seasons
          </h1>
          <p className="text-muted-foreground">
            Browse basketball seasons and register players.
            {!canAddPlayer ? " Sign in to register a player." : null}
            {canManageSessions
              ? " Manage players and payment links from the Dashboard."
              : null}
          </p>
        </div>
        {canAddPlayer ? (
          <Button onClick={() => setPlayerDialogOpen(true)}>
            <UserPlus data-icon="inline-start" />
            Add Player
          </Button>
        ) : null}
      </header>

      <section className="space-y-4" data-testid="sessions-section">
        <h2 className="font-heading text-xl font-medium">Sessions</h2>
        <SessionsShowcase
          sessions={state.sessions}
          playerCounts={playerCounts}
          highlightedSessionIds={
            mostRecentSessionId ? [mostRecentSessionId] : []
          }
          canEdit={false}
          onEdit={() => undefined}
          onDelete={() => undefined}
        />
      </section>

      <PlayerFormDialog
        open={playerDialogOpen}
        onOpenChange={setPlayerDialogOpen}
        sessions={state.sessions}
        defaultSessionIds={mostRecentSessionId ? [mostRecentSessionId] : []}
        onSubmit={(input) => {
          const result = createPlayer(input);
          if (!result.error) {
            toast.success(`${input.name} registered`, {
              description: "Admins can send a payment link from the Dashboard.",
            });
          }
          return result;
        }}
      />
    </div>
  );
}
