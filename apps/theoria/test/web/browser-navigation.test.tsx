import { useAtomValue } from "@effect-atom/atom-react"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer, Option } from "effect"

import { browserNavigationMountAtom, pageRouteAtom, shouldNavigateInBrowser } from "../../app/web/atoms/navigation.js"
import * as BrowserDocument from "../../app/web/platform/BrowserDocument.js"
import * as BrowserWindow from "../../app/web/platform/BrowserWindow.js"
import { pagePathFor } from "../../app/web/services/path.js"
import { InternalLink } from "../../app/web/view/primitives/Link.js"
import { mountWithRegistry, waitFor } from "../helpers/react-mount.js"

const BrowserTest = Layer.merge(BrowserWindow.layer, BrowserDocument.layer)

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

/** Puts the test window on `path` for the duration of the scope, then returns it to the root. */
const atPath = (path: string): Effect.Effect<void, never, BrowserWindow.BrowserWindow> =>
  Effect.flatMap(BrowserWindow.BrowserWindow, (browserWindow) =>
    Effect.sync(() => {
      browserWindow.history.replaceState(null, "", path)
    }))

const plainClick = {
  altKey: false,
  button: 0,
  ctrlKey: false,
  defaultPrevented: false,
  metaKey: false,
  shiftKey: false,
  target: Option.none<string>()
}

describe("browser navigation", () => {
  it.effect("moves between application routes without replacing the mounted document", () =>
    Effect.gen(function*() {
      const browserWindow = yield* BrowserWindow.BrowserWindow
      yield* Effect.acquireRelease(atPath("/docs"), () => atPath("/"))
      const { container } = yield* mountWithRegistry(<NavigationHarness />)

      yield* waitFor(() => container.querySelector("output")?.textContent === "/docs")
      const mount = container.querySelector("main")
      const link = container.querySelector("a")
      const click = new browserWindow.MouseEvent("click", { bubbles: true, cancelable: true })

      link?.dispatchEvent(click)
      yield* waitFor(() => container.querySelector("output")?.textContent === "/docs/effect-search/api/Study")

      expect(click.defaultPrevented).toBe(true)
      expect(browserWindow.location.pathname).toBe("/docs/effect-search/api/Study")
      expect(container.querySelector("main")).toBe(mount)
    }).pipe(Effect.scoped, Effect.provide(BrowserTest)))

  it.effect("leaves modified, secondary-button, new-tab and already-handled clicks to the browser", () =>
    Effect.sync(() => {
      expect(shouldNavigateInBrowser(plainClick)).toBe(true)
      expect(shouldNavigateInBrowser({ ...plainClick, ctrlKey: true })).toBe(false)
      expect(shouldNavigateInBrowser({ ...plainClick, metaKey: true })).toBe(false)
      expect(shouldNavigateInBrowser({ ...plainClick, shiftKey: true })).toBe(false)
      expect(shouldNavigateInBrowser({ ...plainClick, altKey: true })).toBe(false)
      expect(shouldNavigateInBrowser({ ...plainClick, button: 1 })).toBe(false)
      expect(shouldNavigateInBrowser({ ...plainClick, target: Option.some("_blank") })).toBe(false)
      expect(shouldNavigateInBrowser({ ...plainClick, defaultPrevented: true })).toBe(false)
    }))
})
