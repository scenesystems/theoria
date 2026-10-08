import { RegistryContext } from "@effect/atom-react"
import { expect, it } from "@effect/vitest"
import { Effect, Layer, Number as Num, Ref } from "effect"
import { AtomRegistry as Registry } from "effect/reactivity"
import { StrictMode } from "react"

import { usePlaceAnswerLayout } from "../../app/web/atoms/place-answer-layout.js"
import * as BrowserDocument from "../../app/web/platform/BrowserDocument.js"
import * as BrowserWindow from "../../app/web/platform/BrowserWindow.js"
import { mountReact, waitFor } from "../helpers/react-mount.js"

const Answer = () => (
  <div ref={usePlaceAnswerLayout()}>
    <div data-place-provenance>Answer</div>
  </div>
)

it.live("unmounting an answer releases frame observations even while the registry remains alive", () =>
  Effect.gen(function*() {
    const document = yield* BrowserDocument.BrowserDocument
    const window = yield* BrowserWindow.BrowserWindow
    const reads = yield* Ref.make(0)
    const run = Effect.runSyncWith(yield* Effect.context<never>())
    yield* Effect.acquireRelease(
      Effect.sync(() => {
        const trigger = document.createElement("button")
        trigger.setAttribute("data-provenance", "test")
        trigger.setAttribute("data-popup-open", "")
        trigger.getBoundingClientRect = () => {
          run(Ref.update(reads, Num.increment))
          return new window.DOMRect(20, 30, 40, 50)
        }
        document.body.appendChild(trigger)
        return trigger
      }),
      (trigger) => Effect.sync(() => trigger.remove())
    )
    const registry = yield* Effect.acquireRelease(
      Effect.sync(() => Registry.make({ defaultIdleTTL: 60_000 })),
      (registry) => Effect.sync(() => registry.dispose())
    )
    const { root, container } = yield* mountReact(
      <RegistryContext.Provider value={registry}>
        <StrictMode>
          <Answer />
        </StrictMode>
      </RegistryContext.Provider>
    )
    yield* waitFor(() => Ref.getUnsafe(reads) > 1)
    yield* Effect.sync(() => root.render(null))
    yield* waitFor(() => container.childElementCount === 0)
    yield* Effect.sleep("50 millis")
    const released = yield* Ref.get(reads)
    yield* Effect.sleep("100 millis")
    expect(yield* Ref.get(reads)).toBe(released)
  }).pipe(Effect.scoped, Effect.provide(Layer.merge(BrowserDocument.layer, BrowserWindow.layer))))
