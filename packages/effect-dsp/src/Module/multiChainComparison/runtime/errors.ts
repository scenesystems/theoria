/**
 * Multi-chain-comparison projection failure helpers.
 *
 * @since 0.2.0
 * @category internal
 * @internal
 */
import { CompositionError } from "../../../Errors/module.js"

/**
 * Noun-owned projection failure construction for `Module.multiChainComparison`.
 *
 * @since 0.2.0
 * @category constructors
 * @internal
 */
export namespace MultiChainComparisonFailure {
  export const projection = (options: {
    readonly message: string
    readonly moduleName: string
  }): CompositionError =>
    CompositionError.make({
      message: options.message,
      moduleName: options.moduleName
    })
}
