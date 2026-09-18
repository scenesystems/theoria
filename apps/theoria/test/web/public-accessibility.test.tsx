import { describe, expect, it } from "@effect/vitest"
import { Effect, Function as Fn, Option } from "effect"

import * as BrowserDocument from "../../app/web/platform/BrowserDocument.js"
import { neutralToneClasses } from "../../app/web/view/primitives/designSystem.js"
import { TheoriaLogo } from "../../app/web/view/primitives/TheoriaLogo.js"
import { ToggleSwitch } from "../../app/web/view/primitives/ToggleSwitch.js"
import { mountReact, waitFor, waitForValue } from "../helpers/react-mount.js"

describe("public-site accessibility", () => {
  it.effect("labels the toggle switch for assistive technology", () =>
    Effect.gen(function*() {
      const { container } = yield* mountReact(
        <ToggleSwitch
          checked={false}
          disabled={false}
          label="Obstacles"
          onToggle={Fn.constVoid}
          tone={neutralToneClasses}
        />
      )

      const toggle = yield* waitForValue(() => Option.fromNullable(container.querySelector("[role=\"switch\"]")))
      expect(toggle.getAttribute("aria-label")).toBe("Obstacles")
      expect(toggle.getAttribute("aria-checked")).toBe("false")
    }).pipe(Effect.scoped, Effect.provide(BrowserDocument.layer)))

  it.effect("exposes the logo through valid text or image semantics", () =>
    Effect.gen(function*() {
      const { container } = yield* mountReact(
        <>
          <TheoriaLogo animation="none" />
          <TheoriaLogo animation="glossary" />
        </>
      )

      yield* waitFor(() =>
        Option.exists(Option.fromNullable(container.textContent), (text) => text.includes("Theoria"))
      )
      expect(container.querySelector("span:not([role])[aria-label]")).toBeNull()
      expect(container.querySelector("[role=\"img\"]")?.getAttribute("aria-label")).toBe("Theoria")
    }).pipe(Effect.scoped, Effect.provide(BrowserDocument.layer)))
})
