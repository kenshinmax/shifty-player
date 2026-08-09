import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PlayersTable } from "@/components/players-table";
import { sampleData } from "@/lib/sample-data";

describe("PlayersTable", () => {
  it("renders ten sample players", () => {
    render(
      <PlayersTable
        players={sampleData.players}
        sessions={sampleData.sessions}
        canEdit
        onEdit={() => undefined}
        onDelete={() => undefined}
      />,
    );

    expect(screen.getByText("Alex Johnson")).toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(11);
  });
});
