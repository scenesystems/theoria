/**
 * Computes metric distances and point aggregates with immutable chunks, then
 * exercises validated and runtime-policy variants.
 *
 * Run: bun run packages/effect-math/examples/03-geometry-distances.ts
 * @module
 */
import { BunRuntime } from "@effect/platform-bun"
import { Array, Chunk, Console, Effect } from "effect"

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
import * as Policy from "@scenesystems/effect-math/Policy"

const program = Effect.gen(function*() {
  const origin = Chunk.make(0, 0)
  const point = Chunk.make(3, 4)

  // Direct kernels
  yield* Console.log("euclidean([0,0], [3,4]):", euclideanDistance(origin, point))
  // Output: euclidean([0,0], [3,4]): 5
  yield* Console.log("manhattan([0,0], [3,4]):", manhattanDistance(origin, point))
  yield* Console.log("chebyshev([0,0], [3,4]):", chebyshevDistance(origin, point))

  const mid = midpoint(origin, point)
  yield* Console.log("midpoint([0,0], [3,4]):", mid)

  // Schema-validated boundary
  const distEuclid = yield* distanceValidated({ a: Array.make(0, 0), b: Array.make(3, 4), metric: "euclidean" })
  yield* Console.log("distanceValidated (euclidean):", distEuclid)

  const midResult = yield* midpointValidated({ a: Array.make(0, 0, 0), b: Array.make(6, 8, 10) })
  yield* Console.log("midpointValidated ([0,0,0], [6,8,10]):", midResult)

  const centResult = yield* centroidValidated({
    points: Array.make(Array.make(0, 0), Array.make(4, 0), Array.make(2, 6))
  })
  yield* Console.log("centroidValidated (triangle):", centResult)
  // Output: centroidValidated (triangle): [ 2, 2 ]

  // Strict precision with diagnostics
  const policies = Policy.layerDeterministic({
    seed: Policy.Seed.make(0),
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
