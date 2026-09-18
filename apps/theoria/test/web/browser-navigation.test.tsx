import { Registry } from "@effect-atom/atom"
import { useAtomValue } from "@effect-atom/atom-react"
import { describe, expect, it } from "@effect/vitest"
import { Boolean, Effect, Layer, Option, String as Str } from "effect"

import { docsKeyboardShortcutsAtom, docsSearchOpenAtom } from "../../app/web/atoms/docs.js"
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
  it.live("cancels docs shortcuts during dispatch and releases them on unmount even with a long registry TTL", () =>
    Effect.gen(function*() {
      const browserDocument = yield* BrowserDocument.BrowserDocument
      const browserWindow = yield* BrowserWindow.BrowserWindow
      const registry = yield* Effect.acquireRelease(
        Effect.sync(() => Registry.make({ defaultIdleTTL: 60_000 })),
        (registry) => Effect.sync(() => registry.dispose())
      )
      registry.mount(docsSearchOpenAtom)
      const unmount = registry.mount(docsKeyboardShortcutsAtom)
      const keydown = (options: KeyboardEventInit) =>
        new browserWindow.KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...options })

      // Establish that the asynchronous stream has subscribed before checking dispatch-time cancellation.
      browserDocument.dispatchEvent(keydown({ key: "k", ctrlKey: true }))
      yield* waitFor(() => registry.get(docsSearchOpenAtom))

      yield* Effect.forEach([
        { key: "k", ctrlKey: true },
        { key: "K", metaKey: true }
      ], (options) =>
        Effect.gen(function*() {
          registry.set(docsSearchOpenAtom, false)
          const event = keydown(options)
          // No yield between dispatch and these assertions: a downstream Stream tap is too late.
          expect(browserDocument.dispatchEvent(event)).toBe(false)
          expect(event.defaultPrevented).toBe(true)
          yield* waitFor(() => registry.get(docsSearchOpenAtom))
        }))

      registry.set(docsSearchOpenAtom, false)
      yield* Effect.forEach(
        [{ key: "k" }, { key: "x", ctrlKey: true }, { key: "x", metaKey: true }],
        (options) =>
          Effect.sync(() => {
            const event = keydown(options)
            expect(browserDocument.dispatchEvent(event)).toBe(true)
            expect(event.defaultPrevented).toBe(false)
          })
      )
      yield* Effect.yieldNow()
      expect(registry.get(docsSearchOpenAtom)).toBe(false)

      unmount()
      yield* waitFor(() => browserDocument.dispatchEvent(keydown({ key: "k", ctrlKey: true }))).pipe(
        Effect.timeout("1 second")
      )
      registry.set(docsSearchOpenAtom, false)
      expect(browserDocument.dispatchEvent(keydown({ key: "K", metaKey: true }))).toBe(true)
      yield* Effect.yieldNow()
      expect(registry.get(docsSearchOpenAtom)).toBe(false)

      // Re-entering docs must subscribe again; removing a listener cannot permanently disable the shortcut.
      registry.mount(docsKeyboardShortcutsAtom)
      yield* waitFor(() => Boolean.not(browserDocument.dispatchEvent(keydown({ key: "k", ctrlKey: true }))))
      yield* waitFor(() => registry.get(docsSearchOpenAtom))
    }).pipe(Effect.scoped, Effect.provide(BrowserTest)))

  it.effect("moves between application routes without replacing the mounted document", () =>
    Effect.gen(function*() {
      const browserWindow = yield* BrowserWindow.BrowserWindow
      yield* Effect.acquireRelease(atPath("/docs"), () => atPath("/"))
      const { container } = yield* mountWithRegistry(<NavigationHarness />)

      yield* waitFor(() =>
        Option.exists(
          Option.fromNullable(container.querySelector("output")?.textContent),
          (text) => Str.Equivalence(text, "/docs")
        )
      )
      const mount = container.querySelector("main")
      const link = container.querySelector("a")
      const click = new browserWindow.MouseEvent("click", { bubbles: true, cancelable: true })

      link?.dispatchEvent(click)
      yield* waitFor(() =>
        Option.exists(
          Option.fromNullable(container.querySelector("output")?.textContent),
          (text) => Str.Equivalence(text, "/docs/effect-search/api/Study")
        )
      )

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
