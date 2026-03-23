/**
 * Random training scenario with optimizer, learning rate, and batch size hyperparameters.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

import * as SearchSpace from "../../SearchSpace/index.js"

/**
 * @since 0.1.0
 * @category models
 */
export const RandomTrainingOptimizerChoices: ["adam", "sgd", "adamw"] = ["adam", "sgd", "adamw"]

/**
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
 * @since 0.1.0
 * @category type-level
 */
export type RandomTrainingConfig = Schema.Schema.Type<typeof RandomTrainingConfigSchema>

/** @since 0.1.0 @category utils */
export const decodeRandomTrainingConfig = Schema.decodeUnknownSync(RandomTrainingConfigSchema)

/**
 * Constructs a search space with learning rate, optimizer, batch size, and batch-norm hyperparameters.
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

/** @since 0.1.0 @category schemas */
export const LogLearningRateConfigSchema = Schema.Struct({
  lr: Schema.Number
})

/**
 * @since 0.1.0
 * @category type-level
 */
export type LogLearningRateConfig = Schema.Schema.Type<typeof LogLearningRateConfigSchema>

/** @since 0.1.0 @category utils */
export const decodeLogLearningRateConfig = Schema.decodeUnknownSync(LogLearningRateConfigSchema)

/**
 * Constructs a minimal log-scaled learning rate search space for single-dimension optimization benchmarks.
 *
 * @since 0.1.0
 * @category constructors
 */
export const makeLogLearningRateSpace = () =>
  SearchSpace.unsafeMake({
    lr: SearchSpace.float(1e-4, 1e-1, { scale: "log" })
  })
