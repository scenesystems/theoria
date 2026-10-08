import { it } from "@effect/vitest"
import { Effect } from "effect"
import { FixtureRegistryLive, validateFixtureManifest } from "../helpers/fixtures/index.js"

// Validate evidence independently of the behavioral replay tests.
it.effect("schema-validates every Optuna 4.9 fixture before behavioral replay", () =>
  validateFixtureManifest.pipe(Effect.provide(FixtureRegistryLive)))
