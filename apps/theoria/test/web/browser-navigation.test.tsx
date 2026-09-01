import { RegistryProvider, useAtomValue } from "@effect-atom/atom-react"
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import { createRoot } from "react-dom/client"

import { browserNavigationMountAtom, pageRouteAtom, shouldNavigateInBrowser } from "../../app/web/atoms/navigation.js"
import { pagePathFor } from "../../app/web/services/path.js"
import { InternalLink } from "../../app/web/view/primitives/Link.js"

const waitFor = (predicate: () => boolean): Effect.Effect<void> =>
  Effect.eventually(
    Effect.sync(predicate).pipe(
      Effect.filterOrFail((ready) => ready, () => "waiting-for-browser-navigation")
    )
  ).pipe(Effect.asVoid, Effect.orDie)

const NavigationHarness = () => {
  useAtomValue(browserNavigationMountAtom)
  const route = useAtomValue(pageRouteAtom)

  return (
    <main data-mount="stable">
      <InternalLink href="/docs/effect-search/api/Study">Study API</InternalLink>
      <output>{pagePathFor(route)}</output>
    </main>
  )
}

describe("browser navigation", () => {
  it.effect("moves between application routes without replacing the mounted document", () =>
    Effect.gen(function*() {
      globalThis.history.replaceState(null, "", "/docs")
      const container = document.createElement("div")
      document.body.appendChild(container)
      const root = createRoot(container)
      root.render(
        <RegistryProvider defaultIdleTTL={0}>
          <NavigationHarness />
        </RegistryProvider>
      )

      yield* Effect.ensuring(
        Effect.gen(function*() {
          yield* waitFor(() => container.querySelector("output")?.textContent === "/docs")
          const mount = container.querySelector("main")
          const link = container.querySelector("a")
          const click = new MouseEvent("click", { bubbles: true, cancelable: true })

          link?.dispatchEvent(click)
          yield* waitFor(() => container.querySelector("output")?.textContent === "/docs/effect-search/api/Study")

          expect(click.defaultPrevented).toBe(true)
          expect(globalThis.location.pathname).toBe("/docs/effect-search/api/Study")
          expect(container.querySelector("main")).toBe(mount)
          expect(container.querySelector("output")?.textContent).toBe("/docs/effect-search/api/Study")
        }),
        Effect.sync(() => {
          root.unmount()
          container.remove()
          globalThis.history.replaceState(null, "", "/")
        })
      )
    }))

  it.effect("preserves native behavior for modified and external links", () =>
    Effect.gen(function*() {
      expect(shouldNavigateInBrowser({
        altKey: false,
        button: 0,
        ctrlKey: true,
        defaultPrevented: false,
        href: "/docs",
        metaKey: false,
        shiftKey: false,
        target: null
      })).toBe(false)
      expect(shouldNavigateInBrowser({
        altKey: false,
        button: 0,
        ctrlKey: false,
        defaultPrevented: false,
        href: "https://example.com/docs",
        metaKey: false,
        shiftKey: false,
        target: null
      })).toBe(false)
    }))
})
