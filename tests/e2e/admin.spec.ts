import { expect, test, type Page } from "@playwright/test";

import { BrowserEnvironment } from "./environment.js";

const superAdmin = {
  email: "e2e-super@paneljs.test",
  password: "phase10-super-secret",
};
const tenantAdmin = {
  email: "e2e-admin@paneljs.test",
  password: "phase10-admin-secret",
};

let environment: BrowserEnvironment;

async function login(page: Page, credentials = superAdmin): Promise<void> {
  await page.goto(`${environment.baseUrl}/login`);
  await page.getByLabel("Email address").fill(credentials.email);
  await page.locator("#admin-password").fill(credentials.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(
    page.getByRole("heading", { name: "Available models" }),
  ).toBeVisible();
}

test.describe.serial("canonical Prisma + Express browser suite", () => {
  test.beforeAll(async () => {
    environment = await BrowserEnvironment.start();
  });

  test.afterAll(async () => {
    await environment?.stop();
  });

  test("UI-001/UI-002/UI-003 redirects to login, protects invalid login, and persists a valid session", async ({
    page,
  }) => {
    await page.goto(environment.baseUrl);
    await expect(page).toHaveURL(`${environment.baseUrl}/login`);

    await page.getByLabel("Email address").fill(superAdmin.email);
    await page.locator("#admin-password").fill("not-the-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("alert")).toHaveText("Invalid credentials.");

    await page.locator("#admin-password").fill(superAdmin.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(
      page.getByRole("heading", { name: "Available models" }),
    ).toBeVisible();
    await page.locator(".model-card", { hasText: "Post" }).click();
    await expect(page.getByRole("heading", { name: "Post" })).toBeVisible();
  });

  test("UI-004/UI-005 logs out and presents only the current user's permitted models", async ({
    page,
  }) => {
    await login(page, tenantAdmin);
    await expect(
      page.getByRole("link", { name: "Post", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "ExpressAdminUser" }),
    ).toHaveCount(0);

    await page.getByRole("button", { name: tenantAdmin.email }).click();
    await page.getByRole("button", { name: "Log out" }).click();
    await expect(page).toHaveURL(`${environment.baseUrl}/login`);
  });

  test("UI-006 through UI-012 lists, searches, filters, sorts, paginates, and reports an empty result", async ({
    page,
  }) => {
    await login(page);
    await page.goto(`${environment.baseUrl}/posts`);
    await expect(
      page.getByText("40 records available to your account."),
    ).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: /Title/ }),
    ).toBeVisible();
    await expect(page.getByText("Ada Lovelace").first()).toBeVisible();

    const search = page.getByLabel("Search Post");
    await search.fill("Quarterly update 1");
    await search.press("Enter");
    await expect(page.getByText("Quarterly update 1").first()).toBeVisible();
    await expect(page.getByText("Showing 1–1 of 1")).toBeVisible();

    await page.getByRole("button", { name: "Reset" }).click();
    const publishedFilter = page
      .locator(".filter-control")
      .filter({ hasText: "Published" })
      .locator("select");
    await publishedFilter.selectOption("false");
    await expect(
      page.getByText("10 records available to your account."),
    ).toBeVisible();
    await page.getByRole("button", { name: "Reset" }).click();

    await page.getByRole("button", { name: /Title/ }).click();
    await expect(
      page.getByRole("columnheader", { name: /Title/ }),
    ).toHaveAttribute("aria-sort", "ascending");
    await page.getByRole("button", { name: "Next page" }).click();
    await expect(page.getByText("Page 2 of 2")).toBeVisible();

    await search.fill("this text has no seeded match");
    await search.press("Enter");
    await expect(
      page.getByText("No records match your current view."),
    ).toBeVisible();
  });

  test("UI-013/UI-015/UI-016/UI-018/UI-019/UI-020 renders relations and persists create and update flows", async ({
    page,
  }) => {
    await login(page);
    await page.goto(`${environment.baseUrl}/posts/new`);
    const title = `Browser-created post ${Date.now()}`;
    await page.locator("#field-title").fill(title);
    await page.getByRole("button", { name: "Create record" }).click();
    await expect(page.getByText("Author is required.")).toBeVisible();
    await expect(page.locator("#field-title")).toHaveValue(title);

    await page
      .locator("#field-content")
      .fill("Created by the canonical browser suite.");
    await page.locator("#field-tenantId").fill("example-tenant-northwind");
    const authorSearch = page.getByPlaceholder("Search users by email");
    await authorSearch.fill("ada");
    await page
      .getByRole("option", { name: /ada@example\.test/ })
      .getByRole("button")
      .click();
    await page.getByRole("button", { name: "Create record" }).click();
    await expect(page.getByRole("heading", { name: "Post" })).toBeVisible();
    await expect(page.getByText(title)).toBeVisible();
    await expect(page.locator("#field-id")).toHaveCount(0);

    await page.getByRole("button", { name: "Go back" }).click();
    await page.getByLabel("Search Post").fill(title);
    await page.getByLabel("Search Post").press("Enter");
    await page.locator("tbody tr").filter({ hasText: title }).click();
    await expect(
      page.getByRole("heading", { name: "Edit Post" }),
    ).toBeVisible();
    await page.locator("#field-title").fill(`${title} updated`);
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText(`${title} updated`)).toBeVisible();
  });

  test("UI-014/UI-017/UI-021 hides disallowed write and delete routes for an administrator", async ({
    page,
  }) => {
    await login(page, tenantAdmin);
    await page.goto(`${environment.baseUrl}/posts`);
    await expect(page.getByRole("link", { name: "New Post" })).toBeVisible();
    await page.getByLabel("Select all records on this page").check();
    await expect(
      page.getByRole("button", { name: "Delete selected" }),
    ).toHaveCount(0);
    await page.goto(`${environment.baseUrl}/posts/delete?ids=example-post-1-1`);
    await expect(
      page.getByRole("heading", { name: "Page not found" }),
    ).toBeVisible();
  });

  test("UI-022/UI-023/UI-024/UI-029 confirms bulk actions and deletion", async ({
    page,
  }) => {
    await login(page);
    await page.goto(`${environment.baseUrl}/posts`);
    await page.getByLabel("Select all records on this page").check();
    await expect(page.getByText("25 selected")).toBeVisible();

    await page
      .getByRole("combobox", { name: "Choose an action" })
      .selectOption("publish_selected");
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Run action" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "Published 25 posts." }),
    ).toBeVisible();

    await page.getByLabel("Select example-post-1-1").check();
    await page
      .getByRole("combobox", { name: "Choose an action" })
      .selectOption("delete_selected");
    await page.getByRole("button", { name: "Delete selected" }).click();
    await expect(
      page.getByRole("heading", { name: "Delete 1 Post?" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Confirm delete" }).click();
    await expect(page).toHaveURL(`${environment.baseUrl}/posts`);
  });

  test("UI-032 resolves direct model routes and browser navigation", async ({
    page,
  }) => {
    await login(page);
    await page.goto(`${environment.baseUrl}/posts`);
    await page.getByRole("button", { name: "Next page" }).click();
    await page.goBack();
    await expect(page.getByText("Page 1 of 2")).toBeVisible();
    await page.goto(`${environment.baseUrl}/products`);
    await expect(page.getByRole("heading", { name: "Product" })).toBeVisible();
  });
});
