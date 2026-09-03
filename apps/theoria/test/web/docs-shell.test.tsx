import type { Atom } from "@effect-atom/atom"
import { RegistryProvider } from "@effect-atom/atom-react"
import { describe, expect, it } from "@effect/vitest"
import { Effect, type Layer } from "effect"
import * as Schema from "effect/Schema"
import type { ReactNode } from "react"
import { createRoot } from "react-dom/client"

import {
  DocsApiExportPageJson,
  DocsApiModuleIndexJson,
  DocsManifestJson,
  DocsSearchIndexJson,
  GuidePageJson
} from "@theoria/docs-model"
import { docsApiRoute, docsIndexRoute, docsOverviewRoute } from "../../app/contracts/docs.js"
import { docsRuntime } from "../../app/web/atoms/docs-data.js"
import type { DocsClient } from "../../app/web/services/DocsClient.js"
import { DocsPage } from "../../app/web/view/docs/DocsPage.js"
import { SiteHeader } from "../../app/web/view/primitives/SiteHeader.js"
import { docsApiExportPageFixture, docsApiModuleIndexFixture } from "../helpers/docs-api-fixtures.js"
import { docsManifestFixture, docsSearchIndexFixture, guidePageFixture } from "../helpers/docs-fixtures.js"
import { staticDocsClient } from "../helpers/docs-http.js"

const manifestJson = Schema.encodeSync(DocsManifestJson)(docsManifestFixture)
const searchIndexJson = Schema.encodeSync(DocsSearchIndexJson)(docsSearchIndexFixture)
const guidePageJson = Schema.encodeSync(GuidePageJson)(guidePageFixture)
const apiModuleIndexJson = Schema.encodeSync(DocsApiModuleIndexJson)(docsApiModuleIndexFixture)
const apiExportJson = Schema.encodeSync(DocsApiExportPageJson)(docsApiExportPageFixture(0))

const docsBody = (path: string): string =>
  path.endsWith("manifest.json")
    ? manifestJson
    : path.endsWith("search-index.json")
    ? searchIndexJson
    : path.endsWith("pages/Study.json")
    ? apiModuleIndexJson
    : path.endsWith("api-runStudy.json")
    ? apiExportJson
    : guidePageJson

// The documentation atoms build their runtime from `docsRuntime.layer`; seeding
// that atom swaps the production fetch-backed client for in-memory data.
const registryInitialValues: ReadonlyArray<readonly [Atom.Atom<Layer.Layer<DocsClient>>, Layer.Layer<DocsClient>]> = [
  [docsRuntime.layer, staticDocsClient(docsBody)]
]

const render = (node: ReactNode) => {
  const container = document.createElement("div")
  document.body.appendChild(container)
  const root = createRoot(container)

  root.render(
    <RegistryProvider defaultIdleTTL={0} initialValues={registryInitialValues}>{node}</RegistryProvider>
  )

  return { container, root }
}

const waitFor = (predicate: () => boolean): Effect.Effect<void> =>
  Effect.eventually(
    Effect.sync(predicate).pipe(
      Effect.filterOrFail((ready) => ready, () => "waiting-for-docs-shell")
    )
  ).pipe(Effect.asVoid, Effect.orDie)

describe("documentation shell", () => {
  it.effect("renders generated package navigation and guide content", () =>
    Effect.gen(function*() {
      const { container, root } = render(<DocsPage route={docsOverviewRoute("effect-search")} />)

      yield* Effect.ensuring(
        Effect.gen(function*() {
          yield* waitFor(() => container.textContent?.includes("Build reproducible optimization studies") === true)

          expect(container.querySelectorAll("header")).toHaveLength(1)
          expect(container.querySelectorAll("main")).toHaveLength(1)
          expect(container.querySelector("nav[aria-label=\"@scenesystems/effect-search documentation\"]")).not
            .toBeNull()
          expect(container.querySelector("nav[aria-label=\"On this page\"]")).not.toBeNull()
          expect(container.querySelector("[aria-current=\"page\"]")?.textContent?.trim()).toBe("Overview")
          const guidesToggle = container.querySelector("button[aria-label=\"Toggle guides navigation\"]")
          const apiToggle = container.querySelector("button[aria-label=\"Toggle api navigation\"]")
          expect(guidesToggle).not.toBeNull()
          expect(apiToggle).not.toBeNull()
          expect(
            apiToggle?.parentElement?.nextElementSibling?.querySelector("a[href=\"/docs/effect-search/api/Study\"]")
          )
            .not.toBeNull()
          expect(container.querySelector("button[aria-label=\"Choose package\"]")).not.toBeNull()
          expect(container.querySelector("button[aria-label=\"Search documentation\"]")).not.toBeNull()
          expect(container.textContent).toContain("bun add @scenesystems/effect-search")
          expect(container.textContent).not.toContain("Documentation foundations")
          expect(container.textContent).not.toContain("semantic page models")
          expect(container.textContent).not.toContain("export declare")
          expect(container.querySelector("a[aria-label=\"Theoria home\"]")?.getAttribute("href")).toBe("/")
          expect(container.querySelector("a[aria-label=\"Documentation home\"]")?.getAttribute("href")).toBe("/docs")

          document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }))
          yield* waitFor(() => document.querySelector("[role=\"combobox\"]") !== null)
          expect(document.querySelector("[role=\"combobox\"]")).toBe(document.activeElement)
          yield* waitFor(() => document.body.textContent?.includes("runStudy") === true)
        }),
        Effect.sync(() => {
          root.unmount()
          container.remove()
        })
      )
    }))

  it.effect("renders the generated package index at /docs", () =>
    Effect.gen(function*() {
      const { container, root } = render(<DocsPage route={docsIndexRoute()} />)

      yield* Effect.ensuring(
        Effect.gen(function*() {
          yield* waitFor(() => container.querySelector("h1")?.textContent === "Packages")
          expect(container.querySelector("a[href=\"/docs/effect-search\"]")).not.toBeNull()
          expect(container.textContent).toContain("Effect-native optimization studies.")
        }),
        Effect.sync(() => {
          root.unmount()
          container.remove()
        })
      )
    }))

  it.effect("loads focused API detail after the module index", () =>
    Effect.gen(function*() {
      globalThis.history.replaceState(null, "", "/docs/effect-search/api/Study#api-runStudy")
      const { container, root } = render(<DocsPage route={docsApiRoute("effect-search", "Study")} />)

      yield* Effect.ensuring(
        Effect.gen(function*() {
          yield* waitFor(() => container.textContent?.includes("runStudy<A>") === true)
          expect(container.textContent).toContain("Run a study.")
          expect(container.textContent).toContain("const result = yield* runStudy(input)")
          expect(container.textContent).not.toContain("Build and run optimization studies.")
          expect(container.querySelector("a[href=\"#module\"]")?.textContent?.trim()).toBe("← Study")
        }),
        Effect.sync(() => {
          root.unmount()
          container.remove()
          globalThis.history.replaceState(null, "", "/")
        })
      )
    }))

  it.effect("links the landing page to the separate documentation surface", () =>
    Effect.gen(function*() {
      const { container, root } = render(<SiteHeader />)

      yield* Effect.ensuring(
        Effect.gen(function*() {
          yield* waitFor(() => container.querySelector("a[href=\"/docs\"]") !== null)
          expect(container.querySelector("a[href=\"/docs\"]")?.textContent).toBe("Docs")
          expect(container.querySelector("a[href=\"/\"]")).not.toBeNull()
        }),
        Effect.sync(() => {
          root.unmount()
          container.remove()
        })
      )
    }))
})
