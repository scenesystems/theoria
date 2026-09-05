import { RegistryProvider } from "@effect-atom/atom-react"
import { Effect, Option, type Scope } from "effect"
import type { ReactNode } from "react"
import { createRoot, type Root } from "react-dom/client"

import * as BrowserDocument from "../../app/web/platform/BrowserDocument.js"

/**
 * Mounts a React tree into a fresh element of the test document and
 * unmounts it when the scope closes. The document comes from the same
 * service the app uses, so tests never reach for the global.
 */
export const mountReact = (
  node: ReactNode
): Effect.Effect<
  { readonly container: HTMLDivElement; readonly root: Root },
  never,
  Scope.Scope | BrowserDocument.BrowserDocument
> =>
  Effect.acquireRelease(
    Effect.map(BrowserDocument.BrowserDocument, (browserDocument) => {
      const container = browserDocument.createElement("div")
      browserDocument.body.appendChild(container)
      const root = createRoot(container)
      root.render(node)
      return { container, root }
    }),
    ({ container, root }) =>
      Effect.sync(() => {
        root.unmount()
        container.remove()
      })
  )

/** `mountReact` inside an atom registry, for trees that read atoms. */
export const mountWithRegistry = (
  node: ReactNode,
  defaultIdleTTL = 0
): Effect.Effect<
  { readonly container: HTMLDivElement; readonly root: Root },
  never,
  Scope.Scope | BrowserDocument.BrowserDocument
> => mountReact(<RegistryProvider defaultIdleTTL={defaultIdleTTL}>{node}</RegistryProvider>)

/** Reads until `read` yields a value; the surrounding test's timeout bounds the wait. */
export function waitForValue<A>(read: () => Option.Option<A>): Effect.Effect<A> {
  return Effect.eventually(Effect.suspend(read))
}

/** Retries `predicate` until it holds; the surrounding test's timeout bounds the wait. */
export const waitFor = (predicate: () => boolean): Effect.Effect<void> =>
  waitForValue(() => Option.liftPredicate(undefined, predicate))
