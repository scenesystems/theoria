import { RegistryProvider } from "@effect-atom/atom-react"
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import { createRoot } from "react-dom/client"

import { SemanticText } from "../../app/web/view/primitives/SemanticText.js"

const withMockClientWidth = <A,>(
  width: number,
  effect: Effect.Effect<A, never, never>
): Effect.Effect<A, never, never> =>
  Effect.acquireUseRelease(
    Effect.sync(() => {
      const descriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth")

      Reflect.defineProperty(HTMLElement.prototype, "clientWidth", {
        configurable: true,
        get: () => width
      })

      return descriptor
    }),
    () => effect,
    (descriptor) =>
      Effect.sync(() => {
        if (descriptor === undefined) {
          Reflect.deleteProperty(HTMLElement.prototype, "clientWidth")
          return
        }

        Reflect.defineProperty(HTMLElement.prototype, "clientWidth", descriptor)
      })
  )

const renderedLineSpans = (container: HTMLDivElement): ReadonlyArray<HTMLSpanElement> =>
  Array.from(container.querySelectorAll("p > span")).flatMap((element) =>
    element instanceof HTMLSpanElement ? [element] : []
  )

const waitForProjectedLines = (
  container: HTMLDivElement,
  expectedCount: number
): Effect.Effect<ReadonlyArray<HTMLSpanElement>, never, never> =>
  Effect.eventually(
    Effect.sync(() => renderedLineSpans(container)).pipe(
      Effect.filterOrFail((spans) => spans.length === expectedCount, () => "waiting-for-projected-semantic-text")
    )
  ).pipe(Effect.orDie)

describe("SemanticText", () => {
  it.live("preserves pre-wrap whitespace and blank projected lines for code blocks", () =>
    withMockClientWidth(
      240,
      Effect.gen(function*() {
        const container = document.createElement("div")
        document.body.appendChild(container)
        const root = createRoot(container)

        yield* Effect.sync(() => {
          root.render(
            <RegistryProvider defaultIdleTTL={400}>
              <SemanticText
                as="p"
                role="code-block"
                text={"const  x = 1\n\n\treturn 2"}
                variant="expanded"
              />
            </RegistryProvider>
          )
        })

        yield* Effect.ensuring(
          Effect.gen(function*() {
            const spans = yield* waitForProjectedLines(container, 3)

            expect(spans.every((span) => span.className.includes("whitespace-pre"))).toBe(true)
            expect(spans[0]?.textContent).toBe("const  x = 1")
            expect(spans[1]?.textContent).toBe("\u00a0")
            expect(spans[2]?.textContent).toBe("\treturn 2")
          }),
          Effect.sync(() => {
            root.unmount()
            container.remove()
          })
        )
      })
    ))
})
