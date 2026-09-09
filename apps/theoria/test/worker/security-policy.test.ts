// @vitest-environment node
import { expect, layer } from "@effect/vitest"
import type { Page } from "@playwright/test"
import { Effect, Layer, Option } from "effect"

import {
  act,
  BrowserLive,
  click,
  desktop,
  eventually,
  hover,
  openPage,
  phone,
  press,
  type Viewport,
  visible
} from "./browser.js"
import { drawn, searchSettlesWithin } from "./demo.js"
import { recordedPolicyViolations, recordPolicyViolations, storyDrawn } from "./platform/in-page.js"
import { SiteLive } from "./site.js"

/**
 * The page under its own Content Security Policy. The policy admits no inline
 * style — `style-src 'self'`, no `'unsafe-inline'` — so every rule the page
 * needs must be in its stylesheet, including the ones its component library
 * would otherwise write into `<style>` elements as it renders. The page is
 * taken through each surface that could write one: the drawing's scrolling
 * paper, a proposal's popover, a merge, a change of story, the theme, the
 * documentation's highlighted code and its menus and dialogs. The document
 * itself reports what the policy refused; that account must be empty, and so
 * must the console.
 */

const viewports: ReadonlyArray<Viewport> = [desktop, phone]

const noViolations = (page: Page, where: string) =>
  Effect.map(act(() => page.evaluate(recordedPolicyViolations)), (violations) => {
    expect(violations, where).toBe("")
  })

/**
 * Opens and closes the documentation's package menu. Below `lg` the picker
 * stands in the navigation drawer, so the drawer is opened first — and closed
 * after, so the surface is left as it was found.
 */
const packageMenu = (page: Page, viewport: Viewport) =>
  Effect.gen(function*() {
    const drawer = viewport.width < 1024
    yield* Effect.when(
      Effect.gen(function*() {
        yield* click(page.getByRole("button", { name: "Open navigation" }))
        yield* visible(page.getByRole("dialog"))
      }),
      () => drawer
    )
    yield* click(page.getByRole("button", { name: "Choose package" }))
    yield* visible(page.getByRole("menuitem").first())
    yield* press(page, "Escape")
    yield* Effect.when(press(page, "Escape"), () => drawer)
  })

/** The policy the document was served under, from the navigation's own response. */
const servedPolicy = (page: Page, path: string) =>
  Effect.flatMap(act(() => page.goto(path)), (response) =>
    Option.match(Option.fromNullable(response), {
      onNone: () => Effect.dieMessage(`no response for ${path}`),
      onSome: (some) => Effect.map(act(() => some.headerValue("content-security-policy")), (policy) => policy ?? "")
    }))

layer(Layer.merge(SiteLive, BrowserLive), { excludeTestServices: true, timeout: "4 minutes" })(
  "Theoria security policy in Chromium",
  (it) => {
    it.scoped("the page runs under a policy that admits no inline style, and nothing it does is refused", () =>
      Effect.forEach(viewports, (viewport) =>
        Effect.gen(function*() {
          const where = `${String(viewport.width)}×${String(viewport.height)}`
          const { failures, page } = yield* openPage({ viewport })
          yield* act(() => page.addInitScript(recordPolicyViolations))

          const policy = yield* servedPolicy(page, "/")
          expect(policy, where).toContain("style-src 'self'; ")
          expect(policy, where).not.toContain("unsafe-inline")

          // The drawing: its paper is a scroll area, the surface most likely to bring a style of its own.
          yield* drawn(page)
          const demo = page.getByRole("region", { name: "Imagined place demo" })
          yield* eventually(() => demo.evaluate(storyDrawn), true, searchSettlesWithin)
          yield* noViolations(page, `${where} drawn`)

          // A proposal pointed at opens its popover; a merge redraws; a new story rebuilds.
          const merged = demo.locator("[data-place-proposal][data-place-recorded='true']").first()
          const name = merged.locator("[data-place-feature]")
          yield* act(() => name.scrollIntoViewIfNeeded())
          yield* hover(name)
          yield* visible(page.locator("[data-place-provenance]"))
          yield* click(demo.getByRole("switch", { checked: false }).first())
          yield* click(
            demo.getByRole("radiogroup", { name: "Scenario" }).getByRole("radio", { checked: false }).first()
          )
          yield* eventually(() => demo.evaluate(storyDrawn), true, searchSettlesWithin)
          yield* noViolations(page, `${where} interacted`)

          // The theme, then the documentation: highlighted code in a scroll area, a menu, a dialog, and on a
          // phone the navigation drawer.
          yield* click(page.getByRole("button", { name: "Switch to dark mode" }))
          yield* visible(page.getByRole("button", { name: "Switch to light mode" }))
          const docsPolicy = yield* servedPolicy(page, "/docs/effect-search/examples")
          expect(docsPolicy, where).toBe(policy)
          yield* visible(page.getByRole("heading", { level: 1, name: "Examples" }))
          const example = page.getByRole("region", { name: "ts code example" }).first()
          yield* visible(example.locator("pre code > span:first-child > span:last-child"))
          yield* packageMenu(page, viewport)
          yield* click(page.getByRole("button", { name: "Search documentation" }))
          yield* visible(page.getByRole("dialog"))
          yield* press(page, "Escape")
          yield* noViolations(page, `${where} docs`)
          expect(yield* failures, where).toEqual([])
        }), { discard: true }))
  }
)
