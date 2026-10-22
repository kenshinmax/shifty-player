"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchOrganizations } from "@/lib/platform-api";
import type { OrganizationWithOwners } from "@/lib/types";

/**
 * Every organization (drafts included) for the platform admin's screens.
 * Pass `enabled: false` for org owners, who can't list other orgs.
 */
export function useOrganizations(enabled = true) {
  const [organizations, setOrganizations] = useState<OrganizationWithOwners[]>([]);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setOrganizations(await fetchOrganizations());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load organizations.");
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    fetchOrganizations()
      .then((next) => {
        if (!cancelled) setOrganizations(next);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load organizations.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { organizations, error, reload };
}
