import { Layer } from "effect"

import {
  AutodiffAuthorityService,
  type AutodiffAuthorityStateType,
  DefaultAutodiffAuthority
} from "../../../src/contracts/shared/AutodiffAuthority.js"
import { ComputationDispatcherLive } from "../../../src/contracts/shared/ComputationDispatch.js"
import {
  DefaultPrecisionEscalationPolicy,
  type PrecisionEscalationPolicyType,
  PrecisionEscalationService
} from "../../../src/contracts/shared/PrecisionEscalation.js"
import { BackendPolicyService, type BackendPolicyType } from "../../../src/contracts/shared/RuntimePolicies.js"
import {
  DefaultScalarAuthority,
  ScalarAuthorityService,
  type ScalarAuthorityStateType
} from "../../../src/contracts/shared/ScalarAuthority.js"

export const makeComputationDispatcherLayer = (
  overrides: {
    readonly scalarAuthority?: ScalarAuthorityStateType
    readonly precisionEscalation?: PrecisionEscalationPolicyType
    readonly backendPolicy?: BackendPolicyType["policy"]
    readonly autodiffAuthority?: AutodiffAuthorityStateType
  } = {}
) =>
  Layer.mergeAll(
    ComputationDispatcherLive,
    Layer.mergeAll(
      Layer.succeed(ScalarAuthorityService, overrides.scalarAuthority ?? DefaultScalarAuthority),
      Layer.succeed(PrecisionEscalationService, overrides.precisionEscalation ?? DefaultPrecisionEscalationPolicy),
      Layer.succeed(BackendPolicyService, { policy: overrides.backendPolicy ?? "scalar" }),
      Layer.succeed(AutodiffAuthorityService, overrides.autodiffAuthority ?? DefaultAutodiffAuthority)
    )
  )
