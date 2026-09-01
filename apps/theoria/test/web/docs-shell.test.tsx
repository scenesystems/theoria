import { RegistryProvider } from "@effect-atom/atom-react"
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import * as Schema from "effect/Schema"
import type { ReactNode } from "react"
import { createRoot } from "react-dom/client"

import { docsIndexRoute, docsOverviewRoute } from "../../app/contracts/docs.js"
import { DocsManifestJson, DocsSearchIndexJson, GuidePageJson } from "@theoria/docs-model"
import { DocsPage } from "../../app/web/view/docs/DocsPage.js"
import { SiteHeader } from "../../app/web/view/primitives/SiteHeader.js"
import {
  docsManifestFixture,
  docsSearchIndexFixture,
  guidePageFixture
} from "../helpers/docs-fixtures.js"

const render = (node: ReactNode) => {
  const container = document.createElement("div")
  document.body.appendChild(container)
  const root = createRoot(container)

  root.render(<RegistryProvider defaultIdleTTL={0}>{node}</RegistryProvider>)

  return { container, root }
}

const waitFor = (predicate: () => boolean): Effect.Effect<void> =>
  Effect.eventually(
    Effect.sync(predicate).pipe(
      Effect.filterOrFail((ready) => ready, () => "waiting-for-docs-shell")
    )
  ).pipe(Effect.asVoid, Effect.orDie)

const manifestJson = Schema.encodeSync(DocsManifestJson)(docsManifestFixture)
const searchIndexJson = Schema.encodeSync(DocsSearchIndexJson)(docsSearchIndexFixture)
const guidePageJson = Schema.encodeSync(GuidePageJson)(guidePageFixture)

const response = (content: string) => ({
  ok: true,
  status: 200,
  text: () => Promise.resolve(content)
})

const docsResponse = (input: string | URL | Request) => {
  const path = String(input)
  return path.endsWith("manifest.json")
    ? response(manifestJson)
    : path.endsWith("search-index.json")
    ? response(searchIndexJson)
    : response(guidePageJson)
}

const withDocsFetch = <A,>(effect: Effect.Effect<A, never, never>): Effect.Effect<A, never, never> => {
  const previousFetch = globalThis.fetch

  return Effect.gen(function*() {
    yield* Effect.sync(() => {
      Reflect.set(globalThis, "fetch", (input: string | URL | Request) => Promise.resolve(docsResponse(input)))
    })
    return yield* effect
  }).pipe(
    Effect.ensuring(Effect.sync(() => {
      Reflect.set(globalThis, "fetch", previousFetch)
    }))
  )
}

describe("documentation shell", () => {
  it.effect("renders generated package navigation and guide content", () =>
    withDocsFetch(Effect.gen(function*() {
      const { container, root } = render(<DocsPage route={docsOverviewRoute("effect-search")} />)

      yield* Effect.ensuring(
        Effect.gen(function*() {
          yield* waitFor(() => container.textContent?.includes("Build reproducible optimization studies") === true)

          expect(container.querySelectorAll("header")).toHaveLength(1)
          expect(container.querySelectorAll("main")).toHaveLength(1)
          expect(container.querySelector('nav[aria-label="@scenesystems/effect-search documentation"]')).not.toBeNull()
          expect(container.querySelector('nav[aria-label="On this page"]')).not.toBeNull()
          expect(container.querySelector('[aria-current="page"]')?.textContent?.trim()).toBe("Overview")
          expect(container.querySelector('button[aria-label="Choose package"]')).not.toBeNull()
          expect(container.querySelector('button[aria-label="Search documentation"]')).not.toBeNull()
          expect(container.textContent).toContain("bun add @scenesystems/effect-search")
          expect(container.textContent).not.toContain("Documentation foundations")
          expect(container.textContent).not.toContain("semantic page models")
          expect(container.textContent).not.toContain("export declare")
          expect(container.querySelector('a[aria-label="Theoria home"]')?.getAttribute("href")).toBe("/")
          expect(container.querySelector('a[aria-label="Documentation home"]')?.getAttribute("href")).toBe("/docs")

          document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }))
          yield* waitFor(() => document.querySelector('[role="combobox"]') !== null)
          expect(document.querySelector('[role="combobox"]')).toBe(document.activeElement)
          yield* waitFor(() => document.body.textContent?.includes("runStudy") === true)
        }),
        Effect.sync(() => {
          root.unmount()
          container.remove()
        })
      )
    })))

  it.effect("renders the generated package index at /docs", () =>
    withDocsFetch(Effect.gen(function*() {
      const { container, root } = render(<DocsPage route={docsIndexRoute()} />)

      yield* Effect.ensuring(
        Effect.gen(function*() {
          yield* waitFor(() => container.querySelector("h1")?.textContent === "Packages")
          expect(container.querySelector('a[href="/docs/effect-search"]')).not.toBeNull()
          expect(container.textContent).toContain("Effect-native optimization studies.")
        }),
        Effect.sync(() => {
          root.unmount()
          container.remove()
        })
      )
    })))

  it.effect("links the landing page to the separate documentation surface", () =>
    Effect.gen(function*() {
      const { container, root } = render(<SiteHeader />)

      yield* Effect.ensuring(
        Effect.gen(function*() {
          yield* waitFor(() => container.querySelector('a[href="/docs"]') !== null)
          expect(container.querySelector('a[href="/docs"]')?.textContent).toBe("Docs")
          expect(container.querySelector('a[href="/"]')).not.toBeNull()
        }),
        Effect.sync(() => {
          root.unmount()
          container.remove()
        })
      )
    }))
})
