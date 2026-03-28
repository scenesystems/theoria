import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer } from "effect"

import { AutodiffAuthorityService, DefaultAutodiffAuthority } from "../../src/contracts/shared/AutodiffAuthority.js"
import { BackendAuthorityService } from "../../src/contracts/shared/BackendAuthority.js"
import { ComputationDispatcherLive, planAdvancedComputation } from "../../src/contracts/shared/ComputationDispatch.js"
import {
  DefaultPrecisionEscalationPolicy,
  PrecisionEscalationService
} from "../../src/contracts/shared/PrecisionEscalation.js"
import { DefaultScalarAuthority, ScalarAuthorityService } from "../../src/contracts/shared/ScalarAuthority.js"

const customAuthorityLayer = Layer.mergeAll(
  Layer.succeed(ScalarAuthorityService, DefaultScalarAuthority),
  Layer.succeed(PrecisionEscalationService, DefaultPrecisionEscalationPolicy),
  Layer.succeed(AutodiffAuthorityService, DefaultAutodiffAuthority),
  Layer.succeed(BackendAuthorityService, {
    policy: {
      preferredOrder: ["accelerated", "typed-array", "scalar"]
    },
    capabilities: [{
      kind: "accelerated",
      available: true,
      supportedScalarKinds: ["float64"]
    }, {
      kind: "typed-array",
      available: true,
      supportedScalarKinds: ["float64"]
    }, {
      kind: "scalar",
      available: true,
      supportedScalarKinds: ["float64", "bigdecimal"]
    }]
  })
)

describe("advanced computation dispatcher seam contracts", () => {
  it.effect("honors externally provided authority composition", () =>
    Effect.gen(function*() {
      const plan = yield* planAdvancedComputation({
        operationCategory: "numeric",
        operationName: "sum",
        requestedScalarKind: "float64",
        escalationAttempt: 0,
        converged: true,
        requiresAutodiff: false,
        requiresUncertaintyEnvelope: false
      }).pipe(Effect.provide(Layer.mergeAll(ComputationDispatcherLive, customAuthorityLayer)))

      expect(plan.backendKind).toStrictEqual("accelerated")
    }))
})
