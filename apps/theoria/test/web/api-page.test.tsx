import { RegistryProvider } from "@effect-atom/atom-react"
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import { createRoot } from "react-dom/client"

import { ApiPageView } from "../../app/web/view/docs/ApiPageView.js"
import { apiPageFixture } from "../helpers/docs-fixtures.js"

const waitFor = (predicate: () => boolean): Effect.Effect<void> =>
  Effect.eventually(
    Effect.sync(predicate).pipe(
      Effect.filterOrFail((ready) => ready, () => "waiting-for-api-page")
    )
  ).pipe(Effect.asVoid, Effect.orDie)

describe("API page presentation", () => {
  it.effect("renders semantic signatures, generics, parameters, examples, members, and sources", () =>
    Effect.gen(function*() {
      const container = document.createElement("div")
      document.body.appendChild(container)
      const root = createRoot(container)
      root.render(<RegistryProvider defaultIdleTTL={0}><ApiPageView page={apiPageFixture} /></RegistryProvider>)

      yield* Effect.ensuring(
        Effect.gen(function*() {
          yield* waitFor(() => container.textContent?.includes("runStudy<A>") === true)
          expect(container.textContent).toContain("Type parameters")
          expect(container.textContent).toContain("Study input.")
          expect(container.textContent).toContain("Input configuration.")
          expect(container.textContent).toContain("Effect<StudyResult<A>>")
          expect(container.textContent).toContain("const result = yield* runStudy(input)")
          expect(container.textContent).toContain("readonly value: A")
          expect(container.querySelectorAll('a[target="_blank"]')).not.toHaveLength(0)
          expect(container.textContent).not.toContain("export declare")
          expect(container.textContent).not.toContain("```ts")
        }),
        Effect.sync(() => {
          root.unmount()
          container.remove()
        })
      )
    }))
})
