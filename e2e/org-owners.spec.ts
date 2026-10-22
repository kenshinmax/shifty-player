import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page, email: string, password: string) {
  await page.getByTestId("sign-in-button").click();
  const dialog = page.getByRole("dialog", { name: "Sign in" });
  await dialog.getByLabel("Email").fill(email);
  await dialog.getByLabel("Password").fill(password);
  await dialog.getByRole("button", { name: "Sign in" }).click();
}

test("an org owner sees only their own organization", async ({ page, browser }) => {
  // The e2e server's store outlives a test run, so use fresh names each time.
  const suffix = Date.now().toString(36);
  const name = `Owner Hoops ${suffix}`;
  const slug = `owner-hoops-${suffix}`;
  const ownerEmail = `owner-${suffix}@example.com`;

  await page.context().clearCookies();
  expect((await page.request.post("/api/admin/seed")).ok()).toBeTruthy();

  // The platform admin creates a draft org with an owner.
  await page.goto("/o/shifty-player/admin");
  await page.getByTestId("sign-in-button").click();
  await page.getByRole("button", { name: "Use admin" }).click();
  await page
    .getByRole("dialog", { name: "Sign in" })
    .getByRole("button", { name: "Sign in" })
    .click();
  await page.getByTestId("dashboard-nav-organizations").click();
  const form = page.getByTestId("create-organization-form");
  await form.getByLabel("Name", { exact: true }).fill(name);
  await form.getByLabel("Owner name").fill("Sam Coach");
  await form.getByLabel("Owner email").fill(ownerEmail);
  await form.getByLabel("Starting password").fill("hoops");
  await form.getByRole("button", { name: "Create organization" }).click();
  await expect(page).toHaveURL(new RegExp(`/o/${slug}/admin$`));

  await page.getByTestId("dashboard-nav-organizations").click();
  await expect(page.getByTestId(`organization-owners-${slug}`)).toContainText(ownerEmail);

  // "Open admin" on the org already open goes back to its overview.
  await page.getByTestId(`organization-row-${slug}`).getByRole("link", { name: "Open admin" }).click();
  await expect(page.getByTestId("dashboard-registration")).toBeVisible();

  // The owner signs in and lands on their own (still draft) org's admin.
  const owner = await (await browser.newContext()).newPage();
  await owner.goto("/");
  await signIn(owner, ownerEmail, "hoops");
  await expect(owner).toHaveURL(new RegExp(`/o/${slug}/admin$`));
  await expect(owner.getByTestId("admin-dashboard")).toBeVisible();

  // No platform controls: no org switcher and no Organizations section.
  await expect(owner.getByTestId("org-switcher")).toHaveCount(0);
  await expect(owner.getByTestId("dashboard-nav-organizations")).toHaveCount(0);

  // Another org's admin sends them back to their own.
  await owner.goto("/o/shifty-player/admin");
  await expect(owner).toHaveURL(new RegExp(`/o/${slug}/admin$`));

  // The platform APIs stay closed to them.
  expect((await owner.request.get("/api/platform/organizations")).status()).toBe(403);
  await owner.close();
});

test("the platform admin assigns an existing account as an org's owner", async ({ page }) => {
  const suffix = Date.now().toString(36);
  const slug = `assigned-hoops-${suffix}`;
  const email = `parent-${suffix}@example.com`;

  // Someone signs up as a normal account first.
  await page.context().clearCookies();
  expect(
    (await page.request.post("/api/auth/signup", {
      data: { name: "Riley Parent", email, password: "hoops" },
    })).ok(),
  ).toBeTruthy();
  await page.context().clearCookies();

  await page.goto("/o/shifty-player/admin");
  await page.getByTestId("sign-in-button").click();
  await page.getByRole("button", { name: "Use admin" }).click();
  await page
    .getByRole("dialog", { name: "Sign in" })
    .getByRole("button", { name: "Sign in" })
    .click();
  await page.getByTestId("dashboard-nav-organizations").click();
  const form = page.getByTestId("create-organization-form");
  await form.getByLabel("Name", { exact: true }).fill(`Assigned Hoops ${suffix}`);
  await form.getByRole("button", { name: "Create organization" }).click();
  await expect(page).toHaveURL(new RegExp(`/o/${slug}/admin$`));

  // Assign them from the org list using only their email.
  await page.getByTestId("dashboard-nav-organizations").click();
  await page
    .getByTestId(`organization-owners-${slug}`)
    .getByRole("button", { name: "Add owner" })
    .click();
  const dialog = page.getByTestId("add-owner-dialog");
  await dialog.getByLabel("Owner email").fill(email);
  await dialog.getByRole("button", { name: "Add owner" }).click();
  await expect(page.getByTestId(`organization-owners-${slug}`)).toContainText("Riley Parent");
  await expect(
    page.getByTestId(`organization-owners-${slug}`).getByRole("button", { name: "Add owner" }),
  ).toHaveCount(0);

  // They sign in with their existing password and land on that org's admin.
  await page.context().clearCookies();
  await page.goto("/");
  await signIn(page, email, "hoops");
  await expect(page).toHaveURL(new RegExp(`/o/${slug}/admin$`));
});
