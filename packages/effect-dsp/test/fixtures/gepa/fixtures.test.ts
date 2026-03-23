/**
 * GEPA Task 6.6 fixture-governance contracts.
 */
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect } from "effect"
import { loadAllFixtures, loadFixture, validateFixtureManifest } from "../../helpers/dspy-fixtures/index.js"

describe("GEPA fixture governance", () => {
  it.effect("schema-decodes dspy.gepa namespace fixtures via canonical registry authority", () =>
    Effect.gen(function*() {
      const fixtures = yield* loadAllFixtures("dspy.gepa.")
      const catalogFixture = yield* loadFixture("dspy.gepa.catalog.versioned-fixtures")

      expect(fixtures.length).toBeGreaterThan(0)
      expect(catalogFixture.fixture).toBe("dspy.gepa.catalog.versioned-fixtures")
      yield* validateFixtureManifest
    }))

  it.effect("enforces dspy.gepa catalog completeness against committed namespace fixtures", () =>
    Effect.gen(function*() {
      const catalogFixture = yield* loadFixture("dspy.gepa.catalog.versioned-fixtures")
      const namespaceFixtures = yield* loadAllFixtures("dspy.gepa.")
      const catalogPayload = catalogFixture.payload as {
        readonly fixtures: ReadonlyArray<{ readonly name: string }>
      }
      const catalogNames = Arr.map(catalogPayload.fixtures, (entry) => entry.name)
      const namespaceNames = Arr.filter(
        Arr.map(namespaceFixtures, (fixture) => fixture.fixture),
        (name) => name !== "dspy.gepa.catalog.versioned-fixtures" && name !== "dspy.gepa.replay.seed-0.contract"
      )

      const missingFromCatalog = Arr.filter(namespaceNames, (name) => !Arr.contains(catalogNames, name))
      const staleCatalogEntries = Arr.filter(catalogNames, (name) => !Arr.contains(namespaceNames, name))

      expect(missingFromCatalog).toEqual([])
      expect(staleCatalogEntries).toEqual([])
    }))
})
