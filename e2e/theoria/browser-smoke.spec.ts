import { expect, test, type Page } from "@playwright/test"

type BrowserFailureCapture = {
  readonly failedResponses: Array<string>
  readonly pageErrors: Array<string>
}

const attachBrowserFailureCapture = (page: Page): BrowserFailureCapture => {
  const failedResponses: Array<string> = []
  const pageErrors: Array<string> = []

  page.on("response", (response) => {
    if (response.status() >= 400) {
      failedResponses.push(`${response.status()} ${new URL(response.url()).pathname}`)
    }
  })

  page.on("pageerror", (error) => {
    pageErrors.push(error.message)
  })

  return { failedResponses, pageErrors }
}

const expectNoBrowserFailures = ({ failedResponses, pageErrors }: BrowserFailureCapture): void => {
  expect(failedResponses).toEqual([])
  expect(pageErrors).toEqual([])
}

const transformedAncestor = (element: Element): string => {
  let current: Element | null = element

  while (current !== null) {
    const transform = getComputedStyle(current).transform

    if (transform !== "none") {
      return transform
    }

    current = current.parentElement
  }

  return "none"
}

test("effect-search remains a routeable entry lens on direct load", async ({ page }) => {
  const failures = attachBrowserFailureCapture(page)

  await page.goto("/effect-search")

  await expect(page.getByRole("heading", { name: "effect-search" })).toBeVisible()
  await expect(page.getByRole("button", { name: /Run Live Optimization/i })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Live Stage" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Evidence" })).toBeVisible()

  expectNoBrowserFailures(failures)
})

test("home navigation preserves entry-card hover and runs the effect-search study", async ({ page }) => {
  const failures = attachBrowserFailureCapture(page)

  await page.goto("/")

  const effectSearchLink = page.getByRole("link", { name: "effect-search" }).first()
  await expect(effectSearchLink).toBeVisible()

  await effectSearchLink.hover()
  await expect.poll(async () => effectSearchLink.evaluate(transformedAncestor)).not.toBe("none")

  await page.mouse.move(1, 1)
  await expect.poll(async () => effectSearchLink.evaluate(transformedAncestor)).toBe("none")

  await effectSearchLink.hover()
  await expect.poll(async () => effectSearchLink.evaluate(transformedAncestor)).not.toBe("none")

  await effectSearchLink.click()

  const runButton = page.getByRole("button", { name: /Run Live Optimization/i })
  await expect(runButton).toBeVisible()
  await runButton.click()

  const pauseButton = page.getByRole("button", { name: /Pause/i })
  await expect(pauseButton).toBeVisible()
  await pauseButton.click()

  const resumeButton = page.getByRole("button", { name: /Resume/i })
  await expect(resumeButton).toBeVisible()
  await resumeButton.click()

  await expect(runButton).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole("heading", { name: "Evidence" })).toBeVisible()

  expectNoBrowserFailures(failures)
})
