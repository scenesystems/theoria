import { BunContext } from "@effect/platform-bun"
import { Array as Arr, Console, Effect } from "effect"

import { encodeBenchmarkArtifact, runBenchmarkSuite, validateBenchmarkArtifact } from "./harness.js"

export const benchProgram = Effect.gen(function*() {
  const artifact = yield* runBenchmarkSuite().pipe(Effect.orDie)
  const encoded = yield* encodeBenchmarkArtifact(artifact).pipe(Effect.orDie)
  const violations = validateBenchmarkArtifact(artifact)

  yield* Console.log(encoded)

  if (Arr.isNonEmptyArray(violations)) {
    return yield* Effect.fail(violations)
  }
}).pipe(Effect.provide(BunContext.layer))
