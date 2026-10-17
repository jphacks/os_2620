import { expect, test } from "@playwright/test";
test("dashboard to inventory flow", async ({page}) => { await page.goto("/"); await expect(page.getByText("おはようございます。")).toBeVisible(); await page.getByRole("button",{name:"在庫", exact:true}).click(); await expect(page.getByRole("heading",{name:"いまある食材"})).toBeVisible(); });
