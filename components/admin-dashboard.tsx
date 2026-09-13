"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Menu, UserPlus, X } from "lucide-react";
import { AdminScheduleAvailability } from "@/components/admin-schedule-availability";
import { useAuth } from "@/components/auth-provider";
import { FinancialsPlayersTable } from "@/components/financials-players-table";
import { PlayerFormDialog } from "@/components/player-form-dialog";
import { PlayersRosterGrid } from "@/components/players-roster-grid";
import { RegistrationInsights } from "@/components/registration-insights";
import { useRegistration } from "@/components/registration-provider";
import { Button } from "@/components/ui/button";
import {
  DASHBOARD_NAV,
  type DashboardSection,
} from "@/lib/dashboard-nav";
import { formatMonth } from "@/lib/format";
import { getLatestSession } from "@/lib/session-showcase";
import { type Player } from "@/lib/types";
import { cn } from "@/lib/utils";

function NavButtons({
  active,
  onSelect,
  orientation = "vertical",
  testIdPrefix = "dashboard-nav",
}: {
  active: DashboardSection;
  onSelect: (section: DashboardSection) => void;
  orientation?: "vertical" | "horizontal";
  testIdPrefix?: string;
}) {
  return (
    <nav
      aria-label="Admin sections"
      className={cn(
        orientation === "vertical"
          ? "flex flex-col gap-1"
          : "grid grid-cols-5 gap-1",
      )}
    >
      {DASHBOARD_NAV.map((item) => {
        const Icon = item.icon;
        const isActive = active === item.id;
        return (
          <button
            key={item.id}
            type="button"
            data-testid={`${testIdPrefix}-${item.id}`}
            onClick={() => onSelect(item.id)}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg text-sm font-medium transition-colors",
              orientation === "vertical"
                ? "px-3 py-2.5 text-left"
                : "flex-col justify-center gap-1 px-1 py-2 text-[11px]",
              isActive
                ? "bg-zinc-900 text-white"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
            aria-current={isActive ? "page" : undefined}
          >
            <Icon
              className={cn(
                "shrink-0",
                orientation === "vertical" ? "size-4" : "size-5",
              )}
              aria-hidden
            />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export function AdminDashboard() {
  const router = useRouter();
  const { user, canViewDashboard, canEdit } = useAuth();
  const {
    state,
    syncFromStorage,
    createPlayer,
    editPlayer,
    removePlayer,
    sendPaymentLink,
  } = useRegistration();

  const [activeSection, setActiveSection] =
    useState<DashboardSection>("registration");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [playerDialogOpen, setPlayerDialogOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | undefined>();

  useEffect(() => {
    if (!canViewDashboard) {
      router.replace(user?.role === "user" ? "/player" : "/");
    }
  }, [canViewDashboard, router, user?.role]);

  if (!canViewDashboard || !user) {
    return <p className="text-muted-foreground">Redirecting…</p>;
  }

  const openAddPlayer = () => {
    setEditingPlayer(undefined);
    setPlayerDialogOpen(true);
  };

  const openEditPlayer = (player: Player) => {
    setEditingPlayer(player);
    setPlayerDialogOpen(true);
  };

  const selectSection = (section: DashboardSection) => {
    if (section === "financials") {
      // Pull the latest enrollments/payments before rendering financials.
      syncFromStorage();
    }
    setActiveSection(section);
    setMobileMenuOpen(false);
  };

  const sentCount = state.players.filter(
    (player) => player.paymentLinkSentAt,
  ).length;
  const pendingCount = state.players.length - sentCount;
  const activeNav = DASHBOARD_NAV.find((item) => item.id === activeSection)!;
  const upcomingSession = getLatestSession(state.sessions);
  const upcomingProgramLabel = upcomingSession
    ? (upcomingSession.label ?? formatMonth(upcomingSession.month))
    : "the upcoming program";
  const upcomingProgramPlayers = upcomingSession
    ? state.players.filter((player) =>
        player.sessionIds.includes(upcomingSession.id),
      ).length
    : 0;
  const plannedSessions = state.sessions.filter(
    (session) => session.status !== "completed",
  );
  const gamesPlanned = plannedSessions.reduce((total, session) => {
    if (session.status === "trending") return total + 14;
    if (session.status === "in-progress") return total + 10;
    return total;
  }, 0);

  return (
    <div className="space-y-6 pb-24 md:pb-0" data-testid="admin-dashboard">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="font-heading text-3xl font-semibold tracking-tight">
            Admin Dashboard
          </h1>
          <p className="text-muted-foreground">
            Welcome, {user.name}. Track registration, financials, schedules,
            messaging, and rosters.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="md:hidden"
          data-testid="dashboard-menu-toggle"
          onClick={() => setMobileMenuOpen((open) => !open)}
          aria-expanded={mobileMenuOpen}
          aria-controls="dashboard-mobile-drawer"
        >
          {mobileMenuOpen ? (
            <X data-icon="inline-start" />
          ) : (
            <Menu data-icon="inline-start" />
          )}
          Menu
        </Button>
      </header>

      {mobileMenuOpen ? (
        <div
          id="dashboard-mobile-drawer"
          data-testid="dashboard-mobile-drawer"
          className="rounded-2xl border bg-background p-3 shadow-sm ring-1 ring-foreground/5 md:hidden"
        >
          <NavButtons
            active={activeSection}
            onSelect={selectSection}
            testIdPrefix="dashboard-drawer-nav"
          />
        </div>
      ) : null}

      <div className="flex gap-8">
        <aside
          data-testid="dashboard-sidebar"
          className="sticky top-24 hidden h-fit w-56 shrink-0 space-y-4 md:block"
        >
          <div className="rounded-2xl border bg-background p-3 shadow-sm ring-1 ring-foreground/5">
            <p className="px-3 pb-2 text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
              Sections
            </p>
            <NavButtons
              active={activeSection}
              onSelect={selectSection}
              testIdPrefix="dashboard-nav"
            />
          </div>
        </aside>

        <div className="min-w-0 flex-1 space-y-6">
          <div className="space-y-1">
            <h2 className="font-heading text-2xl font-semibold tracking-tight">
              {activeNav.label}
            </h2>
            <p className="text-sm text-muted-foreground">
              {activeNav.description}
            </p>
          </div>

          {activeSection === "registration" ? (
            <section
              className="space-y-6"
              data-testid="dashboard-registration"
            >
              <article
                data-testid="registration-greeting"
                className="relative overflow-hidden rounded-2xl border border-white/10 bg-zinc-900 p-6 text-white shadow-sm ring-1 ring-white/5 sm:p-8"
              >
                <div
                  className="pointer-events-none absolute inset-0 bg-linear-to-br from-cyan-400/20 via-transparent to-transparent"
                  aria-hidden
                />
                <div className="relative space-y-6">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold tracking-[0.22em] text-white/55 uppercase">
                      Registration overview
                    </p>
                    <h3 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
                      Good to see you, {user.name.split(" ")[0]}.
                    </h3>
                    <p className="max-w-2xl text-sm text-white/70 sm:text-base">
                      Here&apos;s a quick look at registration for{" "}
                      {upcomingProgramLabel}
                      {upcomingSession
                        ? ` · ${formatMonth(upcomingSession.month)} ${upcomingSession.year}`
                        : ""}
                      .
                    </p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                      <p className="text-xs tracking-wide text-white/55 uppercase">
                        Registered players
                      </p>
                      <p className="mt-2 font-heading text-3xl font-semibold">
                        {state.players.length}
                      </p>
                      <p className="mt-1 text-sm text-white/65">
                        {upcomingProgramPlayers} locked into {upcomingProgramLabel}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                      <p className="text-xs tracking-wide text-white/55 uppercase">
                        Games planned
                      </p>
                      <p className="mt-2 font-heading text-3xl font-semibold">
                        {gamesPlanned}
                      </p>
                      <p className="mt-1 text-sm text-white/65">
                        Across {plannedSessions.length} upcoming{" "}
                        {plannedSessions.length === 1 ? "session" : "sessions"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                      <p className="text-xs tracking-wide text-white/55 uppercase">
                        Payment follow-ups
                      </p>
                      <p className="mt-2 font-heading text-3xl font-semibold">
                        {pendingCount}
                      </p>
                      <p className="mt-1 text-sm text-white/65">
                        {sentCount} payment{" "}
                        {sentCount === 1 ? "link" : "links"} already sent
                      </p>
                    </div>
                  </div>
                </div>
              </article>

              <RegistrationInsights
                registeredPlayers={state.players.length}
                rosterPlayers={upcomingProgramPlayers}
                paymentLinksSent={sentCount}
              />

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/40 px-5 py-4">
                <p className="text-sm text-muted-foreground">
                  Ready to grow the roster for {upcomingProgramLabel}?
                </p>
                <Button onClick={() => selectSection("rosters")}>
                  <UserPlus data-icon="inline-start" />
                  Open rosters
                </Button>
              </div>
            </section>
          ) : null}

          {activeSection === "financials" ? (
            <section className="space-y-6" data-testid="dashboard-financials">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl border p-5">
                  <p className="text-sm text-muted-foreground">Players</p>
                  <p className="mt-1 font-heading text-3xl font-semibold">
                    {state.players.length}
                  </p>
                </div>
                <div className="rounded-xl border p-5">
                  <p className="text-sm text-muted-foreground">
                    Payment links sent
                  </p>
                  <p className="mt-1 font-heading text-3xl font-semibold">
                    {sentCount}
                  </p>
                </div>
                <div className="rounded-xl border p-5">
                  <p className="text-sm text-muted-foreground">Pending</p>
                  <p className="mt-1 font-heading text-3xl font-semibold">
                    {pendingCount}
                  </p>
                </div>
              </div>
              <FinancialsPlayersTable
                players={state.players}
                sessions={state.sessions}
                programs={state.programs}
                onSendPaymentLink={sendPaymentLink}
              />
            </section>
          ) : null}

          {activeSection === "programs" ? (
            <section className="space-y-4" data-testid="dashboard-programs">
              <AdminScheduleAvailability />
            </section>
          ) : null}

          {activeSection === "communications" ? (
            <section
              className="space-y-4"
              data-testid="dashboard-communications"
            >
              <div className="rounded-2xl border border-dashed p-8">
                <h3 className="font-heading text-lg font-medium">
                  Family updates
                </h3>
                <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                  Draft program reminders, clinic follow-ups, and payment
                  notices from one place. Messaging templates arrive in a later
                  release — payment links remain available under Financials.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border p-5">
                  <p className="text-sm text-muted-foreground">
                    Payment notices ready
                  </p>
                  <p className="mt-1 font-heading text-2xl font-semibold">
                    {pendingCount}
                  </p>
                </div>
                <div className="rounded-xl border p-5">
                  <p className="text-sm text-muted-foreground">
                    Links already sent
                  </p>
                  <p className="mt-1 font-heading text-2xl font-semibold">
                    {sentCount}
                  </p>
                </div>
              </div>
            </section>
          ) : null}

          {activeSection === "rosters" ? (
            <section className="space-y-4" data-testid="players-section">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="font-heading text-xl font-medium">Players</h3>
                  <p className="text-sm text-muted-foreground">
                    Add, edit, and manage registered players by session.
                  </p>
                </div>
                <Button onClick={openAddPlayer}>
                  <UserPlus data-icon="inline-start" />
                  Add Player
                </Button>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl border p-5">
                  <p className="text-sm text-muted-foreground">Sessions</p>
                  <p className="mt-1 font-heading text-3xl font-semibold">
                    {state.sessions.length}
                  </p>
                </div>
                <div className="rounded-xl border p-5">
                  <p className="text-sm text-muted-foreground">Players</p>
                  <p className="mt-1 font-heading text-3xl font-semibold">
                    {state.players.length}
                  </p>
                </div>
                <div className="rounded-xl border p-5">
                  <p className="text-sm text-muted-foreground">
                    Payment links sent
                  </p>
                  <p className="mt-1 font-heading text-3xl font-semibold">
                    {sentCount}
                  </p>
                </div>
              </div>
              <PlayersRosterGrid
                players={state.players}
                canEdit={canEdit}
                canSendPayment
                onEdit={openEditPlayer}
                onDelete={removePlayer}
                onSendPaymentLink={sendPaymentLink}
              />
            </section>
          ) : null}
        </div>
      </div>

      <nav
        data-testid="dashboard-mobile-nav"
        aria-label="Admin sections"
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 px-3 py-2 backdrop-blur md:hidden supports-backdrop-filter:bg-background/90"
      >
        <NavButtons
          active={activeSection}
          onSelect={selectSection}
          orientation="horizontal"
          testIdPrefix="dashboard-mobile-nav"
        />
      </nav>

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
