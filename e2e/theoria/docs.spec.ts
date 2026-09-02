import { expect, test, type Page } from "@playwright/test"

const captureBrowserFailures = (page: Page) => {
  const consoleErrors: Array<string> = []
  const pageErrors: Array<string> = []

  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text())
  })
  page.on("pageerror", (error) => pageErrors.push(error.message))

  return { consoleErrors, pageErrors }
}

const expectNoBrowserFailures = (failures: ReturnType<typeof captureBrowserFailures>) => {
  expect(failures.consoleErrors).toEqual([])
  expect(failures.pageErrors).toEqual([])
}

test("the imagined place on the landing page links into the package documentation without a reload", async ({ page }) => {
  const failures = captureBrowserFailures(page)
  let documentRequests = 0
  page.on("request", (request) => {
    if (request.resourceType() === "document") documentRequests += 1
  })

  await page.goto("/")
  await expect(
    page.getByRole("heading", { level: 1, name: "Scientific computing and model programming with Effect" })
  ).toBeVisible()
  await expect(page.locator("[data-place-render-phase='complete']")).toBeVisible({ timeout: 20_000 })
  await expect(page.locator("[data-place-step]")).toHaveCount(4)
  await expect(page.locator("[data-place-step='arrange'] a[href='/docs/effect-search']")).toHaveCount(1)

  const headerNavigationStarted = performance.now()
  await page.locator("header").getByRole("link", { exact: true, name: "Docs" }).click()
  await expect(page.getByRole("heading", { level: 1, name: "Packages" })).toBeVisible()
  expect(performance.now() - headerNavigationStarted).toBeLessThan(1_500)
  expect(documentRequests).toBe(1)

  await page.goto("/")
  await expect(page.locator("[data-place-render-phase='complete']")).toBeVisible({ timeout: 20_000 })
  const pillNavigationStarted = performance.now()
  await page.locator("[data-place-step='arrange'] a[href='/docs/effect-search']").click()
  await expect(page.getByRole("heading", { level: 1, name: "@scenesystems/effect-search" })).toBeVisible()
  expect(performance.now() - pillNavigationStarted).toBeLessThan(1_500)
  expect(documentRequests).toBe(2)
  expectNoBrowserFailures(failures)
})

