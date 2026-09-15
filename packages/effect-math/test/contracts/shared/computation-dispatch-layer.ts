import { Data, Layer, Option } from "effect"

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

class ComputationDispatcherLayerOverrides extends Data.Class<{
  readonly scalarAuthority?: ScalarAuthorityStateType
  readonly precisionEscalation?: PrecisionEscalationPolicyType
  readonly backendPolicy?: BackendPolicyType["policy"]
  readonly autodiffAuthority?: AutodiffAuthorityStateType
}> {}

const defaultOverrides = new ComputationDispatcherLayerOverrides({})
const defaultBackendPolicy: BackendPolicyType["policy"] = "scalar"

export const makeComputationDispatcherLayer = (overrides: ComputationDispatcherLayerOverrides = defaultOverrides) =>
  Layer.mergeAll(
    ComputationDispatcherLive,
    Layer.mergeAll(
      Layer.succeed(
        ScalarAuthorityService,
        Option.getOrElse(Option.fromNullable(overrides.scalarAuthority), () => DefaultScalarAuthority)
      ),
      Layer.succeed(
        PrecisionEscalationService,
        Option.getOrElse(Option.fromNullable(overrides.precisionEscalation), () => DefaultPrecisionEscalationPolicy)
      ),
      Layer.succeed(BackendPolicyService, {
        policy: Option.getOrElse(Option.fromNullable(overrides.backendPolicy), () => defaultBackendPolicy)
      }),
      Layer.succeed(
        AutodiffAuthorityService,
        Option.getOrElse(Option.fromNullable(overrides.autodiffAuthority), () => DefaultAutodiffAuthority)
      )
    )
  )
