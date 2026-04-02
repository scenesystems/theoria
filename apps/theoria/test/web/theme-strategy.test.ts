import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import { surfaceThemeForCard } from "../../app/web/view/primitives/designSystem.js"

describe("Theoria Theme Strategy", () => {
  it.effect("keeps structural surfaces neutral across all cards", () =>
    Effect.gen(function*() {
      const textTheme = surfaceThemeForCard("effect-text")
      const searchTheme = surfaceThemeForCard("effect-search")
      const mathTheme = surfaceThemeForCard("effect-math")
      const dspTheme = surfaceThemeForCard("effect-dsp")

      expect(textTheme.shell).toContain("border-stage-300/85")
      expect(searchTheme.shell).toContain("border-stage-300/85")
      expect(mathTheme.shell).toContain("border-stage-300/85")
      expect(dspTheme.shell).toContain("border-stage-300/85")

      expect(textTheme.panel).toContain("border-stage-200/95")
      expect(searchTheme.panel).toContain("border-stage-200/95")
      expect(mathTheme.panel).toContain("border-stage-200/95")
      expect(dspTheme.panel).toContain("border-stage-200/95")

      expect(textTheme.statusTag).toContain("border-stage-200/90")
      expect(searchTheme.statusTag).toContain("border-stage-200/90")
      expect(mathTheme.statusTag).toContain("border-stage-200/90")
      expect(dspTheme.statusTag).toContain("border-stage-200/90")
    }))

  it.effect("limits tone-specific color to accent affordances", () =>
    Effect.gen(function*() {
      const textTheme = surfaceThemeForCard("effect-text")
      const searchTheme = surfaceThemeForCard("effect-search")
      const mathTheme = surfaceThemeForCard("effect-math")
      const dspTheme = surfaceThemeForCard("effect-dsp")

      expect(textTheme.accent).toContain("tone-text")
      expect(searchTheme.accent).toContain("tone-search")
      expect(mathTheme.accent).toContain("tone-math")
      expect(dspTheme.accent).toContain("tone-dsp")

      expect(textTheme.badgeDot).toContain("tone-text")
      expect(searchTheme.badgeDot).toContain("tone-search")
      expect(mathTheme.badgeDot).toContain("tone-math")
      expect(dspTheme.badgeDot).toContain("tone-dsp")

      expect(textTheme.primaryAction).not.toContain("tone-")
      expect(searchTheme.primaryAction).not.toContain("tone-")
      expect(mathTheme.primaryAction).not.toContain("tone-")
      expect(dspTheme.primaryAction).not.toContain("tone-")

      expect(textTheme.tabActive).not.toContain("tone-")
      expect(searchTheme.tabActive).not.toContain("tone-")
      expect(mathTheme.tabActive).not.toContain("tone-")
      expect(dspTheme.tabActive).not.toContain("tone-")

      expect(textTheme.secondaryAction).not.toContain("tone-")
      expect(searchTheme.secondaryAction).not.toContain("tone-")
      expect(mathTheme.secondaryAction).not.toContain("tone-")
      expect(dspTheme.secondaryAction).not.toContain("tone-")

      expect(textTheme.backAction).not.toContain("tone-")
      expect(searchTheme.backAction).not.toContain("tone-")
      expect(mathTheme.backAction).not.toContain("tone-")
      expect(dspTheme.backAction).not.toContain("tone-")
    }))
})
