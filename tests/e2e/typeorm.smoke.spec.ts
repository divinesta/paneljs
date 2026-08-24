import { expect, test, type Page } from "@playwright/test";

import { TypeormBrowserEnvironment } from "./typeorm.environment.js";

let environment: TypeormBrowserEnvironment;

async function login(page: Page): Promise<void> {
  await page.goto(`${environment.baseUrl}/login`);
  await page.getByLabel("Email address").fill("admin@example.com");
  await page.locator("#admin-password").fill("admin123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(
    page.getByRole("heading", { name: "Available models" }),
  ).toBeVisible();
}

test.describe.serial("TypeORM + Express browser smoke suite", () => {
  test.beforeAll(async () => {
    environment = await TypeormBrowserEnvironment.start();
  });

  test.afterAll(async () => {
    await environment?.stop();
  });

  test("logs in and lists seeded posts", async ({ page }) => {
    await login(page);
    await page.locator(".model-card", { hasText: "Post" }).click();
    await expect(
      page.getByText("120 records available to your account."),
    ).toBeVisible();
    await expect(
      page.getByText("Quarterly update 16", { exact: true }).first(),
    ).toBeVisible();
  });

  test("creates, updates, bulk-updates, and deletes a post", async ({
    page,
  }) => {
    await login(page);
    await page.goto(`${environment.baseUrl}/posts/new`);
    const title = `TypeORM smoke ${Date.now()}`;
    await page.locator("#field-title").fill(title);
    const tenantSearch = page.getByPlaceholder("Search tenants by name");
    await tenantSearch.fill("Northwind");
    await page
      .getByRole("option", { name: /Northwind/ })
      .getByRole("button")
      .click();
    const authorSearch = page.getByPlaceholder("Search users by email");
    await authorSearch.fill("ada@example.test");
    await page
      .getByRole("option", { name: /ada@example\.test/ })
      .getByRole("button")
      .click();
    await page.getByRole("button", { name: "Create record" }).click();
    await expect(page.locator("#field-title")).toHaveValue(title);

    await page.goto(`${environment.baseUrl}/posts`);
    await page.getByLabel("Search Post").fill(title);
    await page.getByLabel("Search Post").press("Enter");
    await page.locator("tbody tr").filter({ hasText: title }).click();
    await expect(page.locator("#field-title")).toHaveValue(title);
    await page.locator("#field-title").fill(`${title} updated`);
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.locator("#field-title")).toHaveValue(`${title} updated`);

    await page.goto(`${environment.baseUrl}/posts`);
    await page.getByLabel("Select all records on this page").check();
    await page
      .getByRole("combobox", { name: "Choose an action" })
      .selectOption("publish_selected");
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Run action" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "Published" }),
    ).toBeVisible();

    await page
      .locator("tbody tr")
      .filter({ hasText: `${title} updated` })
      .getByRole("checkbox")
      .check();
    await page
      .getByRole("combobox", { name: "Choose an action" })
      .selectOption("delete_selected");
    await page.getByRole("button", { name: "Delete selected" }).click();
    await page.getByRole("button", { name: "Confirm delete" }).click();
    await expect(page.getByText(`${title} updated`)).toHaveCount(0);
  });

  test("deletes related posts when their author is deleted", async ({
    page,
  }) => {
    await login(page);
    await page.goto(`${environment.baseUrl}/users`);
    await page
      .getByLabel("Search User")
      .fill("katherine-johnson.northwind@example.test");
    await page.getByLabel("Search User").press("Enter");
    await page.getByLabel("Select all records on this page").check();
    await page
      .getByRole("combobox", { name: "Choose an action" })
      .selectOption("delete_selected");
    await page.getByRole("button", { name: "Delete selected" }).click();
    await expect(page.getByText("Post: Team memo 5")).toBeVisible();
    await expect(page.getByText("Will be deleted").first()).toBeVisible();
    await page.getByRole("button", { name: "Confirm delete" }).click();

    await page.goto(`${environment.baseUrl}/posts`);
    await page.getByLabel("Search Post").fill("Team memo 5");
    await page.getByLabel("Search Post").press("Enter");
    await expect(
      page.getByText("2 records available to your account."),
    ).toBeVisible();
  });
});
