/**
 * Defines training and log-scaled learning-rate fixtures.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

import * as SearchSpace from "../../SearchSpace/index.js"

/**
 * Lists the optimizer literals used by the training schema and search space.
 *
 * @since 0.1.0
 * @category models
 */
export const RandomTrainingOptimizerChoices: ["adam", "sgd", "adamw"] = ["adam", "sgd", "adamw"]

/**
 * Decodes the field shapes used by the random-training fixture.
 *
 * @remarks
 * Learning-rate and batch-size sampling ranges are not validation refinements.
 *
 * @since 0.1.0
 * @category schemas
 */
export const RandomTrainingConfigSchema = Schema.Struct({
  /** Learning rate; standalone decoding does not enforce the sampling range. */
  lr: Schema.Number,
  /** Optimizer selected from {@link RandomTrainingOptimizerChoices}. */
  optimizer: Schema.Literal(...RandomTrainingOptimizerChoices),
  /** Integer batch size; standalone decoding does not enforce range or step alignment. */
  batchSize: Schema.Int,
  /** Whether the evaluated training configuration uses batch normalization. */
  useBatchNorm: Schema.Boolean
})

/**
 * Carries training parameters decoded independently of their sampling ranges.
 *
 * @since 0.1.0
 * @category type-level
 */
export type RandomTrainingConfig = Schema.Schema.Type<typeof RandomTrainingConfigSchema>

/**
 * Decodes an unknown training configuration and throws on a schema violation.
 *
 * @since 0.1.0
 * @category utils
 */
export const decodeRandomTrainingConfig = Schema.decodeUnknownSync(RandomTrainingConfigSchema)

/**
 * Builds a training space with configurable learning-rate and batch-size bounds.
 *
 * @remarks
 * Learning rate is sampled linearly from `minLearningRate` through `0.1`.
 * Batch size is sampled from `16` through `maxBatchSize` in steps of `16`.
 * Invalid bounds defect because this fixture uses `SearchSpace.unsafeMake`:
 * `maxBatchSize` must be a finite integer at least `16`, and `minLearningRate`
 * must be finite and no greater than `0.1`.
 *
 * @param maxBatchSize - Inclusive upper bound for the batch-size dimension.
 * @param minLearningRate - Inclusive lower bound for the learning-rate dimension.
 *
 * @since 0.1.0
 * @category constructors
 */
export const makeRandomTrainingSpace = (maxBatchSize = 128, minLearningRate = 1e-4) =>
  SearchSpace.unsafeMake({
    lr: SearchSpace.float(minLearningRate, 1e-1),
    optimizer: SearchSpace.categorical(RandomTrainingOptimizerChoices),
    batchSize: SearchSpace.int(16, maxBatchSize, { step: 16 }),
    useBatchNorm: SearchSpace.boolean()
  })

/**
 * Decodes a numeric learning rate without enforcing the fixture's sampling range.
 *
 * @since 0.1.0
 * @category schemas
 */
export const LogLearningRateConfigSchema = Schema.Struct({
  /** Learning rate; standalone decoding does not enforce the sampling range. */
  lr: Schema.Number
})

/**
 * Carries a learning rate decoded independently of its logarithmic sampling range.
 *
 * @since 0.1.0
 * @category type-level
 */
export type LogLearningRateConfig = Schema.Schema.Type<typeof LogLearningRateConfigSchema>

/**
 * Decodes an unknown learning-rate configuration and throws on a schema violation.
 *
 * @since 0.1.0
 * @category utils
 */
export const decodeLogLearningRateConfig = Schema.decodeUnknownSync(LogLearningRateConfigSchema)

/**
 * Builds a log-scaled learning-rate space from `0.0001` through `0.1`.
 *
 * @since 0.1.0
 * @category constructors
 */
export const makeLogLearningRateSpace = () =>
  SearchSpace.unsafeMake({
    lr: SearchSpace.float(1e-4, 1e-1, { scale: "log" })
  })
