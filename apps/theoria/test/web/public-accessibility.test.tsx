import { describe, expect, it } from "@effect/vitest"
import { Effect, Option } from "effect"
import { createRoot } from "react-dom/client"

import { neutralToneClasses } from "../../app/web/view/primitives/designSystem.js"
import { TheoriaLogo } from "../../app/web/view/primitives/TheoriaLogo.js"
import { ToggleSwitch } from "../../app/web/view/primitives/ToggleSwitch.js"

const render = (node: React.ReactNode) => {
  const container = document.createElement("div")
  document.body.appendChild(container)
  const root = createRoot(container)

  root.render(node)

  return { container, root }
}

const waitFor = (predicate: () => boolean): Effect.Effect<void, never, never> =>
  Effect.eventually(Effect.sync(predicate).pipe(Effect.filterOrFail((ready) => ready, () => "waiting-for-dom"))).pipe(
    Effect.asVoid,
    Effect.orDie
  )

/** Polls the query until the element has rendered. */
const waitForElement = <E extends Element>(query: () => Option.Option<E>): Effect.Effect<E, never, never> =>
  Effect.eventually(Effect.suspend(query))

describe("public-site accessibility", () => {
  it.effect("labels the toggle switch for assistive technology", () =>
    Effect.gen(function*() {
      const { container, root } = render(
        <ToggleSwitch
          checked={false}
          disabled={false}
          label="Obstacles"
          onToggle={() => undefined}
          tone={neutralToneClasses}
        />
      )

      yield* Effect.ensuring(
        Effect.gen(function*() {
          const toggle = yield* waitForElement(() => Option.fromNullable(container.querySelector("[role=\"switch\"]")))
          expect(toggle.getAttribute("aria-label")).toBe("Obstacles")
          expect(toggle.getAttribute("aria-checked")).toBe("false")
        }),
        Effect.sync(() => {
          root.unmount()
          container.remove()
        })
      )
    }))

  it.effect("exposes the logo through valid text or image semantics", () =>
    Effect.gen(function*() {
      const { container, root } = render(
        <>
          <TheoriaLogo />
          <TheoriaLogo animation="glossary" />
        </>
      )

      yield* Effect.ensuring(
        Effect.gen(function*() {
          yield* waitFor(() => container.textContent?.includes("Theoria") === true)
          expect(container.querySelector("span:not([role])[aria-label]")).toBeNull()
          expect(container.querySelector("[role=\"img\"]")?.getAttribute("aria-label")).toBe("Theoria")
        }),
        Effect.sync(() => {
          root.unmount()
          container.remove()
        })
      )
    }))
})
