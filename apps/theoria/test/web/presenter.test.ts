import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import { presentRun } from "../../app/web/view/presenter.js"
import { runDataFixture } from "../helpers/entry-fixtures.js"

describe("Theoria Presenter", () => {
  it.effect("maps evidence sections to presented sections", () =>
    Effect.gen(function*() {
      const presented = presentRun(runDataFixture("presenter fixture"))

      expect(presented.sections.length).toBe(2)
      expect(presented.sections[0]?.title).toBe("Performance")
      expect(presented.sections[1]?.title).toBe("Corpus")
    }))

  it.effect("summary propagates from run data", () =>
    Effect.gen(function*() {
      const presented = presentRun(runDataFixture("propagation test"))
      expect(presented.summary).toBe("propagation test")
    }))

  it.effect("comparison items format baseline → improved with delta percent", () =>
    Effect.gen(function*() {
      const presented = presentRun(runDataFixture("improvements"))
      const performanceSection = presented.sections[0]
      expect(performanceSection?.rows.length).toBe(1)
      const row = performanceSection?.rows[0]
      expect(row?.label).toBe("Projection runtime")
      expect(row?.value).toContain("→")
      expect(row?.value).toContain("ms")
    }))

  it.effect("text items map label and value directly", () =>
    Effect.gen(function*() {
      const presented = presentRun(runDataFixture("text items"))
      const corpusSection = presented.sections[1]
      expect(corpusSection?.rows.length).toBe(1)
      expect(corpusSection?.rows[0]?.label).toBe("Corpus entries")
      expect(corpusSection?.rows[0]?.value).toBe("1")
    }))

  it.effect("program carries through from run data", () =>
    Effect.gen(function*() {
      const presented = presentRun(runDataFixture("program"))
      const file = presented.program.files[0]!
      expect(file.language).toBe("ts")
      expect(file.entry).toBe("server/run.ts")
      expect(file.name).toBe("run.ts")
    }))
})
