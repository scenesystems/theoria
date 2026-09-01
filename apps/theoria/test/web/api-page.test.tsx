import { RegistryProvider } from "@effect-atom/atom-react"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Option } from "effect"
import type { ReactNode } from "react"
import { createRoot } from "react-dom/client"

import { ApiPageView } from "../../app/web/view/docs/ApiPageView.js"
import { apiPageFixture } from "../helpers/docs-fixtures.js"

const waitFor = (predicate: () => boolean): Effect.Effect<void> =>
  Effect.eventually(
    Effect.sync(predicate).pipe(
      Effect.filterOrFail((ready) => ready, () => "waiting-for-api-page")
    )
  ).pipe(Effect.asVoid, Effect.orDie)

const render = (node: ReactNode) => {
  const container = document.createElement("div")
  document.body.appendChild(container)
  const root = createRoot(container)
  root.render(<RegistryProvider defaultIdleTTL={0}>{node}</RegistryProvider>)
  return { container, root }
}

describe("API page presentation", () => {
  it.effect("indexes exports by category and summary without rendering a declaration dump", () =>
    Effect.gen(function*() {
      const { container, root } = render(<ApiPageView page={apiPageFixture} />)

      yield* Effect.ensuring(
        Effect.gen(function*() {
          yield* waitFor(() => container.textContent?.includes("Run a study.") === true)
          expect(container.querySelector('a[href="#api-runStudy"]')).not.toBeNull()
          expect(container.querySelector('a[href="#api-StudyResult"]')).not.toBeNull()
          expect(container.textContent).not.toContain("runStudy<A>")
          expect(container.textContent).not.toContain("readonly value: A")
        }),
        Effect.sync(() => {
          root.unmount()
          container.remove()
        })
      )
    }))

  it.effect("leads a selected function with documentation before its reference details", () =>
    Effect.gen(function*() {
      const selected = Option.getOrThrow(Option.fromNullable(apiPageFixture.exports[0]))
      const { container, root } = render(<ApiPageView page={apiPageFixture} selectedExport={Option.some(selected)} />)

      yield* Effect.ensuring(
        Effect.gen(function*() {
          yield* waitFor(() => container.textContent?.includes("runStudy<A>") === true)
          expect(container.textContent).toContain("Type parameters")
          expect(container.textContent).toContain("Study input.")
          expect(container.textContent).toContain("Input configuration.")
          expect(container.textContent).toContain("Effect<StudyResult<A>>")
          expect(container.textContent).toContain("const result = yield* runStudy(input)")
          expect(container.textContent?.indexOf("Run a study.")).toBeLessThan(
            container.textContent?.indexOf("runStudy<A>") ?? 0
          )
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

  it.effect("renders documented members only when their export is selected", () =>
    Effect.gen(function*() {
      const selected = Option.getOrThrow(Option.fromNullable(apiPageFixture.exports[1]))
      const { container, root } = render(<ApiPageView page={apiPageFixture} selectedExport={Option.some(selected)} />)

      yield* Effect.ensuring(
        Effect.gen(function*() {
          yield* waitFor(() => container.textContent?.includes("readonly value: A") === true)
          expect(container.textContent).toContain("The selected value.")
          expect(container.textContent).not.toContain("runStudy<A>")
        }),
        Effect.sync(() => {
          root.unmount()
          container.remove()
        })
      )
    }))
})
