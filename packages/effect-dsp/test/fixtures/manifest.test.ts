import { expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Equal } from "effect"
import * as Fixtures from "../kit/Fixtures.js"

it.effect("verifies the content hash and evidence claim before returning every fixture", () =>
  Effect.gen(function*() {
    const manifest = yield* Fixtures.manifest
    expect(Arr.filter(manifest.fixtures, (entry) => Equal.equals(entry.evidence, "local-regression"))).toHaveLength(0)
    yield* Effect.forEach(manifest.fixtures, (entry) => Fixtures.fixture(entry.id, entry.evidence))
    yield* Effect.forEach([
      "eval-failure-inclusive",
      "mipro-trial-budget",
      "mipro-best-fullval",
      "gepa-aggregate-best",
      "bootstrap-teacher-trace"
    ], (id) => Fixtures.fixture(id, "upstream-execution"))
  }))

it.effect("rejects changing execution, kernel or regression evidence claims", () =>
  Effect.gen(function*() {
    expect(yield* Fixtures.fixture("chat-adapter", "upstream-execution").pipe(Effect.flip))
      .toEqual(new Fixtures.FixtureError({ id: "chat-adapter", reason: "evidence" }))
    expect(yield* Fixtures.fixture("mipro-trial-budget", "local-regression").pipe(Effect.flip))
      .toEqual(new Fixtures.FixtureError({ id: "mipro-trial-budget", reason: "evidence" }))
  }))
