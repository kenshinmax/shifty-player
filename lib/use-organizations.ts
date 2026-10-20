"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchOrganizations } from "@/lib/platform-api";
import type { Organization } from "@/lib/types";

/** Every organization (drafts included) for admin screens. */
export function useOrganizations() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
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
  }, []);

  return { organizations, error, reload };
}
