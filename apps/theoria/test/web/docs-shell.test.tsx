import { RegistryProvider } from "@effect-atom/atom-react"
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import type { ReactNode } from "react"
import { createRoot } from "react-dom/client"

import { cards } from "../../app/contracts/card.js"
import { docsOverviewRoute } from "../../app/contracts/docs.js"
import { DocsPage } from "../../app/web/view/docs/DocsPage.js"

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

describe("documentation shell", () => {
  it.effect("renders the package landmarks, navigation, controls, and example without internal narration", () =>
    Effect.gen(function*() {
      const { container, root } = render(
        <DocsPage cards={cards} route={docsOverviewRoute("effect-search")} />
      )

      yield* Effect.ensuring(
        Effect.gen(function*() {
          yield* waitFor(() => container.querySelector("h1") !== null)

          expect(container.querySelectorAll("header")).toHaveLength(1)
          expect(container.querySelectorAll("main")).toHaveLength(1)
          expect(container.querySelector('nav[aria-label="Documentation"]')).not.toBeNull()
          expect(container.querySelector('nav[aria-label="On this page"]')).not.toBeNull()
          expect(container.querySelector('[aria-current="page"]')?.textContent?.trim()).toBe("Overview")
          expect(container.querySelector('button[aria-label="Choose documentation package"]')).not.toBeNull()
          expect(container.querySelector('button[aria-label="Search documentation"]')).not.toBeNull()
          expect(container.querySelectorAll('[role="tab"]')).toHaveLength(2)
          expect(container.querySelector('[role="tabpanel"]')).not.toBeNull()
          expect(container.textContent).not.toContain("Documentation foundations")
          expect(container.textContent).not.toContain("semantic page models")

          document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }))
          yield* waitFor(() => document.querySelector('input[type="search"]') !== null)
          expect(document.querySelector('input[type="search"]')).toBe(document.activeElement)
        }),
        Effect.sync(() => {
          root.unmount()
          container.remove()
        })
      )
    }))
})
