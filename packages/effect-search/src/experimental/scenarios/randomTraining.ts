/**
 * Random training scenario with optimizer, learning rate, and batch size hyperparameters.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

import * as SearchSpace from "../../SearchSpace/index.js"

/**
 * Optimizer values accepted by the training scenario.
 *
 * @since 0.1.0
 * @category models
 */
export const RandomTrainingOptimizerChoices: ["adam", "sgd", "adamw"] = ["adam", "sgd", "adamw"]

/**
 * Schema for learning rate, optimizer, batch size, and batch-normalization configurations.
 *
 * @since 0.1.0
 * @category schemas
 */
export const RandomTrainingConfigSchema = Schema.Struct({
  lr: Schema.Number,
  optimizer: Schema.Literal(...RandomTrainingOptimizerChoices),
  batchSize: Schema.Number,
  useBatchNorm: Schema.Boolean
})

/**
 * Decoded configuration for {@link RandomTrainingConfigSchema}.
 *
 * @since 0.1.0
 * @category type-level
 */
export type RandomTrainingConfig = Schema.Schema.Type<typeof RandomTrainingConfigSchema>

/**
 * Decodes an unknown training configuration or throws a parse error.
 *
 * @since 0.1.0
 * @category utils
 */
export const decodeRandomTrainingConfig = Schema.decodeUnknownSync(RandomTrainingConfigSchema)

/**
 * Constructs a training space with learning rate from `minLearningRate` to
 * `0.1`, the declared optimizers, batch sizes from `16` through
 * `maxBatchSize` in steps of `16`, and a batch-normalization flag.
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
 * Schema for a configuration containing one numeric learning rate.
 *
 * @since 0.1.0
 * @category schemas
 */
export const LogLearningRateConfigSchema = Schema.Struct({
  lr: Schema.Number
})

/**
 * Decoded configuration for {@link LogLearningRateConfigSchema}.
 *
 * @since 0.1.0
 * @category type-level
 */
export type LogLearningRateConfig = Schema.Schema.Type<typeof LogLearningRateConfigSchema>

/**
 * Decodes an unknown learning-rate configuration or throws a parse error.
 *
 * @since 0.1.0
 * @category utils
 */
export const decodeLogLearningRateConfig = Schema.decodeUnknownSync(LogLearningRateConfigSchema)

/**
 * Constructs a log-scaled learning-rate space over `[0.0001, 0.1]`.
 *
 * @since 0.1.0
 * @category constructors
 */
export const makeLogLearningRateSpace = () =>
  SearchSpace.unsafeMake({
    lr: SearchSpace.float(1e-4, 1e-1, { scale: "log" })
  })
