import { expect, test, type Page } from "@playwright/test";

async function resetAndSignIn(page: Page, account: "admin" | "user") {
  await page.context().clearCookies();
  const seed = await page.request.post("/api/admin/seed");
  expect(seed.ok()).toBeTruthy();
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByTestId("sign-in-button").click();
  await page.getByRole("button", { name: `Use ${account}` }).click();
  await page
    .getByRole("dialog", { name: "Sign in" })
    .getByRole("button", { name: "Sign in" })
    .click();
  await expect(page.getByRole("button", { name: "Account menu" })).toContainText(
    account === "admin" ? "Alex Admin" : "Jordan Rivera",
  );
}

test("platform home links to the organization", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByTestId("home-platform")).toBeVisible();
  const orgCard = page
    .getByTestId("platform-organizations")
    .getByRole("link", { name: "Shifty Player" });
  await expect(orgCard).toHaveAttribute("href", "/o/shifty-player");

  await orgCard.click();
  await expect(page).toHaveURL(/\/o\/shifty-player$/);
  await expect(page.getByTestId("home-jumbotron")).toBeVisible();
});

test("unknown organization shows the 404 page", async ({ page }) => {
  await page.goto("/o/does-not-exist");

  // The response streams, so the status is 200; Next.js adds noindex instead.
  await expect(
    page.getByRole("heading", { name: "This page could not be found." }),
  ).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex",
  );
});

test("old program URLs redirect into the organization", async ({ page }) => {
  await page.goto("/programs");

  await expect(page).toHaveURL(/\/o\/shifty-player\/programs$/);
  await expect(page.getByRole("heading", { name: "Programs" })).toBeVisible();
});

test("old admin program URLs redirect for admins", async ({ page }) => {
  await resetAndSignIn(page, "admin");
  await page.goto("/dashboard/programs/program-winter-2026");

  await expect(page).toHaveURL(
    /\/o\/shifty-player\/admin\/programs\/program-winter-2026$/,
  );
  await expect(page.getByTestId("program-detail")).toContainText("Winter 2026");
});

test("old player URL redirects parents to their account", async ({ page }) => {
  await resetAndSignIn(page, "user");
  await page.goto("/player");

  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByTestId("account-org-shifty-player")).toBeVisible();
});

test("public organization state has no players", async ({ playwright, baseURL }) => {
  const request = await playwright.request.newContext({ baseURL });
  const response = await request.get("/api/orgs/org-shifty-player/state");

  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(body.state.programs.length).toBeGreaterThan(0);
  expect(body.state.players).toHaveLength(0);
  await request.dispose();
});