test("docs navigation, package selection, and focused API caching stay coherent", async ({ page }) => {
  const failures = captureBrowserFailures(page)
  const docsRequests: Array<string> = []
  page.on("request", (request) => {
    if (request.url().includes("/docs-data/")) docsRequests.push(request.url())
  })

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto("/docs/effect-search")
  const apiToggle = page.getByRole("button", { name: "Toggle api navigation" })
  await expect(page.getByRole("link", { exact: true, name: "Study" })).toBeHidden()
  await apiToggle.click()
  await expect(page.getByRole("link", { exact: true, name: "Study" })).toBeVisible()
  await apiToggle.click()
  await expect(page.getByRole("link", { exact: true, name: "Study" })).toBeHidden()
  await apiToggle.click()
  await expect(page.getByRole("link", { exact: true, name: "Study" })).toBeVisible()

  await page.getByRole("link", { exact: true, name: "Getting started" }).click()
  await expect(page.getByRole("heading", { level: 1, name: "Getting started" })).toBeVisible()
  await expect(page.getByRole("link", { exact: true, name: "Getting started" })).toHaveAttribute(
    "aria-current",
    "page"
  )

  await page.getByRole("link", { exact: true, name: "Study" }).click()
  await expect(page.getByRole("heading", { level: 1, name: "Study" })).toBeVisible()
  await expect(page.getByText("Runs, observes, snapshots, and resumes optimization studies.")).toBeVisible()

  await page.locator('a[href="#api-ask"]').click()
  await expect(page).toHaveURL(/\/docs\/effect-search\/api\/Study#api-ask$/u)
  await expect(page.getByRole("heading", { level: 1, name: "ask" })).toBeVisible()
  await expect(page.getByText("Reserves the next sampled configuration and emits TrialStarted", { exact: false })).toBeVisible()
  expect(docsRequests.filter((url) => url.endsWith("/Study/api-ask.json"))).toHaveLength(1)

  await page.getByRole("link", { exact: true, name: "← Study" }).click()
  await page.locator('a[href="#api-ask"]').click()
  await expect(page.getByRole("heading", { level: 1, name: "ask" })).toBeVisible()
  expect(docsRequests.filter((url) => url.endsWith("/Study/api-ask.json"))).toHaveLength(1)

  await page.getByRole("button", { name: "Choose package" }).click()
  await page.getByRole("menuitem").filter({ hasText: "@scenesystems/effect-math" }).click()
  await expect(page).toHaveURL(/\/docs\/effect-math$/u)
  await expect(page.getByRole("heading", { level: 1, name: "@scenesystems/effect-math" })).toBeVisible()
  await page.getByRole("link", { name: "Documentation home" }).click()
  await expect(page.getByRole("heading", { level: 1, name: "Packages" })).toBeVisible()
  expectNoBrowserFailures(failures)
})

test("guide navigation preserves a useful loading shell", async ({ page }) => {
  const failures = captureBrowserFailures(page)
  let releaseGuide: () => void = () => undefined
  const guideGate = new Promise<void>((resolve) => {
    releaseGuide = resolve
  })
  await page.route("**/packages/effect-search/guides/getting-started.json", async (route) => {
    await guideGate
    await route.continue()
  })

  await page.goto("/docs/effect-search")
  await page.getByRole("link", { exact: true, name: "Getting started" }).click()
  await expect(page.locator('[data-docs-skeleton="guide"]')).toBeVisible()
  releaseGuide()
  await expect(page.getByRole("heading", { level: 1, name: "Getting started" })).toBeVisible()
  await expect(page.locator('[data-docs-skeleton="guide"]')).toHaveCount(0)
  expectNoBrowserFailures(failures)
})

test("package guides keep runnable examples and public API links in the documentation", async ({ page }) => {
  const failures = captureBrowserFailures(page)

  await page.goto("/docs/effect-search/examples")
  await expect(page.getByRole("heading", { level: 1, name: "Examples" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Quick start" })).toBeVisible()
  const guideCode = page.getByRole("region", { name: "ts code example" })
  await expect(guideCode.locator("pre code > span:first-child > span:last-child")).toContainText(/^import/u)
  await expect(guideCode).toContainText("SearchSpace")
  await expect(guideCode.locator('[class~="text-code-keyword"], [class~="text-code-type"]')).not.toHaveCount(0)
  await expect(guideCode.getByRole("button", { name: "Copy ts" })).toBeVisible()

  await page.goto("/docs/effect-math/domains")
  const contractsLink = page.getByRole("link", { exact: true, name: "@scenesystems/effect-math/contracts" })
  await expect(contractsLink).toHaveAttribute("href", "/docs/effect-math/api/contracts")
  await contractsLink.click()
  await expect(page.getByRole("heading", { level: 1, name: "contracts" })).toBeVisible()
  expectNoBrowserFailures(failures)
})

test("search is typo-tolerant, fast, cached, and routable", async ({ page }) => {
  const failures = captureBrowserFailures(page)
  let searchIndexRequests = 0
  page.on("request", (request) => {
    if (request.url().endsWith("/search-index.json")) searchIndexRequests += 1
  })

  await page.goto("/docs/effect-search")
  await page.getByRole("button", { name: "Search documentation" }).click()
  const input = page.getByRole("combobox", { name: "Search" })
  await expect(input).toBeVisible()
  const searchStarted = performance.now()
  await input.fill("resreves trial")
  const askResult = page.getByRole("option", { name: /Study\.ask/u })
  await expect(askResult).toBeVisible()
  expect(performance.now() - searchStarted).toBeLessThan(750)
  expect(searchIndexRequests).toBe(1)
  await askResult.click()
  await expect(page.getByRole("heading", { level: 1, name: "ask" })).toBeVisible()

  await page.getByRole("button", { name: "Search documentation" }).click()
  await expect(input).toBeVisible()
  await input.fill("zzzz-no-such-symbol")
  await expect(page.getByText("No results", { exact: true })).toBeVisible()
  expect(searchIndexRequests).toBe(1)
  expectNoBrowserFailures(failures)
})

test("focused signatures highlight and copy their real source", async ({ browserName, context, page }) => {
  test.skip(browserName !== "chromium", "Clipboard permissions are qualified in Chromium")
  const failures = captureBrowserFailures(page)
  await context.grantPermissions(["clipboard-read", "clipboard-write"])

  await page.goto("/docs/effect-search/api/Study#api-ask")
  await expect(page.getByRole("heading", { level: 1, name: "ask" })).toBeVisible()
  const signature = page.getByRole("region", { name: "Signature code example" })
  await expect(signature.locator('[class~="text-code-keyword"], [class~="text-code-type"]')).not.toHaveCount(0)
  await expect(page.locator("dt code").first().locator('[class^="text-code-"], [class*=" text-code-"]')).not.toHaveCount(0)
  await signature.getByRole("button", { name: "Copy Signature" }).click()
  await expect(signature.getByRole("button", { name: "Copied Signature" })).toBeVisible()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("ask")
  expectNoBrowserFailures(failures)
})
