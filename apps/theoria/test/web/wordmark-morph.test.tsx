import { RegistryProvider } from "@effect-atom/atom-react"
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import { createRoot } from "react-dom/client"

import { WordmarkMorph } from "../../app/web/view/primitives/WordmarkMorph.js"

const waitForAnimatedMarkup = ({
  initialMarkup,
  target
}: {
  readonly initialMarkup: string
  readonly target: HTMLDivElement
}): Effect.Effect<string, never, never> =>
  Effect.eventually(
    Effect.sync(() => target.innerHTML).pipe(
      Effect.filterOrFail((markup) => markup !== initialMarkup, () => "waiting-for-wordmark-dom-update")
    )
  ).pipe(Effect.orDie)

describe("WordmarkMorph", () => {
  it.live("animates both mounted wordmarks in the browser DOM", () =>
    Effect.gen(function*() {
      const container = document.createElement("div")
      document.body.appendChild(container)
      const root = createRoot(container)

      yield* Effect.sync(() => {
        root.render(
          <RegistryProvider defaultIdleTTL={400}>
            <div>
              <WordmarkMorph />
              <WordmarkMorph />
            </div>
          </RegistryProvider>
        )
      })

      yield* Effect.ensuring(
        Effect.gen(function*() {
          const initialMarkup = container.innerHTML
          const animatedMarkup = yield* waitForAnimatedMarkup({ initialMarkup, target: container })

          expect(animatedMarkup).not.toBe(initialMarkup)
        }),
        Effect.sync(() => {
          root.unmount()
          container.remove()
        })
      )
    }))
})
