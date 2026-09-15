"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatSessionLabel } from "@/lib/format";
import type { PlayerInput } from "@/lib/player-store";
import { LEVELS, type Player, type Session } from "@/lib/types";

type PlayerFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  player?: Player;
  sessions: Session[];
  defaultSessionIds?: string[];
  onSubmit: (
    input: PlayerInput,
  ) => { error: string | null } | Promise<{ error: string | null }>;
};

type PlayerFormContentProps = Omit<PlayerFormDialogProps, "open" | "onOpenChange"> & {
  onClose: () => void;
};

function PlayerFormContent({
  player,
  sessions,
  defaultSessionIds = [],
  onSubmit,
  onClose,
}: PlayerFormContentProps) {
  const [name, setName] = useState(player?.name ?? "");
  const [email, setEmail] = useState(player?.email ?? "");
  const [grade, setGrade] = useState(player?.grade ?? "");
  const [level, setLevel] = useState<Player["level"]>(player?.level ?? "beginner");
  const [sessionIds, setSessionIds] = useState<string[]>(
    player?.sessionIds ?? defaultSessionIds,
  );
  const [error, setError] = useState<string | null>(null);

  const toggleSession = (sessionId: string, checked: boolean) => {
    setSessionIds((current) =>
      checked
        ? [...current, sessionId]
        : current.filter((id) => id !== sessionId),
    );
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const result = await onSubmit({ name, email, grade, level, sessionIds });
    if (result.error) {
      setError(result.error);
      return;
    }
    onClose();
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{player ? "Edit Player" : "Add Player"}</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="player-name">Name</Label>
          <Input
            id="player-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Player name"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="player-email">Email</Label>
          <Input
            id="player-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="parent@example.com"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="player-grade">Grade</Label>
          <Input
            id="player-grade"
            value={grade}
            onChange={(event) => setGrade(event.target.value)}
            placeholder="e.g. 5"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="player-level">Level</Label>
          <Select
            value={level}
            onValueChange={(value) => setLevel(value as Player["level"])}
          >
            <SelectTrigger id="player-level">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LEVELS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option.charAt(0).toUpperCase() + option.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Sessions</Label>
          <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border p-3">
            {sessions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Add a session first.
              </p>
            ) : (
              sessions.map((session) => (
                <label
                  key={session.id}
                  className="flex items-center gap-2 text-sm"
                >
                  <Checkbox
                    checked={sessionIds.includes(session.id)}
                    onCheckedChange={(checked) =>
                      toggleSession(session.id, checked === true)
                    }
                  />
                  {formatSessionLabel(
                    session.year,
                    session.month,
                    session.label,
                  )}
                </label>
              ))
            )}
          </div>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">{player ? "Save" : "Add Player"}</Button>
        </DialogFooter>
      </form>
    </>
  );
}

export function PlayerFormDialog({
  open,
  onOpenChange,
  player,
  sessions,
  defaultSessionIds = [],
  onSubmit,
}: PlayerFormDialogProps) {
  const formKey = player?.id ?? `new-${defaultSessionIds.join(",")}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {open ? (
          <PlayerFormContent
            key={formKey}
            player={player}
            sessions={sessions}
            defaultSessionIds={defaultSessionIds}
            onSubmit={onSubmit}
            onClose={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
