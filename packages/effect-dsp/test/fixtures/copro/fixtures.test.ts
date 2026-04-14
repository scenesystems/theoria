/**
 * COPRO fixture-governance contracts.
 */
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import { loadAllFixtures, loadFixture, validateFixtureManifest } from "../../helpers/dspy-fixtures/index.js"

describe("COPRO fixture governance", () => {
  it.effect("schema-decodes dspy.copro namespace fixtures via canonical registry authority", () =>
    Effect.gen(function*() {
      const fixtures = yield* loadAllFixtures("dspy.copro.")
      const progressionFixture = yield* loadFixture("dspy.copro.progression.basic")

      expect(fixtures.length).toBe(2)
      expect(progressionFixture.fixture).toBe("dspy.copro.progression.basic")
      yield* validateFixtureManifest
    }))
})
