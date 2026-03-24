/**
 * TPE sampler public API — Tree-structured Parzen Estimator construction and objective splitting.
 *
 * @since 0.1.0
 */
export {
  /**
   * Construct a TPE sampler from runtime options.
   *
   * @since 0.1.0
   * @category constructors
   */
  make
} from "./sampler.js"

export {
  /**
   * Split completed trials into above/below groups based on objective spec.
   *
   * @since 0.1.0
   * @category experimental
   */
  splitByObjectiveSpec
} from "./split/index.js"
