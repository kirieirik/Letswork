import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/?demo=1");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
});

test("creates a task without a due date", async ({ page }) => {
  await page.getByRole("button", { name: "New task" }).click();
  await page.getByLabel(/Task title/).fill("Prepare onboarding checklist");
  await page.getByLabel("Description").fill("Collect the documents for the new starter.");
  await page.getByRole("button", { name: /Create task/ }).click();

  await expect(page.getByText("Prepare onboarding checklist")).toBeVisible();
  await expect(page.getByText("Task created")).toBeVisible();
});

test("creates a task with a calendar date", async ({ page }) => {
  await page.getByRole("button", { name: "New task" }).click();
  await page.getByLabel(/Task title/).fill("Book annual review");
  await page.getByLabel("Due date").fill("2026-10-01");
  await page.getByRole("button", { name: /Create task/ }).click();

  const taskRow = page.getByRole("button", { name: "Book annual review", exact: true });
  await expect(taskRow).toBeVisible();
  await expect(page.getByText("1 Oct")).toBeVisible();
});

test("requires confirmation before completing a task", async ({ page }) => {
  await page.getByRole("button", { name: "Complete Prepare monthly report" }).click();
  await expect(page.getByRole("heading", { name: "Close task?" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Yes, mark as completed" })).toBeVisible();

  await page.getByRole("button", { name: "Yes, mark as completed" }).click();
  await expect(page.getByText("Task completed")).toBeVisible();
  await page.getByRole("button", { name: /Completed/ }).click();
  await expect(page.getByText("Prepare monthly report")).toBeVisible();
});