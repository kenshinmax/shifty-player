import { expect, test, type Page } from "@playwright/test";

const playersSection = (page: Page) => page.getByTestId("players-section");

async function openSignIn(page: Page) {
  await page.getByTestId("sign-in-button").click();
}

async function signInAsAdmin(page: Page) {
  await openSignIn(page);
  await page.getByRole("button", { name: "Use admin" }).click();
  await page
    .getByRole("dialog", { name: "Sign in" })
    .getByRole("button", { name: "Sign in" })
    .click();
  await expect(page.getByRole("button", { name: "Account menu" })).toContainText(
    "Alex Admin",
  );
}

async function signInAsPlayer(page: Page) {
  await openSignIn(page);
  await page.getByRole("button", { name: "Use user" }).click();
  await page
    .getByRole("dialog", { name: "Sign in" })
    .getByRole("button", { name: "Sign in" })
    .click();
  await expect(page.getByRole("button", { name: "Account menu" })).toContainText(
    "Jordan Player",
  );
}

test("admin dashboard players and payment links", async ({ page }) => {
  await page.goto("/programs");

  await expect(page.getByRole("heading", { name: "Programs" })).toBeVisible();
  await expect(page.getByTestId("session-megatron")).toContainText("Winter");
  await expect(page.getByTestId("session-cards")).toHaveCount(0);
  await expect(page.getByTestId("seasons-values")).toContainText("Work hard");
  await expect(page.getByTestId("seasons-values")).toContainText("Play smart");
  await expect(page.getByTestId("seasons-values")).toContainText("Compete");
  await expect(page.getByTestId("session-table")).toContainText("Holiday");
  await expect(page.getByTestId("session-table")).toContainText("Fall Classic");
  await expect(page.getByTestId("players-section")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Add Player" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Add Session" })).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: "Add Session" })).toHaveCount(0);

  await signInAsAdmin(page);

  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByTestId("registration-greeting")).toBeVisible();
  await expect(page.getByRole("link", { name: "Admin" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add Session" })).toHaveCount(0);

  await expect(page.getByRole("heading", { name: "Admin Dashboard" })).toBeVisible();
  await expect(page.getByTestId("dashboard-sidebar")).toBeVisible();
  await expect(page.getByTestId("dashboard-nav-registration")).toBeVisible();
  await expect(page.getByTestId("dashboard-nav-financials")).toBeVisible();
  await expect(page.getByTestId("dashboard-nav-schedule")).toBeVisible();
  await expect(page.getByTestId("dashboard-nav-communications")).toBeVisible();
  await expect(page.getByTestId("dashboard-nav-rosters")).toBeVisible();
  await expect(page.getByTestId("registration-greeting")).toContainText(
    "Good to see you",
  );
  await expect(page.getByTestId("dashboard-registration")).toContainText(
    "Registered players",
  );
  await expect(page.getByTestId("dashboard-registration")).toContainText(
    "Games planned",
  );
  await expect(page.getByTestId("registration-insights")).toContainText(
    "Revenue collected",
  );
  await expect(page.getByTestId("registration-insights")).toContainText(
    "Number of teams",
  );
  await expect(page.getByTestId("registration-insights")).toContainText(
    "Registered vs roster",
  );
  await expect(page.getByTestId("registration-player-trend")).toContainText(
    "March",
  );
  await expect(page.getByTestId("registration-player-trend")).toContainText(
    "August",
  );
  await expect(page.getByTestId("registration-attendance-bars")).toContainText(
    "Team attendance",
  );
  await expect(page.getByTestId("registration-attendance-bars")).toContainText(
    "June",
  );

  await page.getByTestId("dashboard-nav-rosters").click();
  await expect(page.getByRole("button", { name: "Add Player" })).toBeVisible();
  await expect(page.getByTestId("players-roster-grid")).toBeVisible();
  await expect(
    playersSection(page).getByRole("button", { name: /Actions for/ }),
  ).toHaveCount(10);

  await page.getByTestId("dashboard-nav-schedule").click();
  await expect(page.getByTestId("dashboard-schedule")).toContainText("Winter");
  await page.getByTestId("dashboard-nav-rosters").click();
  await expect(playersSection(page)).toBeVisible();

  await page.getByRole("button", { name: "Add Player" }).click();
  const playerDialog = page.getByRole("dialog", { name: "Add Player" });
  await playerDialog.locator("#player-name").fill("Test Player");
  await playerDialog.locator("#player-email").fill("test.player@example.com");
  await playerDialog.locator("#player-grade").fill("5");
  await playerDialog.locator("#player-level").click();
  await page.getByRole("option", { name: "Advanced" }).click();
  await playerDialog.getByRole("button", { name: "Add Player" }).click();
  await expect(playersSection(page).getByText("Test Player")).toBeVisible();

  await page
    .getByRole("button", { name: "Actions for Alex Johnson" })
    .click();
  await page.getByRole("menuitem", { name: "Send link" }).click();
  await expect(page.getByText("Payment link sent to Alex Johnson")).toBeVisible();
  await expect(
    page.getByTestId("player-status-player-1"),
  ).toContainText("Paid");

  await page
    .getByRole("button", { name: "Actions for Alex Johnson" })
    .click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  const editDialog = page.getByRole("dialog", { name: "Edit Player" });
  await editDialog.locator("#player-grade").fill("9");
  await editDialog.getByRole("button", { name: "Save" }).click();
  await expect(page.getByTestId("player-grade-player-1")).toContainText("9");

  await page
    .getByRole("button", { name: /Actions for Test Player/ })
    .click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  await expect(playersSection(page).getByText("Test Player")).toHaveCount(0);
});

test("player login lands on dashboard with completed seasons", async ({
  page,
}) => {
  await page.goto("/programs");
  await signInAsPlayer(page);

  await expect(page).toHaveURL(/\/player$/);
  await expect(
    page.getByRole("heading", { name: "Player Dashboard" }),
  ).toBeVisible();
  await expect(page.getByTestId("player-dashboard")).toContainText(
    "July 2025",
  );
  await expect(page.getByRole("link", { name: "My Dashboard" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Grade" })).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: "Games played" }),
  ).toBeVisible();
});
