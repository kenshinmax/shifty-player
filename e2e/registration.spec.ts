import { expect, test, type Page } from "@playwright/test";

const playersSection = (page: Page) => page.getByTestId("players-section");

async function signInAsAdmin(page: Page) {
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByTestId("sign-in-menu-item").click();
  await page.getByRole("button", { name: "Use admin" }).click();
  await page
    .getByRole("dialog", { name: "Sign in" })
    .getByRole("button", { name: "Sign in" })
    .click();
  await expect(page.getByRole("button", { name: "Account menu" })).toContainText(
    "Alex Admin",
  );
}

test("admin dashboard players and payment links", async ({ page }) => {
  await page.goto("/seasons");

  await expect(page.getByRole("heading", { name: "Seasons" })).toBeVisible();
  await expect(page.getByTestId("session-megatron")).toContainText("Winter");
  await expect(page.getByTestId("players-section")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Add Player" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Add Session" })).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: "Add Session" })).toHaveCount(0);

  await signInAsAdmin(page);

  await expect(page.getByRole("button", { name: "Add Player" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add Session" })).toHaveCount(0);

  await page.getByRole("link", { name: "Dashboard" }).click();
  await expect(page.getByRole("heading", { name: "Admin Dashboard" })).toBeVisible();
  await expect(playersSection(page).getByRole("button", { name: "Edit" })).toHaveCount(
    10,
  );

  await page.getByRole("button", { name: "Add Player" }).click();
  const playerDialog = page.getByRole("dialog", { name: "Add Player" });
  await playerDialog.locator("#player-name").fill("Test Player");
  await playerDialog.locator("#player-email").fill("test.player@example.com");
  await playerDialog.locator("#player-grade").fill("5");
  await playerDialog.locator("#player-level").click();
  await page.getByRole("option", { name: "Advanced" }).click();
  await playerDialog.getByRole("button", { name: "Add Player" }).click();
  await expect(page.getByRole("row", { name: /Test Player/ })).toBeVisible();

  await page
    .getByRole("row", { name: /Alex Johnson/ })
    .getByRole("button", { name: "Send link" })
    .click();
  await expect(page.getByText("Payment link sent to Alex Johnson")).toBeVisible();
  await expect(
    page.getByRole("row", { name: /Alex Johnson/ }),
  ).toContainText("Sent");

  await page
    .getByRole("row", { name: /Alex Johnson/ })
    .getByRole("button", { name: "Edit" })
    .click();
  const editDialog = page.getByRole("dialog", { name: "Edit Player" });
  await editDialog.locator("#player-grade").fill("9");
  await editDialog.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("row", { name: /Alex Johnson/ })).toContainText("9");

  await page
    .getByRole("row", { name: /Test Player/ })
    .getByRole("button", { name: "Delete" })
    .click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  await expect(page.getByRole("row", { name: /Test Player/ })).toHaveCount(0);
});
