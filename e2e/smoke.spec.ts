import { expect, test } from "@playwright/test";

test("홈 화면이 열리고 닉네임을 입력하는 시작 화면이 보인다", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("끝말잇기");
  await expect(page.getByLabel("닉네임")).toBeVisible();
  await expect(page.getByRole("button", { name: "시작하기" })).toBeVisible();
});
