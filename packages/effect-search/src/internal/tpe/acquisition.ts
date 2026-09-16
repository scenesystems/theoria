/**
 * TPE candidate-scoring adaptation of the public acquisition contract.
 *
 * @since 0.7.0
 */
import { Array as Arr, type Option } from "effect"

import * as Acquisition from "../../Acquisition.js"

export type AcquisitionContext = Acquisition.Context
export type AcquisitionImplementation = Acquisition.Implementation
export type AcquisitionOption = Acquisition.Strategy

export const defaultAcquisitionName = Acquisition.defaultName

export const resolveAcquisition = Acquisition.resolve

export const scoreAcquisition = (
  context: Acquisition.Context,
  acquisition: Acquisition.Strategy = Acquisition.defaultName
): number => Acquisition.score(context, acquisition)

export const scoreJointAcquisition = (
  logLInput: Iterable<number>,
  logGInput: Iterable<number>,
  estimatedCost: Option.Option<number>,
  roll: Option.Option<number>,
  acquisition: Acquisition.Strategy = Acquisition.defaultName
): number => {
  const logL = Arr.fromIterable(logLInput)
  const logG = Arr.fromIterable(logGInput)
  return Acquisition.scoreJoint(logL, logG, estimatedCost, roll, acquisition)
}
