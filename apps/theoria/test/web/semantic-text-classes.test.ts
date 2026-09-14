import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import * as Arr from "effect/Array"

import { SurfaceVariant } from "../../app/contracts/presentation.js"
import { TextRole } from "../../app/contracts/text.js"
import { maxWidthClassName, whiteSpaceClassName } from "../../app/web/view/primitives/semanticTextClasses.js"

describe("semantic text classes", () => {
  it.effect("white-space mode maps to its Tailwind utility", () =>
    Effect.sync(() => {
      expect(whiteSpaceClassName("pre-wrap")).toBe("whitespace-pre-wrap")
      expect(whiteSpaceClassName("normal")).toBe("whitespace-normal")
    }))

  it.effect("control-sized roles carry no measure of their own", () =>
    Effect.sync(() => {
      expect(maxWidthClassName("button-label", "compact")).toBe("")
      expect(maxWidthClassName("tab-label", "expanded")).toBe("")
      expect(maxWidthClassName("marker-label", "compact")).toBe("")
    }))

  it.effect("every other role is bounded by its surface's measure variable", () =>
    Effect.sync(() => {
      const measured = Arr.filter(
        TextRole.literals,
        (role) => role !== "button-label" && role !== "tab-label" && role !== "marker-label"
      )
      expect(measured.length).toBeGreaterThan(0)
      Arr.forEach(measured, (role) => {
        Arr.forEach(SurfaceVariant.literals, (variant) => {
          expect(maxWidthClassName(role, variant)).toBe(`max-w-(--st-mw-${role}-${variant})`)
        })
      })
    }))
})
