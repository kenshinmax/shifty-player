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
    "Jordan Rivera",
  );
}

async function clearClientState(page: Page) {
  await page.context().clearCookies();
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  const seed = await page.request.post("/api/admin/seed");
  expect(seed.ok()).toBeTruthy();
  await page.reload();
}

test("admin dashboard players and payment links", async ({ page }) => {
  await clearClientState(page);
  await page.goto("/programs");

  await expect(page.getByRole("heading", { name: "Programs" })).toBeVisible();
  await expect(page.getByTestId("session-megatron")).toContainText("Week 1");
  await expect(page.getByTestId("session-cards")).toHaveCount(0);
  await expect(page.getByTestId("summer-2027-programs")).toContainText(
    "Summer 2027 Camps & Showcases",
  );
  await expect(page.getByTestId("summer-2027-card-summer-camp")).toContainText(
    "Summer Camp",
  );
  await expect(page.getByTestId("summer-2027-card-summer-camp")).toContainText(
    "July – Aug",
  );
  await expect(page.getByTestId("summer-2027-card-summer-camp")).toContainText(
    "5–10th",
  );
  await expect(page.getByTestId("summer-2027-card-summer-camp")).toContainText(
    "Summer",
  );
  await expect(page.getByTestId("summer-2027-card-summer-camp")).toContainText(
    "Weston, CT",
  );
  await expect(page.getByTestId("summer-2027-card-summer-camp")).toContainText(
    "$460 per week",
  );
  await expect(
    page.getByTestId("summer-2027-card-summer-camp").getByRole("link", {
      name: "Register Now",
    }),
  ).toHaveAttribute("href", "/login?next=/player");
  await expect(page.getByTestId("summer-2027-card-showcases")).toContainText(
    "Showcases",
  );
  await expect(page.getByTestId("programs-values")).toContainText("Work hard");
  await expect(page.getByTestId("programs-values")).toContainText("Play smart");
  await expect(page.getByTestId("programs-values")).toContainText("Compete");
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
  await expect(page.getByTestId("dashboard-nav-programs")).toBeVisible();
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

  await page.getByTestId("dashboard-nav-financials").click();
  await expect(page.getByTestId("financials-players-table")).toBeVisible();
  await expect(page.getByTestId("financials-status-tabs")).toBeVisible();
  await expect(page.getByTestId("financials-player-row-player-child-2")).toContainText(
    "Lucas Rivera",
  );
  await expect(page.getByTestId("financials-player-row-player-child-2")).toContainText(
    "New player",
  );
  await expect(page.getByTestId("financials-player-row-player-child-2")).toContainText(
    "$460.00",
  );
  await expect(page.getByTestId("financials-player-row-player-child-2")).toContainText(
    "Enrolled / Paid",
  );

  await page.getByTestId("financials-tab-paid").click();
  await expect(page.getByTestId("financials-player-row-player-child-2")).toBeVisible();
  await expect(page.getByTestId("financials-player-row-player-1")).toHaveCount(0);

  await page.getByTestId("financials-tab-unpaid").click();
  await expect(page.getByTestId("financials-player-row-player-1")).toBeVisible();
  await expect(page.getByTestId("financials-player-row-player-child-2")).toHaveCount(0);

  await page.getByTestId("financials-tab-all").click();
  await expect(page.getByTestId("financials-player-row-player-child-2")).toBeVisible();
  await expect(page.getByTestId("financials-player-row-player-1")).toBeVisible();

  await page.getByTestId("dashboard-nav-rosters").click();
  await expect(page.getByRole("button", { name: "Add Player" })).toBeVisible();
  await expect(page.getByTestId("players-roster-grid")).toBeVisible();
  await expect(
    playersSection(page).getByRole("button", { name: /Actions for/ }),
  ).toHaveCount(12);

  await page.getByTestId("dashboard-nav-programs").click();
  await expect(page.getByTestId("dashboard-programs")).toContainText("Winter");
  await expect(page.getByTestId("admin-schedule-availability")).toContainText(
    "Program & clinic availability",
  );
  await expect(page.getByTestId("add-program-link")).toBeVisible();
  await page.getByTestId("manage-program-program-winter-2026").click();
  await expect(page).toHaveURL(/\/dashboard\/programs\/program-winter-2026$/);
  await expect(page.getByTestId("program-detail")).toContainText("Winter 2026");
  await expect(page.getByTestId("program-roster")).toBeVisible();
  await page.getByRole("link", { name: "Back" }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  await page.getByTestId("dashboard-nav-programs").click();
  await page.getByTestId("add-program-link").click();
  await expect(page).toHaveURL(/\/dashboard\/programs\/new$/);
  await page.locator("#program-name").fill("Spring Camp");
  await page.locator("#program-description").fill("Admin-created spring program.");
  await page.locator("#program-start-date").fill("2027-04-01");
  await page.locator("#program-end-date").fill("2027-04-30");
  await page.locator("#program-spots").fill("50");
  await page.getByRole("button", { name: "Create program" }).click();
  await expect(page.getByTestId("program-detail")).toContainText(
    "Spring Camp",
  );
  await expect(page.getByTestId("program-roster")).toContainText(
    "No players registered yet.",
  );
  await page.getByRole("link", { name: "Back" }).click();

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

test("register now opens login page with signup for guests", async ({
  page,
}) => {
  await clearClientState(page);
  await page.goto("/programs");

  await page
    .getByTestId("summer-2027-card-summer-camp")
    .getByRole("link", { name: "Register Now" })
    .click();

  await expect(page).toHaveURL(/\/login\?next=\/player/);
  await expect(page.getByTestId("login-page")).toBeVisible();
  await expect(page.getByTestId("login-form-card")).toBeVisible();
  await expect(page.getByTestId("signup-form-card")).toBeVisible();

  await page.getByTestId("login-form-card").getByRole("button", { name: "Use user" }).click();
  await page.getByTestId("login-form-card").getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/player$/);
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
});

test("quick signup on login page creates a parent account", async ({
  page,
}) => {
  await clearClientState(page);
  await page.goto("/login?next=/player");

  await page.locator("#signup-name").fill("Casey Parent");
  await page.locator("#signup-email").fill("casey.parent@example.com");
  await page.locator("#signup-password").fill("casey");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(/\/player$/);
  await expect(page.getByRole("button", { name: "Account menu" })).toContainText(
    "Casey Parent",
  );
});

test("home register creates an account and lands on the dashboard", async ({ page }) => {
  await clearClientState(page);
  await page.goto("/");

  await page.getByRole("button", { name: "Sign in to register" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Create an account" }).click();
  await expect(page.getByTestId("login-dialog-signup")).toBeVisible();

  await page.locator("#dialog-signup-name").fill("Riley Newparent");
  await page.locator("#dialog-signup-email").fill("riley.newparent@example.com");
  await page.locator("#dialog-signup-password").fill("riley");
  await dialog.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(/\/player$/);
  await expect(page.getByRole("dialog", { name: "Add Player" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Account menu" })).toContainText(
    "Riley Newparent",
  );
});

test("parent login lands on dashboard with program registration", async ({
  page,
}) => {
  await clearClientState(page);
  await page.goto("/programs");
  await signInAsPlayer(page);

  await expect(page).toHaveURL(/\/player$/);
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await expect(page.getByTestId("parent-program-registration")).toBeVisible();
  await expect(page.getByTestId("parent-children-overview")).toContainText(
    "Maya Rivera",
  );
  await expect(page.getByTestId("parent-children-overview")).toContainText(
    "Lucas Rivera",
  );
  await expect(page.getByRole("link", { name: "My Dashboard" })).toBeVisible();

  await page.locator("#register-child").click();
  await page.getByRole("option", { name: /Maya Rivera/ }).click();
  await page.locator("#register-program").click();
  await page.getByRole("option", { name: "Summer Camp 2026" }).click();
  await expect(page.getByTestId("program-clinic-summary")).toContainText(
    "4 available clinic",
  );
  await page.locator("#register-clinic").click();
  await page.getByRole("option", { name: /Week 1/ }).click();
  await page.getByRole("button", { name: "Continue to payment" }).click();

  await expect(page).toHaveURL(
    /\/player\/registration\/player-child-1\/clinic-summer-2026-w1$/,
  );
  await expect(page.getByTestId("registration-review")).toBeVisible();
  await expect(page.getByTestId("registration-player-card")).toContainText(
    "Maya Rivera",
  );
  await expect(page.getByTestId("registration-clinic-card")).toContainText(
    "Summer Camp 2026",
  );
  await expect(page.getByTestId("registration-clinic-card")).toContainText(
    "Week 1",
  );
  await expect(page.getByTestId("registration-payment-form")).toBeVisible();
  // Without Stripe env keys the app uses the demo card form (CI-safe).
  await expect(page.getByTestId("registration-payment-form")).toHaveAttribute(
    "data-payment-mode",
    "demo",
  );

  await page.getByRole("link", { name: "Cancel" }).click();
  await expect(page).toHaveURL(/\/player$/);
  await expect(page.getByTestId("parent-children-overview")).not.toContainText(
    "Week 1",
  );

  await page.locator("#register-child").click();
  await page.getByRole("option", { name: /Maya Rivera/ }).click();
  await page.locator("#register-program").click();
  await page.getByRole("option", { name: "Summer Camp 2026" }).click();
  await page.locator("#register-clinic").click();
  await page.getByRole("option", { name: /Week 1/ }).click();
  await page.getByRole("button", { name: "Continue to payment" }).click();

  // Optional swag on payment page (demo path).
  await expect(page.getByTestId("registration-swag-cart")).toBeVisible();
  await page.getByTestId("swag-add-tshirt").click();
  await expect(page.getByTestId("swag-cart-line")).toContainText("Team T-Shirt");
  await expect(page.getByTestId("registration-order-total")).toContainText(
    "$485.00",
  );

  // Demo checkout path when STRIPE_SECRET_KEY / publishable key are unset.
  await page.locator("#cardholder-name").fill("Jordan Rivera");
  await page.locator("#card-number").fill("4242424242424242");
  await page.locator("#card-expiry").fill("12 / 30");
  await page.locator("#card-cvc").fill("123");
  await page.locator("#billing-zip").fill("06883");
  await page.getByRole("button", { name: /Pay \$485/ }).click();

  await expect(page).toHaveURL(/\/player$/);
  await expect(page.getByTestId("parent-children-overview")).toContainText(
    "Summer Camp 2026",
  );
  await expect(page.getByTestId("parent-children-overview")).toContainText(
    "Week 1",
  );
  await expect(page.getByTestId("active-programs")).toContainText(
    "Summer Camp 2026",
  );
  await expect(page.getByTestId("active-programs")).toContainText(
    "Maya Rivera",
  );
  await expect(page.getByTestId("active-programs")).toContainText("Week 1");
  await expect(page.getByTestId("active-programs")).toContainText("enrolled");

  await page.locator("#history-child").click();
  await page.getByRole("option", { name: "Maya Rivera" }).click();
  await expect(page.getByTestId("player-dashboard")).toContainText(
    "July 2025",
  );
  await expect(page.getByRole("columnheader", { name: "Grade" })).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: "Games played" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await signInAsAdmin(page);
  await page.getByTestId("dashboard-nav-financials").click();
  await page.getByTestId("financials-tab-paid").click();
  await expect(
    page.getByTestId("financials-player-row-player-child-1"),
  ).toContainText("Maya Rivera");
  await expect(
    page.getByTestId("financials-player-row-player-child-1"),
  ).toContainText("Enrolled / Paid");
  await expect(
    page.getByTestId("financials-player-row-player-child-1"),
  ).toContainText("$460.00");
});
