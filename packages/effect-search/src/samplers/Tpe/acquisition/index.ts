import { Match, Option } from "effect"

import { sumLogDensities } from "../../../internal/tpe/expectedImprovement.js"
import { eiAcquisition } from "./ei.js"
import {
  type AcquisitionContext,
  type AcquisitionImplementation,
  type AcquisitionOption,
  type BuiltInAcquisitionName,
  isAcquisitionImplementation,
  isBuiltInAcquisitionName
} from "./model.js"
import { piAcquisition } from "./pi.js"
import { thompsonAcquisition } from "./thompson.js"

export {
  type AcquisitionContext,
  type AcquisitionImplementation,
  type AcquisitionOption,
  type BuiltInAcquisitionName,
  BuiltInAcquisitionNameSchema
} from "./model.js"

export const defaultAcquisitionName: BuiltInAcquisitionName = "ei"

export const builtinAcquisitionRegistry: Record<
  BuiltInAcquisitionName,
  AcquisitionImplementation
> = {
  ei: eiAcquisition,
  pi: piAcquisition,
  thompson: thompsonAcquisition
}

const defaultAcquisition = builtinAcquisitionRegistry[defaultAcquisitionName]

const builtinAcquisition = (
  name: BuiltInAcquisitionName
): AcquisitionImplementation => builtinAcquisitionRegistry[name]

export const resolveAcquisition = (
  acquisition?: AcquisitionOption
): AcquisitionImplementation =>
  Option.fromNullable(acquisition).pipe(
    Option.match({
      onNone: () => defaultAcquisition,
      onSome: (candidate) =>
        Match.value(candidate).pipe(
          Match.when(isBuiltInAcquisitionName, builtinAcquisition),
          Match.when(isAcquisitionImplementation, (customAcquisition) => customAcquisition),
          Match.orElse(() => defaultAcquisition)
        )
    })
  )

export const scoreAcquisition = (
  context: AcquisitionContext,
  acquisition?: AcquisitionOption
): number => resolveAcquisition(acquisition).score(context)

export const scoreJointAcquisition = (
  logLContributions: ReadonlyArray<number>,
  logGContributions: ReadonlyArray<number>,
  estimatedCost: Option.Option<number>,
  roll: Option.Option<number>,
  acquisition?: AcquisitionOption
): number =>
  scoreAcquisition({
    logL: sumLogDensities(logLContributions),
    logG: sumLogDensities(logGContributions),
    estimatedCost,
    roll
  }, acquisition)
