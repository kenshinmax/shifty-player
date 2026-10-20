import { expect, test } from "@playwright/test";

test("admin creates a draft organization, switches orgs, then publishes it", async ({
  page,
  browser,
}) => {
  // The e2e server's store outlives a test run, so use a fresh slug each time.
  const suffix = Date.now().toString(36);
  const name = `Bay Hoops ${suffix}`;
  const slug = `bay-hoops-${suffix}`;

  await page.context().clearCookies();
  expect((await page.request.post("/api/admin/seed")).ok()).toBeTruthy();
  await page.goto("/o/shifty-player/admin");
  await page.getByTestId("sign-in-button").click();
  await page.getByRole("button", { name: "Use admin" }).click();
  await page
    .getByRole("dialog", { name: "Sign in" })
    .getByRole("button", { name: "Sign in" })
    .click();
  await expect(page).toHaveURL(/\/o\/shifty-player\/admin$/);

  await page.getByTestId("dashboard-nav-organizations").click();
  const form = page.getByTestId("create-organization-form");
  await form.getByLabel("Name").fill(name);
  await expect(form.getByLabel("URL")).toHaveValue(slug);
  await form.getByRole("button", { name: "Create organization" }).click();

  // Lands on the new, empty draft org's dashboard.
  await expect(page).toHaveURL(new RegExp(`/o/${slug}/admin$`));
  await expect(page.getByTestId("org-switcher-trigger")).toContainText(`${name} (draft)`);

  // Visitors can't see a draft org.
  const visitor = await browser.newPage();
  await visitor.goto(`/o/${slug}`);
  await expect(
    visitor.getByRole("heading", { name: "This page could not be found." }),
  ).toBeVisible();

  // Switch back to Shifty Player with the drop-down.
  await page.getByTestId("org-switcher-trigger").click();
  await page.getByRole("option", { name: "Shifty Player" }).click();
  await expect(page).toHaveURL(/\/o\/shifty-player\/admin$/);

  // Publish the draft; visitors can then open its pages.
  await page.getByTestId("dashboard-nav-organizations").click();
  const row = page.getByTestId(`organization-row-${slug}`);
  await expect(row).toContainText("draft");
  await row.getByRole("button", { name: "Publish" }).click();
  await expect(row).toContainText("live");

  await visitor.goto(`/o/${slug}`);
  await expect(visitor.getByTestId("home-jumbotron")).toBeVisible();
  await visitor.close();
});
