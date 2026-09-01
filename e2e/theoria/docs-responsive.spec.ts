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

test("mobile navigation changes packages and guides without page overflow", async ({ page }) => {
  const failures = captureBrowserFailures(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/docs/effect-search")
  await expect(page.getByRole("heading", { level: 1, name: "@scenesystems/effect-search" })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

  await page.getByRole("button", { name: "Open navigation" }).click()
  const navigation = page.getByRole("dialog")
  await expect(navigation).toBeVisible()
  await expect(navigation.getByRole("heading", { name: "Menu" })).toBeVisible()
  await navigation.getByRole("button", { name: "Choose package" }).click()
  await page.getByRole("menuitem").filter({ hasText: "@scenesystems/effect-math" }).click()
  await expect(page).toHaveURL(/\/docs\/effect-math$/u)
  await expect(navigation).toBeHidden()

  await page.getByRole("button", { name: "Open navigation" }).click()
  await navigation.getByRole("link", { exact: true, name: "Getting started" }).click()
  await expect(page.getByRole("heading", { level: 1, name: "Getting started" })).toBeVisible()
  await expect(navigation).toBeHidden()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  expect(failures.consoleErrors).toEqual([])
  expect(failures.pageErrors).toEqual([])
})

test("focused signatures remain reachable at short height and increased text", async ({ page }) => {
  const failures = captureBrowserFailures(page)
  await page.setViewportSize({ width: 1440, height: 500 })
  await page.goto("/docs/effect-search/api/Study#api-ask")
  await expect(page.getByRole("heading", { level: 1, name: "ask" })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%"
  })
  const signature = page.getByRole("region", { name: "Signature code example" })
  const overflow = await signature.evaluate((region) => {
    const scroller = [...region.querySelectorAll<HTMLElement>("*")].find((element) =>
      element.scrollWidth > element.clientWidth && getComputedStyle(element).overflowX !== "visible"
    )
    if (scroller === undefined) return null
    scroller.scrollLeft = scroller.scrollWidth
    return {
      atEnd: scroller.scrollLeft + scroller.clientWidth >= scroller.scrollWidth - 1,
      contained: region.getBoundingClientRect().right <= document.documentElement.clientWidth
    }
  })

  expect(overflow).toEqual({ atEnd: true, contained: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  expect(failures.consoleErrors).toEqual([])
  expect(failures.pageErrors).toEqual([])
})
