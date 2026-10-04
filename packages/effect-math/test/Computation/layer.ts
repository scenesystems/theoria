import { Data, Layer, Option, Schema } from "effect"

import * as Autodiff from "../../src/Autodiff.js"
import * as Computation from "../../src/Computation.js"
import * as Policy from "../../src/Policy.js"
import * as Precision from "../../src/Precision.js"
import * as Scalar from "../../src/Scalar.js"

export class Options extends Data.Class<{
  readonly scalar?: Scalar.Settings
  readonly precision?: Precision.Policy
  readonly backend?: Policy.BackendPolicy["policy"]
  readonly autodiff?: Autodiff.Settings
}> {}

const defaults = new Options({})

export const layer = (options: Options = defaults) =>
  Layer.mergeAll(
    Computation.layerPlanner,
    Layer.succeed(
      Scalar.Scalar,
      Option.getOrElse(Option.fromNullishOr(options.scalar), () => Scalar.defaultSettings)
    ),
    Layer.succeed(
      Precision.Precision,
      Option.getOrElse(Option.fromNullishOr(options.precision), () => Precision.defaultPolicy)
    ),
    Layer.succeed(Policy.Backend, {
      policy: Option.getOrElse(
        Option.fromNullishOr(options.backend),
        () => Schema.decodeSync(Policy.BackendPolicy.fields.policy)("scalar")
      )
    }),
    Layer.succeed(
      Autodiff.Autodiff,
      Option.getOrElse(Option.fromNullishOr(options.autodiff), () => Autodiff.defaultSettings)
    )
  )
