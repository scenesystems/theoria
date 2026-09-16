import { Array as Arr, Boolean, Data, Effect, Equal, Match, Number as Num, Option, Schema, Tuple } from "effect"

import { type PrimitiveChoice, PrimitiveChoiceSchema } from "../../contracts/Distribution.js"
import { InvalidSamplerConfig } from "../../Errors/index.js"
import * as Float64 from "../float64.js"
import { defaultWeights } from "./recencyWeights.js"

export const CategoricalKernelSchema = Schema.Struct({
  probabilities: Schema.Array(Schema.Number)
})

export type CategoricalKernel = Schema.Schema.Type<typeof CategoricalKernelSchema>

type CategoricalDistance = (left: PrimitiveChoice, right: PrimitiveChoice) => number

export class CategoricalParzenOptions extends Data.Class<{
  readonly priorWeight?: number
  readonly distance?: CategoricalDistance
}> {}

const PriorOptions = Schema.Struct({ priorWeight: Schema.optional(Schema.Number) })

export const CategoricalParzenSchema = Schema.Struct({
  choices: Schema.Array(PrimitiveChoiceSchema),
  kernelWeights: Schema.Array(Schema.Number),
  probabilities: Schema.Array(Schema.Number),
  kernels: Schema.Array(CategoricalKernelSchema)
})

export type CategoricalParzen = Schema.Schema.Type<typeof CategoricalParzenSchema>

type ProbabilityValues = CategoricalKernel["probabilities"]
type CategoricalKernels = CategoricalParzen["kernels"]
type PrimitiveChoices = CategoricalParzen["choices"]

const finiteNumberGuard = Schema.is(Schema.Finite)

const sum = (values: ProbabilityValues): number => Arr.reduce(values, 0, (total, value) => Num.sum(total, value))

const probabilityAt = (kernel: CategoricalKernel, index: number): number =>
  Arr.get(kernel.probabilities, index).pipe(Option.getOrElse(() => 0))

const weightAt = (weights: ProbabilityValues, index: number): number =>
  Arr.get(weights, index).pipe(Option.getOrElse(() => 0))

const asFiniteDistance = (value: number): number =>
  Match.value(finiteNumberGuard(value)).pipe(
    Match.when(true, () => Num.max(value, 0)),
    Match.orElse(() => 0)
  )

const normalize = (weights: ProbabilityValues): ProbabilityValues => {
  const total = sum(weights)

  return Match.value(Num.lessThanOrEqualTo(total, 0)).pipe(
    Match.when(true, () => Arr.empty<number>()),
    Match.orElse(() => Arr.map(weights, (weight) => Num.unsafeDivide(weight, total)))
  )
}

const uniform = (count: number): ProbabilityValues =>
  Match.value(Num.lessThanOrEqualTo(count, 0)).pipe(
    Match.when(true, () => Arr.empty<number>()),
    Match.orElse(() => Arr.makeBy(count, () => Num.unsafeDivide(1, count)))
  )

const priorKernel = (choiceCount: number): CategoricalKernel => ({
  probabilities: uniform(choiceCount)
})

const invalidCategoricalParzenOptions = (): InvalidSamplerConfig =>
  new InvalidSamplerConfig({
    reason: "categorical parzen options failed schema decode",
    sampler: "tpe"
  })

const normalizedOptions = (
  options: CategoricalParzenOptions
) =>
  Schema.decodeUnknown(PriorOptions)(options).pipe(
    Effect.mapError(invalidCategoricalParzenOptions),
    Effect.map(({ priorWeight }) => Tuple.make(Option.fromNullable(priorWeight), Option.fromNullable(options.distance)))
  )

