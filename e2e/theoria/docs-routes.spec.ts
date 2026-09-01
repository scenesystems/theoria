import { expect, test } from "@playwright/test"
import { Schema } from "effect"

import { DocsManifestJson } from "@theoria/docs-model"

test("every generated package, guide, and API navigation route resolves", async ({ browserName, page }) => {
  test.skip(browserName !== "chromium", "The generated route matrix is engine-independent")
  test.slow()

  const manifestResponse = await page.request.get("/docs-data/manifest.json")
  expect(manifestResponse.ok()).toBe(true)
  const manifest = Schema.decodeUnknownSync(DocsManifestJson)(await manifestResponse.text())

  for (const docsPackage of manifest.packages) {
    await page.goto(docsPackage.overview.path)
    await expect(page.locator("main h1")).toBeVisible()

    const expectedPaths = [
      docsPackage.overview.path,
      ...docsPackage.guides.map((guide) => guide.path),
      ...docsPackage.apiModules.map((module) => module.path)
    ]
    const sidebar = page.getByRole("complementary", { name: "Documentation navigation" })
    await expect(sidebar.locator("a")).toHaveCount(expectedPaths.length)

    for (const path of expectedPaths) {
      await sidebar.locator(`a[href="${path}"]`).click()
      await expect(page).toHaveURL(new RegExp(`${path.replaceAll("/", "\\/")}$`, "u"))
      await expect(page.locator("main h1")).toBeVisible()
      await expect(page.getByText("Documentation unavailable", { exact: true })).toHaveCount(0)
      await expect(page.getByText("Page not found", { exact: true })).toHaveCount(0)
    }
  }
})
