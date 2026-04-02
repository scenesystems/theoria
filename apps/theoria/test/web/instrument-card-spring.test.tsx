import { RegistryProvider } from "@effect-atom/atom-react"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Option } from "effect"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import { cardById } from "../../app/contracts/card.js"
import { toneClassesForCard } from "../../app/web/view/primitives/designSystem.js"
import { InstrumentCard } from "../../app/web/view/home/InstrumentCard.js"

const versionsEnvelope = {
  ok: true,
  meta: {
    requestId: "req-versions",
    buildSha: "build-versions",
    durationMs: 1
  },
  data: {
    "effect-search": "0.2.0"
  }
}

const withMockVersionsFetch = <A,>(effect: Effect.Effect<A, never, never>): Effect.Effect<A, never, never> => {
  const previousFetch = globalThis.fetch

  return Effect.gen(function*() {
    yield* Effect.sync(() => {
      Reflect.set(globalThis, "fetch", () =>
        Promise.resolve({
          json: () => Promise.resolve(versionsEnvelope)
        })
      )
    })

    return yield* effect
  }).pipe(
    Effect.ensuring(
      Effect.sync(() => {
        Reflect.set(globalThis, "fetch", previousFetch)
      })
    )
  )
}

const waitForTransform = (
  element: HTMLDivElement,
  label: string,
  predicate: (transform: string) => boolean
): Effect.Effect<string, never, never> =>
  Effect.eventually(
    Effect.sync(() => element.style.transform).pipe(
      Effect.filterOrFail((transform) => predicate(transform), () => `waiting-for-${label}`)
    )
  ).pipe(Effect.orDie)

const dispatchPointerEvent = (
  element: HTMLDivElement,
  type: "enter" | "leave"
): Effect.Effect<void, never, never> =>
  Effect.sync(() => {
    element.dispatchEvent(
      new PointerEvent(type === "enter" ? "pointerover" : "pointerout", {
        bubbles: true
      })
    )
  })

const waitForRootElement = (container: HTMLDivElement): Effect.Effect<HTMLDivElement, never, never> =>
  Effect.eventually(
    Effect.sync(() => Option.fromNullable(container.firstElementChild)).pipe(
      Effect.flatMap(
        Option.match({
          onNone: () => Effect.fail("waiting-for-instrument-card-root"),
          onSome: (element) =>
            element instanceof HTMLDivElement
              ? Effect.succeed(element)
              : Effect.fail("waiting-for-instrument-card-root")
        })
      )
    )
  ).pipe(Effect.orDie)

describe("InstrumentCard spring", () => {
  it.live("rapid hover reversals settle back to rest under StrictMode", () =>
    withMockVersionsFetch(
      Effect.gen(function*() {
        const cardOption = cardById("effect-search")

        if (Option.isNone(cardOption)) {
          return yield* Effect.die("missing-effect-search-card")
        }

        const card = cardOption.value
        const container = document.createElement("div")
        document.body.appendChild(container)
        const root = createRoot(container)

        yield* Effect.sync(() => {
          root.render(
            <StrictMode>
              <RegistryProvider defaultIdleTTL={400}>
                <InstrumentCard card={card} tone={toneClassesForCard(card.id)} />
              </RegistryProvider>
            </StrictMode>
          )
        })

        yield* Effect.ensuring(
          Effect.gen(function*() {
            const rootElement = yield* waitForRootElement(container)

            yield* dispatchPointerEvent(rootElement, "enter")
            const initialTransform = yield* waitForTransform(
              rootElement,
              "card-transform-active",
              (transform) => transform.length > 0
            )

            expect(initialTransform.length).toBeGreaterThan(0)

            yield* dispatchPointerEvent(rootElement, "leave")
            yield* dispatchPointerEvent(rootElement, "enter")

            const resumedTransform = yield* waitForTransform(
              rootElement,
              "card-transform-resumed",
              (transform) => transform.length > 0
            )

            expect(resumedTransform.length).toBeGreaterThan(0)

            yield* dispatchPointerEvent(rootElement, "leave")

            const restingTransform = yield* waitForTransform(
              rootElement,
              "card-transform-resting",
              (transform) => transform.length === 0
            )

            expect(restingTransform).toBe("")
          }),
          Effect.sync(() => {
            root.unmount()
            container.remove()
          })
        )
      })
    ))
})
