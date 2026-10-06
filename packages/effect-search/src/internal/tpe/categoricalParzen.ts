import {
  Array as Arr,
  Boolean as Bool,
  Chunk,
  Effect,
  Equal,
  Match,
  Number as Num,
  Option,
  Predicate,
  Result,
  Schema,
  Tuple
} from "effect"

import { isFinite, logStrict, sumPairwise } from "@scenesystems/effect-math/Numeric"
import { Choice } from "../../Distribution.js"
import { InvalidSamplerConfig } from "../../SearchError.js"
import { exp } from "../exponential.js"
import { defaultWeights } from "./recencyWeights.js"

export const CategoricalKernelSchema = Schema.Struct({
  probabilities: Schema.Array(Schema.Finite)
})

export type CategoricalKernel = Schema.Schema.Type<typeof CategoricalKernelSchema>

const isCategoricalDistanceEvaluator = (
  input: unknown
): input is (observed: Choice, candidate: Choice) => number => Predicate.isFunction(input)

const CategoricalDistanceEvaluatorSchema = Schema.declare(
  isCategoricalDistanceEvaluator,
  { identifier: "@scenesystems/effect-search/internal/tpe/categoricalParzen/CategoricalDistanceEvaluator" }
)

export class CategoricalDistanceFunction extends Schema.Class<CategoricalDistanceFunction>(
  "@scenesystems/effect-search/internal/tpe/categoricalParzen/CategoricalDistanceFunction"
)({
  evaluate: CategoricalDistanceEvaluatorSchema
}) {}

export class CategoricalParzenOptions extends Schema.Class<CategoricalParzenOptions>(
  "@scenesystems/effect-search/internal/tpe/categoricalParzen/CategoricalParzenOptions"
)({
  priorWeight: Schema.optional(Schema.Finite),
  distance: Schema.optional(CategoricalDistanceFunction)
}) {}

const CategoricalParzenInputOptionsSchema = Schema.Struct({
  priorWeight: Schema.optional(Schema.Finite),
  distance: Schema.optional(Schema.Union([CategoricalDistanceFunction, CategoricalDistanceEvaluatorSchema]))
})

type CategoricalParzenInputOptions = Schema.Schema.Type<typeof CategoricalParzenInputOptionsSchema>

export const CategoricalParzenSchema = Schema.Struct({
  choices: Schema.Array(Choice),
  kernelWeights: Schema.Array(Schema.Finite),
  probabilities: Schema.Array(Schema.Finite),
  kernels: Schema.Array(CategoricalKernelSchema)
})

export type CategoricalParzen = Schema.Schema.Type<typeof CategoricalParzenSchema>

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
  Match.value(isFinite(value)).pipe(
    Match.when(true, () => Num.max(value, 0)),
    Match.orElse(() => 0)
  )

const normalize = (weightsInput: Iterable<number>) => {
  const weights = Arr.fromIterable(weightsInput)

  const total = sumPairwise(Chunk.fromIterable(weights))

  return Match.value(Num.isLessThanOrEqualTo(total, 0)).pipe(
    Match.when(true, () => Arr.empty<number>()),
    Match.orElse(() => Arr.map(weights, (weight) => Num.divideUnsafe(weight, total)))
  )
}

const uniform = (count: number) =>
  Match.value(Num.isLessThanOrEqualTo(count, 0)).pipe(
    Match.when(true, () => Arr.empty<number>()),
    Match.orElse(() => Arr.makeBy(count, () => Num.divideUnsafe(1, count)))
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
  Match.value(Schema.decodeResult(CategoricalParzenInputOptionsSchema)(options)).pipe(
    Match.when(
      Result.isSuccess,
      ({ success }) =>
        Effect.succeed(Tuple.make(
          Option.fromNullishOr(success.priorWeight),
          normalizeDistance(Option.fromNullishOr(success.distance))
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
  const normalizedDistances = Match.value(Num.isLessThanOrEqualTo(maxDistance, 0)).pipe(
    Match.when(true, () => Arr.map(distances, () => 0)),
    Match.orElse(() => Arr.map(distances, (value) => Num.divideUnsafe(value, maxDistance)))
  )
  const coefficient = Num.multiply(
    logStrict(Num.divideUnsafe(nKernels, priorWeight)),
    Num.divideUnsafe(logStrict(Arr.length(choices)), logStrict(6))
  )

  return Arr.map(normalizedDistances, (distanceValue) =>
    exp(
      Num.multiply(
        Num.multiply(distanceValue, distanceValue),
        Num.multiply(-1, coefficient)
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

  const smoothing = Num.divideUnsafe(priorWeight, nKernels)
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
  return Match.value(Bool.or(Num.isLessThanOrEqualTo(Arr.length(kernels), 0), Num.isLessThanOrEqualTo(choiceCount, 0)))
    .pipe(
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
  return Match.value(Num.isLessThanOrEqualTo(Arr.length(choices), 0)).pipe(
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
}
