"use client";

import { useMemo } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useRegistration } from "@/components/registration-provider";
import { formatSessionLabel } from "@/lib/format";
import { getChildrenForParent } from "@/lib/player-store";
import type { Player, Session } from "@/lib/types";

type ParentChildrenOverviewProps = {
  parentUserId: string;
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function clinicLabelsForChild(child: Player, sessions: Session[]): string[] {
  return child.sessionIds.map((sessionId) => {
    const session = sessions.find((entry) => entry.id === sessionId);
    if (!session) return sessionId;
    return formatSessionLabel(session.year, session.month, session.label);
  });
}

export function ParentChildrenOverview({
  parentUserId,
}: ParentChildrenOverviewProps) {
  const { state } = useRegistration();

  const children = useMemo(
    () => getChildrenForParent(state.players, parentUserId),
    [state.players, parentUserId],
  );

  if (children.length === 0) return null;

  return (
    <section className="space-y-4" data-testid="parent-children-overview">
      <div>
        <h2 className="font-heading text-xl font-medium">My children</h2>
        <p className="text-sm text-muted-foreground">
          Current clinic registrations for each child.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {children.map((child) => {
          const clinics = clinicLabelsForChild(child, state.sessions);

          return (
            <Card key={child.id}>
              <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-2">
                <Avatar>
                  {child.avatarUrl ? (
                    <AvatarImage src={child.avatarUrl} alt="" />
                  ) : null}
                  <AvatarFallback>{initials(child.name)}</AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle className="text-base">{child.name}</CardTitle>
                  <CardDescription>
                    Grade {child.grade} ·{" "}
                    <span className="capitalize">{child.level}</span>
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                {clinics.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Not registered for any clinics yet.
                  </p>
                ) : (
                  <ul className="flex flex-wrap gap-2">
                    {clinics.map((label) => (
                      <li key={label}>
                        <Badge variant="secondary">{label}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
