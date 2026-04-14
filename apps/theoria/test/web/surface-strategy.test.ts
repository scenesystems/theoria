import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import { surfaceForCard } from "../../app/web/view/primitives/theme/surface.js"

describe("Theoria Surface Strategy", () => {
  it.effect("keeps structural surfaces neutral across all cards", () =>
    Effect.gen(function*() {
      const textTheme = surfaceForCard("effect-text")
      const searchTheme = surfaceForCard("effect-search")
      const mathTheme = surfaceForCard("effect-math")
      const dspTheme = surfaceForCard("effect-dsp")
      const workflowTheme = surfaceForCard("workflow")

      expect(textTheme.shell).toContain("border-stage-300/84")
      expect(searchTheme.shell).toContain("border-stage-300/84")
      expect(mathTheme.shell).toContain("border-stage-300/84")
      expect(dspTheme.shell).toContain("border-stage-300/84")
      expect(workflowTheme.shell).toContain("border-stage-300/84")

      expect(textTheme.panel).toContain("bg-stage-0/74")
      expect(searchTheme.panel).toContain("bg-stage-0/74")
      expect(mathTheme.panel).toContain("bg-stage-0/74")
      expect(dspTheme.panel).toContain("bg-stage-0/74")
      expect(workflowTheme.panel).toContain("bg-stage-0/74")

      expect(textTheme.statusTag).toContain("border-stage-200/84")
      expect(searchTheme.statusTag).toContain("border-stage-200/84")
      expect(mathTheme.statusTag).toContain("border-stage-200/84")
      expect(dspTheme.statusTag).toContain("border-stage-200/84")
      expect(workflowTheme.statusTag).toContain("border-stage-200/84")
    }))

  it.effect("limits tone-specific color to accent affordances", () =>
    Effect.gen(function*() {
      const textTheme = surfaceForCard("effect-text")
      const searchTheme = surfaceForCard("effect-search")
      const mathTheme = surfaceForCard("effect-math")
      const dspTheme = surfaceForCard("effect-dsp")
      const workflowTheme = surfaceForCard("workflow")

      expect(textTheme.accent).toContain("tone-text")
      expect(searchTheme.accent).toContain("tone-search")
      expect(mathTheme.accent).toContain("tone-math")
      expect(dspTheme.accent).toContain("tone-dsp")
      expect(workflowTheme.accent).toContain("tone-search")

      expect(textTheme.badgeDot).toContain("tone-text")
      expect(searchTheme.badgeDot).toContain("tone-search")
      expect(mathTheme.badgeDot).toContain("tone-math")
      expect(dspTheme.badgeDot).toContain("tone-dsp")
      expect(workflowTheme.badgeDot).toContain("tone-search")

      expect(textTheme.primaryAction).not.toContain("tone-")
      expect(searchTheme.primaryAction).not.toContain("tone-")
      expect(mathTheme.primaryAction).not.toContain("tone-")
      expect(dspTheme.primaryAction).not.toContain("tone-")
      expect(workflowTheme.primaryAction).not.toContain("tone-")

      expect(textTheme.tabActive).not.toContain("tone-")
      expect(searchTheme.tabActive).not.toContain("tone-")
      expect(mathTheme.tabActive).not.toContain("tone-")
      expect(dspTheme.tabActive).not.toContain("tone-")
      expect(workflowTheme.tabActive).not.toContain("tone-")

      expect(textTheme.secondaryAction).not.toContain("tone-")
      expect(searchTheme.secondaryAction).not.toContain("tone-")
      expect(mathTheme.secondaryAction).not.toContain("tone-")
      expect(dspTheme.secondaryAction).not.toContain("tone-")
      expect(workflowTheme.secondaryAction).not.toContain("tone-")

      expect(textTheme.backAction).not.toContain("tone-")
      expect(searchTheme.backAction).not.toContain("tone-")
      expect(mathTheme.backAction).not.toContain("tone-")
      expect(dspTheme.backAction).not.toContain("tone-")
      expect(workflowTheme.backAction).not.toContain("tone-")
    }))
})
