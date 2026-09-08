"use client";

import { useMemo, useState } from "react";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { PlayerFormDialog } from "@/components/player-form-dialog";
import { useRegistration } from "@/components/registration-provider";
import { SessionsShowcase } from "@/components/sessions-showcase";
import { SessionsTable } from "@/components/sessions-table";
import { ProgramsValues } from "@/components/programs-values";
import { Summer2027Programs } from "@/components/summer-2027-programs";
import { Button } from "@/components/ui/button";
import { getLatestSession } from "@/lib/session-showcase";

export function ProgramsRegistration() {
  const { canAddPlayer, canManageSessions } = useAuth();
  const { state, createPlayer, countPlayersForSession } = useRegistration();

  const [playerDialogOpen, setPlayerDialogOpen] = useState(false);

  const latestSession = useMemo(
    () => getLatestSession(state.sessions),
    [state.sessions],
  );

  const playerCounts = useMemo(() => {
    if (!latestSession) return {};
    return {
      [latestSession.id]: countPlayersForSession(latestSession.id),
    };
  }, [latestSession, countPlayersForSession]);

  return (
    <div className="-mx-6 -mt-10 flex flex-1 flex-col gap-10 pb-8">
      <SessionsShowcase
        sessions={state.sessions}
        playerCounts={playerCounts}
        canEdit={false}
        fullBleed
        onEdit={() => undefined}
        onDelete={() => undefined}
      />

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <h1 className="font-heading text-3xl font-semibold tracking-tight">
              Programs
            </h1>
            <p className="text-muted-foreground">
              Register for the latest basketball program.
              {!canAddPlayer ? " Sign in to register a player." : null}
              {canManageSessions
                ? " Manage players and payment links from the Dashboard."
                : null}
            </p>
          </div>
         
        </header>

        <section className="space-y-10" data-testid="sessions-section">
          <Summer2027Programs />
          <ProgramsValues />
          <SessionsTable
            sessions={state.sessions}
            canEdit={false}
            onEdit={() => undefined}
            onDelete={() => undefined}
          />
        </section>
      </div>

      <PlayerFormDialog
        open={playerDialogOpen}
        onOpenChange={setPlayerDialogOpen}
        sessions={state.sessions}
        defaultSessionIds={latestSession ? [latestSession.id] : []}
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
