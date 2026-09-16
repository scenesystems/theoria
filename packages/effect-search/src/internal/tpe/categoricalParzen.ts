import {
  Array as Arr,
  Boolean as Bool,
  Effect,
  Either,
  Equal,
  Match,
  Number as Num,
  Option,
  Predicate,
  Schema,
  Tuple
} from "effect"

import { Choice } from "../../Distribution.js"
import { InvalidSamplerConfig } from "../../SearchError.js"
import * as Float64 from "../float64.js"
import { defaultWeights } from "./recencyWeights.js"

export const CategoricalKernelSchema = Schema.Struct({
  probabilities: Schema.Array(Schema.Number)
})

export type CategoricalKernel = Schema.Schema.Type<typeof CategoricalKernelSchema>

const CategoricalDistanceEvaluatorSchema = Schema.declare(
  Predicate.isFunction,
  { identifier: "effect-search/CategoricalDistanceEvaluator" }
)

export class CategoricalDistanceFunction extends Schema.Class<CategoricalDistanceFunction>(
  "effect-search/CategoricalDistanceFunction"
)({
  evaluate: CategoricalDistanceEvaluatorSchema
}) {}

export class CategoricalParzenOptions
  extends Schema.Class<CategoricalParzenOptions>("effect-search/CategoricalParzenOptions")({
    priorWeight: Schema.optional(Schema.Number),
    distance: Schema.optional(CategoricalDistanceFunction)
  })
{}

const CategoricalParzenInputOptionsSchema = Schema.Struct({
  priorWeight: Schema.optional(Schema.Number),
  distance: Schema.optional(Schema.Union(CategoricalDistanceFunction, CategoricalDistanceEvaluatorSchema))
})

type CategoricalParzenInputOptions = Schema.Schema.Type<typeof CategoricalParzenInputOptionsSchema>

export const CategoricalParzenSchema = Schema.Struct({
  choices: Schema.Array(Choice),
  kernelWeights: Schema.Array(Schema.Number),
  probabilities: Schema.Array(Schema.Number),
  kernels: Schema.Array(CategoricalKernelSchema)
})

export type CategoricalParzen = Schema.Schema.Type<typeof CategoricalParzenSchema>

const sum = (valuesInput: Iterable<number>): number => {
  const values = Arr.fromIterable(valuesInput)
  return Arr.reduce(values, 0, (total, value) => Num.sum(total, value))
}

const valueAt = <A>(valuesInput: Iterable<A>, index: number, fallback: A): A => {
  const values = Arr.fromIterable(valuesInput)
  return Arr.get(values, index).pipe(
    Option.getOrElse(() => fallback)
  )
}

const probabilityAt = (kernel: CategoricalKernel, index: number): number => valueAt(kernel.probabilities, index, 0)

const weightAt = (weightsInput: Iterable<number>, index: number): number => {
  const weights = Arr.fromIterable(weightsInput)
  return valueAt(weights, index, 0)
}

const asFiniteDistance = (value: number): number =>
  Match.value(Number.isFinite(value)).pipe(
    Match.when(true, () => Num.max(value, 0)),
    Match.orElse(() => 0)
  )

const normalize = (weightsInput: Iterable<number>) => {
  const weights = Arr.fromIterable(weightsInput)

  const total = sum(weights)

  return Match.value(Num.lessThanOrEqualTo(total, 0)).pipe(
    Match.when(true, () => Arr.empty<number>()),
    Match.orElse(() => Arr.map(weights, (weight) => Num.unsafeDivide(weight, total)))
  )
}

const uniform = (count: number) =>
  Match.value(Num.lessThanOrEqualTo(count, 0)).pipe(
    Match.when(true, () => Arr.empty<number>()),
    Match.orElse(() => Arr.makeBy(count, () => Num.unsafeDivide(1, count)))
  )

const priorKernel = (choiceCount: number): CategoricalKernel => ({
  probabilities: uniform(choiceCount)
})

const normalizeDistance = (
  distance: Option.Option<NonNullable<CategoricalParzenInputOptions["distance"]>>
): Option.Option<CategoricalDistanceFunction> =>
  distance.pipe(
    Option.map((resolvedDistance) =>
      Match.value(resolvedDistance).pipe(
        Match.when(
          Predicate.isFunction,
          (evaluate) => new CategoricalDistanceFunction({ evaluate })
        ),
        Match.orElse(({ evaluate }) => new CategoricalDistanceFunction({ evaluate }))
      )
    )
  )

