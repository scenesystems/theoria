// @vitest-environment node
import { expect, layer } from "@effect/vitest"
import { Effect, Layer, Option } from "effect"
import * as Arr from "effect/Array"
import * as Str from "effect/String"

import { act, BrowserLive, click, count, goto, openPage, urlMatches, visible } from "./browser.js"
import { Site, SiteLive } from "./site.js"

const escapeForRegExp = (path: string) => Str.replaceAll("/", "\\/")(path)

layer(Layer.merge(SiteLive, BrowserLive), { excludeTestServices: true, timeout: "2 minutes" })(
  "Theoria docs routes in Chromium",
  (it) => {
    it.scoped("every generated package, guide, and API navigation route resolves", () =>
      Effect.gen(function*() {
        const { manifest } = yield* Site
        const { failures, page } = yield* openPage()
        const sidebar = page.getByRole("complementary", { name: "Documentation navigation" })

        // Opens the sidebar section that owns `path` when its link is collapsed, then follows it.
        const follow = (path: string) =>
          Effect.gen(function*() {
            const link = sidebar.locator(`a[href="${path}"]`)
            const shown = yield* act(() => link.isVisible())
            yield* shown
              ? Effect.void
              : click(sidebar.getByRole("button", {
                name: path.includes("/api") ? "Toggle api navigation" : "Toggle guides navigation"
              }))
            yield* click(link)
            yield* urlMatches(page, new RegExp(`${escapeForRegExp(path)}$`, "u"))
            yield* visible(page.locator("main h1"))
            yield* count(page.getByText("Documentation unavailable", { exact: true }), 0)
            yield* count(page.getByText("Page not found", { exact: true }), 0)
          })

        yield* Effect.forEach(manifest.packages, (docsPackage) =>
          Effect.gen(function*() {
            yield* goto(page, docsPackage.overview.path)
            yield* visible(page.locator("main h1"))
            yield* visible(sidebar.locator(`a[href="${docsPackage.overview.path}"]`))
            const firstModule = Option.getOrThrow(Arr.head(docsPackage.apiModules))
            yield* visible(sidebar.locator(`a[href="${firstModule.path}"]`))

            yield* Effect.forEach(
              [
                docsPackage.overview.path,
                ...Arr.map(docsPackage.guides, (guide) => guide.path),
                ...Arr.map(docsPackage.apiModules, (module) => module.path)
              ],
              follow
            )
          }))

        expect(yield* failures).toEqual([])
      }), { timeout: 300_000 })
  }
)
