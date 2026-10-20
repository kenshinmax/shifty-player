import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sampleData } from "@/lib/sample-data";
import type { AppState } from "@/lib/types";

const fetchRegistrationState = vi.fn<(orgId: string) => Promise<AppState>>();

vi.mock("@/lib/registration-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/registration-api")>()),
  fetchRegistrationState: (orgId: string) => fetchRegistrationState(orgId),
}));

const { usePlayerStore } = await import("@/lib/use-player-store");

const publicState: AppState = { ...sampleData, players: [] };

describe("usePlayerStore", () => {
  beforeEach(() => {
    fetchRegistrationState.mockReset();
  });

  it("refetches state when the signed-in viewer changes", async () => {
    fetchRegistrationState.mockResolvedValue(publicState);
    const { result, rerender } = renderHook(
      ({ viewerId }: { viewerId: string | null }) =>
        usePlayerStore("org-shifty-player", viewerId),
      { initialProps: { viewerId: null as string | null } },
    );
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    expect(result.current.state.players).toHaveLength(0);

    // Signing in as an admin loads the full roster without a reload.
    fetchRegistrationState.mockResolvedValue(sampleData);
    rerender({ viewerId: "user-admin" });
    await waitFor(() =>
      expect(result.current.state.players).toHaveLength(sampleData.players.length),
    );

    // Signing out drops the roster again.
    fetchRegistrationState.mockResolvedValue(publicState);
    rerender({ viewerId: null });
    await waitFor(() => expect(result.current.state.players).toHaveLength(0));
    expect(fetchRegistrationState).toHaveBeenCalledTimes(3);
  });
});