const invalidCategoricalParzenOptions = (): InvalidSamplerConfig =>
  new InvalidSamplerConfig({
    reason: "categorical parzen options failed schema decode",
    sampler: "tpe"
  })

const normalizedOptions = (
  options: CategoricalParzenOptions | {
    readonly priorWeight?: number
    readonly distance?: (observed: Choice, candidate: Choice) => number
  }
): Effect.Effect<
  readonly [Option.Option<number>, Option.Option<CategoricalDistanceFunction>],
  InvalidSamplerConfig
> =>
  Match.value(Schema.decodeUnknownEither(CategoricalParzenInputOptionsSchema)(options)).pipe(
    Match.when(
      Either.isRight,
      ({ right }) =>
        Effect.succeed(Tuple.make(
          Option.fromNullable(right.priorWeight),
          normalizeDistance(Option.fromNullable(right.distance))
        ))
    ),
    Match.orElse(() => Effect.fail(invalidCategoricalParzenOptions()))
  )

const distanceKernelRaw = (
  choicesInput: Iterable<Choice>,
  observed: Choice,
  nKernels: number,
  priorWeight: number,
  distance: CategoricalDistanceFunction
) => {
  const choices = Arr.fromIterable(choicesInput)

  const distances = Arr.map(choices, (choice) => asFiniteDistance(distance.evaluate(observed, choice)))
  const maxDistance = Arr.reduce(distances, 0, (currentMax, value) => Num.max(currentMax, value))
  const normalizedDistances = Match.value(Num.lessThanOrEqualTo(maxDistance, 0)).pipe(
    Match.when(true, () => Arr.map(distances, () => 0)),
    Match.orElse(() => Arr.map(distances, (value) => Num.unsafeDivide(value, maxDistance)))
  )
  const coefficient = Num.multiply(
    Float64.log(Num.unsafeDivide(nKernels, priorWeight)),
    Num.unsafeDivide(Float64.log(choices.length), Float64.log(6))
  )

  return Arr.map(normalizedDistances, (distanceValue) =>
    Float64.exp(
      Num.multiply(
        Num.multiply(distanceValue, distanceValue),
        Num.multiply(coefficient, -1)
      )
    ))
}

const observationKernel = (
  choicesInput: Iterable<Choice>,
  observed: Choice,
  nKernels: number,
  priorWeight: number,
  distance: Option.Option<CategoricalDistanceFunction>
): CategoricalKernel => {
  const choices = Arr.fromIterable(choicesInput)

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
  kernelsInput: Iterable<CategoricalKernel>,
  kernelWeightsInput: Iterable<number>,
  choiceCount: number
) => {
  const kernels = Arr.fromIterable(kernelsInput)
  const kernelWeights = Arr.fromIterable(kernelWeightsInput)
  return Match.value(Bool.or(Num.lessThanOrEqualTo(kernels.length, 0), Num.lessThanOrEqualTo(choiceCount, 0))).pipe(
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
}

export const buildCategoricalParzen = (
  choicesInput: Iterable<Choice>,
  observationsInput: Iterable<Choice>,
  options: CategoricalParzenOptions | {
    readonly priorWeight?: number
    readonly distance?: (observed: Choice, candidate: Choice) => number
  } = {}
): Effect.Effect<CategoricalParzen, InvalidSamplerConfig> => {
  const choices = Arr.fromIterable(choicesInput)
  const observations = Arr.fromIterable(observationsInput)
  return Match.value(Num.lessThanOrEqualTo(choices.length, 0)).pipe(
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
          const nKernels = Num.increment(observations.length)
          const kernels = Arr.append(
            Arr.map(observations, (observation) =>
              observationKernel(
                choices,
                observation,
                nKernels,
                priorWeight,
                resolvedDistance
              )),
            priorKernel(choices.length)
          )
          const kernelWeights = normalize(Arr.append(defaultWeights(observations.length), priorWeight))

          return {
            choices,
            kernelWeights,
            probabilities: weightedKernelProbabilities(kernels, kernelWeights, choices.length),
            kernels
          }
        })
      )
    )
  )
}
