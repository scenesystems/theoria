import { it } from "@effect/vitest"
import { Effect } from "effect"
import { FixtureRegistryLive, validateFixtureManifest } from "../helpers/fixtures/index.js"

// Keep malformed evidence RED even when a consuming parity assertion is expected to fail.
it.effect("decodes every Optuna 4.9 fixture outside expected-failure tests", () =>
  validateFixtureManifest.pipe(Effect.provide(FixtureRegistryLive)))
