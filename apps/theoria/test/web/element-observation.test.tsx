import { Registry, Result } from "@effect-atom/atom"
import { RegistryContext, useAtomValue } from "@effect-atom/atom-react"
import { describe, expect, it } from "@effect/vitest"
import { Boolean, Effect, Equal, Layer, Number, Option, Stream } from "effect"
import { StrictMode } from "react"

import { useElementWidth } from "../../app/web/atoms/element-observation.js"
import * as BrowserDocument from "../../app/web/platform/BrowserDocument.js"
import * as BrowserWindow from "../../app/web/platform/BrowserWindow.js"
import * as ElementSize from "../../app/web/platform/ElementSize.js"
import { mountReact, waitFor, waitForValue } from "../helpers/react-mount.js"
import * as ResizeObserving from "../helpers/resize-observing.js"

const Measured = ({ name }: { readonly name: string }) => {
  const handle = useElementWidth()
  const width = useAtomValue(handle.width)
  return (
    <div data-measured={name} ref={handle.ref}>
      {Option.match(Result.value(width), { onNone: () => "waiting", onSome: (value) => `${value}` })}
    </div>
  )
}

const TestLive = Layer.mergeAll(
  BrowserDocument.layer,
  BrowserWindow.layer,
  ResizeObserving.layer.pipe(Layer.provide(BrowserWindow.layer))
)

describe("mounted element observation", () => {
  it.live("keeps StrictMode refs independent with both microtask disposal and a long registry TTL", () =>
    Effect.forEach([0, 60_000], (defaultIdleTTL) =>
      Effect.gen(function*() {
        const observing = yield* ResizeObserving.ResizeObserving
        const registry = yield* Effect.acquireRelease(
          Effect.sync(() => Registry.make({ defaultIdleTTL })),
          (registry) => Effect.sync(() => registry.dispose())
        )
        const { container, root } = yield* mountReact(
          <RegistryContext.Provider value={registry}>
            <StrictMode>
              <Measured name="left" />
              <Measured name="right" />
            </StrictMode>
          </RegistryContext.Provider>
        )
        const left = yield* waitForValue(() => Option.fromNullable(container.querySelector("[data-measured=\"left\"]")))
        const right = yield* waitForValue(() =>
          Option.fromNullable(container.querySelector("[data-measured=\"right\"]"))
        )
        yield* observing.report(left, { width: 213.75, height: 30 })
        yield* observing.report(right, { width: 487.25, height: 40 })
        yield* waitFor(() => Boolean.and(Equal.equals(left.textContent, "213"), Equal.equals(right.textContent, "487")))
        expect(yield* observing.count(left)).toBe(1)
        expect(yield* observing.count(right)).toBe(1)

        // The parent registry remains alive; removing the elements must close their streams now, not at its TTL.
        yield* Effect.sync(() => root.render(null))
        yield* Effect.repeat(
          Effect.all([observing.count(left), observing.count(right)]).pipe(Effect.delay("10 millis")),
          {
            until: ([leftCount, rightCount]) =>
              Boolean.and(Number.Equivalence(leftCount, 0), Number.Equivalence(rightCount, 0))
          }
        ).pipe(Effect.timeout("2 seconds"))
        expect(yield* observing.count(left)).toBe(0)
        expect(yield* observing.count(right)).toBe(0)
      }).pipe(Effect.scoped)).pipe(Effect.provide(TestLive)))

  it.effect("subtracts asymmetric fractional CSS borders and padding before flooring the initial content box", () =>
    Effect.gen(function*() {
      const browserDocument = yield* BrowserDocument.BrowserDocument
      const browserWindow = yield* BrowserWindow.BrowserWindow
      const element = yield* Effect.acquireRelease(
        Effect.sync(() => {
          const node = browserDocument.createElement("div")
          node.style.cssText =
            "border-style: solid; border-width: 3.5px 2.75px 4.25px 1.25px; padding: 5.75px 12.125px 9.125px 7.5px"
          node.getBoundingClientRect = () => new browserWindow.DOMRect(0, 0, 317.9, 203.2)
          browserDocument.body.appendChild(node)
          return node
        }),
        (node) => Effect.sync(() => node.remove())
      )
      expect(yield* Stream.runHead(ElementSize.contentWidths(element))).toEqual(Option.some(294))
      expect(yield* Stream.runHead(ElementSize.contentHeights(element))).toEqual(Option.some(180))
    }).pipe(Effect.scoped, Effect.provide(TestLive)))
})
