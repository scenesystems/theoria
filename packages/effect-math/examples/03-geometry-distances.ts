/**
 * Computes metric distances and point aggregates with immutable chunks, then
 * exercises validated and runtime-policy variants.
 *
 * Run: bun run packages/effect-math/examples/03-geometry-distances.ts
 * @module
 */
import { BunRuntime } from "@effect/platform-bun"
import { Chunk, Console, Effect } from "effect"

import { makeDeterministicRuntimePoliciesLayer, Seed } from "@scenesystems/effect-math/contracts"
import {
  centroidValidated,
  chebyshevDistance,
  distanceValidated,
  distanceWithPolicies,
  euclideanDistance,
  manhattanDistance,
  midpoint,
  midpointValidated
} from "@scenesystems/effect-math/Geometry"

const program = Effect.gen(function*() {
  const origin = Chunk.fromIterable([0, 0])
  const point = Chunk.fromIterable([3, 4])

  // Direct kernels
  yield* Console.log("euclidean([0,0], [3,4]):", euclideanDistance(origin, point))
  // Output: euclidean([0,0], [3,4]): 5
  yield* Console.log("manhattan([0,0], [3,4]):", manhattanDistance(origin, point))
  yield* Console.log("chebyshev([0,0], [3,4]):", chebyshevDistance(origin, point))

  const mid = midpoint(origin, point)
  yield* Console.log("midpoint([0,0], [3,4]):", Chunk.toReadonlyArray(mid))

  // Schema-validated boundary
  const distEuclid = yield* distanceValidated({ a: [0, 0], b: [3, 4], metric: "euclidean" })
  yield* Console.log("distanceValidated (euclidean):", distEuclid)

  const midResult = yield* midpointValidated({ a: [0, 0, 0], b: [6, 8, 10] })
  yield* Console.log("midpointValidated ([0,0,0], [6,8,10]):", midResult)

  const centResult = yield* centroidValidated({ points: [[0, 0], [4, 0], [2, 6]] })
  yield* Console.log("centroidValidated (triangle):", centResult)
  // Output: centroidValidated (triangle): [ 2, 2 ]

  // Strict precision with diagnostics
  const policies = makeDeterministicRuntimePoliciesLayer({
    seed: Seed.make(0),
    precision: "strict",
    backend: "scalar",
    diagnostics: "enabled"
  })

  const distP = yield* distanceWithPolicies(origin, point, "euclidean").pipe(
    Effect.provide(policies)
  )
  yield* Console.log("distanceWithPolicies (euclidean, strict):", distP)
  // Output: distanceWithPolicies (euclidean, strict): 5
})

BunRuntime.runMain(program)