const distanceKernelRaw = (
  choices: PrimitiveChoices,
  observed: PrimitiveChoice,
  nKernels: number,
  priorWeight: number,
  distance: CategoricalDistance
): ProbabilityValues => {
  const distances = Arr.map(choices, (choice) => asFiniteDistance(distance(observed, choice)))
  const maxDistance = Arr.reduce(distances, 0, (currentMax, value) => Num.max(currentMax, value))
  const normalizedDistances = Match.value(Num.lessThanOrEqualTo(maxDistance, 0)).pipe(
    Match.when(true, () => Arr.map(distances, () => 0)),
    Match.orElse(() => Arr.map(distances, (value) => Num.unsafeDivide(value, maxDistance)))
  )
  const coefficient = Num.multiply(
    Float64.log(Num.unsafeDivide(nKernels, priorWeight)),
    Num.unsafeDivide(Float64.log(Arr.length(choices)), Float64.log(6))
  )

  return Arr.map(normalizedDistances, (distanceValue) =>
    Float64.exp(
      Num.multiply(
        Num.multiply(distanceValue, distanceValue),
        Num.negate(coefficient)
      )
    ))
}

const observationKernel = (
  choices: PrimitiveChoices,
  observed: PrimitiveChoice,
  nKernels: number,
  priorWeight: number,
  distance: Option.Option<CategoricalDistance>
): CategoricalKernel => {
  const smoothing = Num.unsafeDivide(priorWeight, nKernels)
  const raw = distance.pipe(
    Option.match({
      onNone: () =>
        Arr.map(choices, (choice) =>
          Match.value(Equal.equals(choice, observed)).pipe(
            Match.when(true, () => Num.sum(1, smoothing)),
            Match.orElse(() => smoothing)
          )),
      onSome: (distanceFunction) => distanceKernelRaw(choices, observed, nKernels, priorWeight, distanceFunction)
    })
  )

  return {
    probabilities: normalize(raw)
  }
}

const weightedKernelProbabilities = (
  kernels: CategoricalKernels,
  kernelWeights: ProbabilityValues,
  choiceCount: number
): ProbabilityValues =>
  Match.value(Boolean.or(Arr.isEmptyReadonlyArray(kernels), Num.lessThanOrEqualTo(choiceCount, 0))).pipe(
    Match.when(true, () => Arr.empty<number>()),
    Match.orElse(() =>
      Arr.makeBy(choiceCount, (index) =>
        Arr.reduce(
          kernels,
          0,
          (total, kernel, kernelIndex) =>
            Num.sum(total, Num.multiply(probabilityAt(kernel, index), weightAt(kernelWeights, kernelIndex)))
        ))
    )
  )

export const buildCategoricalParzen = (
  choices: PrimitiveChoices,
  observations: PrimitiveChoices,
  options: CategoricalParzenOptions = new CategoricalParzenOptions({})
): Effect.Effect<CategoricalParzen, InvalidSamplerConfig> =>
  Match.value(Arr.isEmptyReadonlyArray(choices)).pipe(
    Match.when(true, () =>
      Effect.succeed({
        choices,
        kernelWeights: Arr.empty<number>(),
        probabilities: Arr.empty<number>(),
        kernels: Arr.empty<CategoricalKernel>()
      })),
    Match.orElse(() =>
      normalizedOptions(options).pipe(
        Effect.map(([resolvedPriorWeight, resolvedDistance]) => {
          const priorWeight = Option.getOrElse(resolvedPriorWeight, () => 1)
          const nKernels = Num.increment(Arr.length(observations))
          const kernels = Arr.append(
            Arr.map(observations, (observation) =>
              observationKernel(
                choices,
                observation,
                nKernels,
                priorWeight,
                resolvedDistance
              )),
            priorKernel(Arr.length(choices))
          )
          const kernelWeights = normalize(Arr.append(defaultWeights(Arr.length(observations)), priorWeight))

          return {
            choices,
            kernelWeights,
            probabilities: weightedKernelProbabilities(kernels, kernelWeights, Arr.length(choices)),
            kernels
          }
        })
      )
    )
  )
