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
      page.locator(".model-card", { hasText: "Post" }),
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
      page.getByText("120 records available to your account."),
    ).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: /Title/ }),
    ).toBeVisible();

    const search = page.getByLabel("Search Post");
    await search.fill("seeded post 16 for Northwind.");
    await search.press("Enter");
    await expect(page.getByText("Showing 1–1 of 1")).toBeVisible();
    await expect(
      page.getByRole("cell", { name: "Quarterly update 16", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("frances-allen.northwind@example.test"),
    ).toBeVisible();

    await page.getByRole("button", { name: "Reset" }).click();
    const publishedFilter = page
      .locator(".filter-control")
      .filter({ hasText: "Published" })
      .locator("select");
    await publishedFilter.selectOption("false");
    await expect(
      page.getByText("30 records available to your account."),
    ).toBeVisible();
    await page.getByRole("button", { name: "Reset" }).click();

    await page.getByRole("button", { name: /Title/ }).click();
    await expect(
      page.getByRole("columnheader", { name: /Title/ }),
    ).toHaveAttribute("aria-sort", "ascending");
    await page.getByRole("button", { name: "Next page" }).click();
    await expect(page.getByText("Page 2 of 3")).toBeVisible();

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
    const tenantSearch = page.getByPlaceholder("Search tenants by name");
    await tenantSearch.fill("Northwind");
    await page
      .getByRole("option", { name: /Northwind/ })
      .getByRole("button")
      .click();
    await page.getByRole("button", { name: "Create record" }).click();
    await expect(page.getByText("Author Id is required.")).toBeVisible();
    await expect(page.locator("#field-title")).toHaveValue(title);

    await page
      .locator("#field-content")
      .fill("Created by the canonical browser suite.");
    const authorSearch = page.getByPlaceholder("Search users by email");
    await authorSearch.fill("ada");
    await page
      .getByRole("option", { name: /ada@example\.test/ })
      .getByRole("button")
      .click();
    await page.getByRole("button", { name: "Create record" }).click();
    await expect(
      page.getByRole("heading", { name: "Post", exact: true }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/posts\/[^/]+$/);
    await expect(page.locator("#field-title")).toHaveValue(title);
    await expect(page.locator("#field-id")).not.toBeEditable();

    await page.goto(`${page.url()}/edit`);
    await expect(
      page.getByRole("heading", { name: "Edit Post" }),
    ).toBeVisible();
    await expect(page.locator("#field-title")).toHaveValue(title);
    await page.locator("#field-title").fill(`${title} updated`);
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.locator("#field-title")).toHaveValue(`${title} updated`);
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
      page.getByRole("heading", { name: "Model not found" }),
    ).toBeVisible();
  });

  test("UI-022/UI-023/UI-024/UI-029 confirms bulk actions and deletion", async ({
    page,
  }) => {
    await login(page);
    await page.goto(`${environment.baseUrl}/posts`);
    await page.getByLabel("Select all records on this page").check();
    await expect(page.getByText("50 selected")).toBeVisible();

    await page
      .getByRole("combobox", { name: "Choose an action" })
      .selectOption("publish_selected");
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Run action" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "Published 50 posts." }),
    ).toBeVisible();

    await page.getByLabel("Search Post").fill("seeded post 1 for Northwind.");
    await page.getByLabel("Search Post").press("Enter");
    await expect(page.getByText("Showing 1–1 of 1")).toBeVisible();
    await page
      .getByRole("checkbox", {
        name: "Select example-post-1-1",
        exact: true,
      })
      .check();
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
    await expect(page.getByRole("heading", { name: "Post" })).toBeVisible();
    await page.goto(`${environment.baseUrl}/products`);
    await expect(page.getByRole("heading", { name: "Product" })).toBeVisible();
    await page.goBack();
    await expect(page.getByRole("heading", { name: "Post" })).toBeVisible();
    await page.goForward();
    await expect(page.getByRole("heading", { name: "Product" })).toBeVisible();
  });
});
