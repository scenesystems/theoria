import { expect, it } from "@effect/vitest"
import { Array as Arr, Effect } from "effect"
import * as Fixtures from "../kit/Fixtures.js"

it.effect("verifies the content hash and evidence claim before returning every fixture", () =>
  Effect.gen(function*() {
    const manifest = yield* Fixtures.manifest
    expect(Arr.filter(manifest.fixtures, (entry) => entry.evidence === "local-regression")).toHaveLength(0)
    yield* Effect.forEach(manifest.fixtures, (entry) => Fixtures.fixture(entry.id, entry.evidence))
    yield* Effect.forEach([
      "eval-failure-inclusive-001",
      "mipro-trial-budget-001",
      "mipro-best-fullval-001",
      "gepa-aggregate-best-001",
      "bootstrap-teacher-trace-001"
    ], (id) => Fixtures.fixture(id, "upstream-execution"))
  }))

it.effect("rejects changing execution, kernel or regression evidence claims", () =>
  Effect.gen(function*() {
    expect(yield* Fixtures.fixture("chat-adapter-001", "upstream-execution").pipe(Effect.flip))
      .toEqual(new Fixtures.FixtureError({ id: "chat-adapter-001", reason: "evidence" }))
    expect(yield* Fixtures.fixture("mipro-trial-budget-001", "local-regression").pipe(Effect.flip))
      .toEqual(new Fixtures.FixtureError({ id: "mipro-trial-budget-001", reason: "evidence" }))
  }))
