/** Common-ancestor crossover and balanced validation sampling. @internal */
import type * as PseudoRandom from "@scenesystems/effect-math/PseudoRandom"
import { Array as Arr, Boolean, Chunk, Data, Effect, Equivalence, Match, Number as Num, Option, Tuple } from "effect"
import { GEPAError } from "../../DspError.js"
import { ProgramCandidate, type State } from "../../GEPA.js"

/** A concrete proposal has consumed all pair, ancestor and instruction draws. @internal */
export class MergeProposal extends Data.Class<{
  readonly candidate: ProgramCandidate
  readonly parents: readonly [number, number]
  readonly ancestor: number
  readonly description: ReadonlyArray<number>
}> {}

const at = <A>(values: ReadonlyArray<A>, index: number): A => Option.getOrThrow(Arr.get(values, index))
const ancestors = (candidates: ReadonlyArray<ProgramCandidate>, index: number): ReadonlyArray<number> =>
  Arr.dedupe(Arr.flatMap(at(candidates, index).parentIds, (id) => {
    const parent = Option.getOrThrow(Arr.findFirstIndex(candidates, (candidate) => candidate.candidateId === id))
    return Arr.prepend(ancestors(candidates, parent), parent)
  }))

/** One pair draw, then a score-weighted ancestor draw only when an eligible ancestor exists. */
const drawTriplet = (
  candidates: ReadonlyArray<ProgramCandidate>,
  scores: ReadonlyArray<number>,
  eligible: ReadonlyArray<number>,
  triplets: State["mergeTriplets"],
  rng: PseudoRandom.CPython
) =>
  Effect.gen(function*() {
    const pair = Arr.sort(yield* rng.sample(Chunk.fromIterable(eligible), 2), Num.Order)
    const i = at(pair, 0), j = at(pair, 1)
    const ai = ancestors(candidates, i), aj = ancestors(candidates, j)
    const common = Boolean.match(Arr.contains(ai, j) || Arr.contains(aj, i), {
      onTrue: () => Arr.empty<number>(),
      onFalse: () =>
        Arr.filter(Arr.sort(Arr.intersection(ai, aj), Num.Order), (ancestor) =>
          !Arr.some(triplets, (entry) =>
            Equivalence.Array(Num.Equivalence)(entry, [i, j, ancestor])) &&
          at(scores, ancestor) <= at(scores, i) && at(scores, ancestor) <= at(scores, j) &&
          Arr.some(at(candidates, ancestor).predictorInstructions, (entry, k) => {
            const left = at(at(candidates, i).predictorInstructions, k).instruction
            const right = at(at(candidates, j).predictorInstructions, k).instruction
            return left !== right && (entry.instruction === left || entry.instruction === right)
          }))
    })
    return yield* Boolean.match(common.length === 0, {
      onTrue: () =>
        Effect.succeed(Option.none<readonly [number, number, number]>()),
      onFalse: () =>
        Effect.gen(function*() {
          // Weights are builtin-sum aggregates; random.choices accumulates them with
          // itertools.accumulate, plain left-to-right addition, so this scan stays uncompensated.
          const cumulative = Arr.drop(
            Arr.scan(common, 0, (total, ancestor) => total + at(scores, ancestor)),
            1
          )
          const total = at(cumulative, cumulative.length - 1)
          yield* Effect.failSync(() =>
            new GEPAError({
              reason: "invalid-state",
              message: "Common-ancestor weights must have a positive total"
            })
          ).pipe(Effect.when(Effect.succeed(total <= 0)))
          const draw = (yield* rng.random()) * total
          const index = Option.getOrElse(
            Arr.findFirstIndex(cumulative, (value) => value > draw),
            () => common.length - 1
          )
          return Option.some<readonly [number, number, number]>(Tuple.make(i, j, at(common, index)))
        })
    })
  })

/** Per-predictor source; only a both-changed tie with equal aggregates consumes a choice draw. */
const describeMerge = (
  candidates: ReadonlyArray<ProgramCandidate>,
  scores: ReadonlyArray<number>,
  [i, j, ancestor]: readonly [number, number, number],
  rng: PseudoRandom.CPython
) =>
  // Stable module order replaces Python's process-dependent string-set order.
  Effect.forEach(at(candidates, ancestor).predictorInstructions, (entry, k) =>
    Effect.gen(function*() {
      const left = at(at(candidates, i).predictorInstructions, k).instruction
      const right = at(at(candidates, j).predictorInstructions, k).instruction
      return yield* Match.value(entry.instruction).pipe(
        Match.when(
          (instruction) => left !== right && (instruction === left || instruction === right),
          (instruction) => Effect.succeed(Boolean.match(instruction === left, { onFalse: () => i, onTrue: () => j }))
        ),
        Match.when(
          (instruction) => instruction !== left && instruction !== right,
          () =>
            Match.value(Tuple.make(at(scores, i), at(scores, j))).pipe(
              Match.when(([scoreI, scoreJ]) => scoreI > scoreJ, () => Effect.succeed(i)),
              Match.when(([scoreI, scoreJ]) => scoreJ > scoreI, () => Effect.succeed(j)),
              Match.orElse(() => rng.choice(Chunk.make(i, j)))
            )
        ),
        Match.orElse(() => Effect.succeed(i))
      )
    }))

/** One proposal attempt: up to ten triplet draws, then a description unless every draw failed. */
const attemptMerge = (
  candidates: ReadonlyArray<ProgramCandidate>,
  scores: ReadonlyArray<number>,
  eligible: ReadonlyArray<number>,
  triplets: State["mergeTriplets"],
  descriptions: State["mergeDescriptions"],
  hasSupport: boolean,
  rng: PseudoRandom.CPython
) =>
  Effect.gen(function*() {
    const triplet = yield* Effect.reduce(Arr.range(1, 10), () =>
      Option.none<readonly [number, number, number]>(), (selected) =>
      Option.match(selected, {
        onSome: () =>
          Effect.succeed(selected),
        onNone: () => drawTriplet(candidates, scores, eligible, triplets, rng)
      }))
    return yield* Option.match(triplet, {
      onNone: () =>
        Effect.succeed(Option.none<MergeProposal>()),
      onSome: ([i, j, ancestor]) =>
        Effect.gen(function*() {
          const description = yield* describeMerge(candidates, scores, [i, j, ancestor], rng)
          return Boolean.match(
            !hasSupport ||
              Arr.some(
                descriptions,
                ([a, b, sources]) => a === i && b === j && Equivalence.Array(Num.Equivalence)(sources, description)
              ),
            {
              onTrue: () => Option.none<MergeProposal>(),
              onFalse: () =>
                Option.some(
                  new MergeProposal({
                    candidate: new ProgramCandidate({
                      candidateId: `candidate-${candidates.length}`,
                      parentIds: [at(candidates, i).candidateId, at(candidates, j).candidateId],
                      predictorInstructions: Arr.map(
                        description,
                        (source, k) => at(at(candidates, source).predictorInstructions, k)
                      )
                    }),
                    parents: Tuple.make(i, j),
                    ancestor,
                    description
                  })
                )
            }
          )
        })
    })
  })

/** Up to ten pair searches inside ten proposal attempts, on one shared stream. @internal */
export const prepareMerge = (
  candidates: ReadonlyArray<ProgramCandidate>,
  scores: ReadonlyArray<number>,
  eligible: ReadonlyArray<number>,
  triplets: State["mergeTriplets"],
  descriptions: State["mergeDescriptions"],
  hasSupport: boolean,
  rng: PseudoRandom.CPython
) =>
  Effect.suspend(() =>
    Boolean.match(eligible.length < 2 || candidates.length < 3, {
      onTrue: () => Effect.succeed(Option.none<MergeProposal>()),
      onFalse: () =>
        Effect.reduce(Arr.range(1, 10), () => Option.none<MergeProposal>(), (proposal) =>
          Option.match(proposal, {
            onSome: () => Effect.succeed(proposal),
            onNone: () => attemptMerge(candidates, scores, eligible, triplets, descriptions, hasSupport, rng)
          }))
    })
  )

/** Two from each A/B/tie bucket until five, then a sample of the unused rows. @internal */
export const selectMergeSubsample = (
  left: ReadonlyArray<number>,
  right: ReadonlyArray<number>,
  rng: PseudoRandom.CPython
) =>
  Effect.gen(function*() {
    const ids = Arr.range(0, left.length - 1)
    const buckets = [
      Arr.filter(ids, (i) => at(left, i) > at(right, i)),
      Arr.filter(ids, (i) => at(right, i) > at(left, i)),
      Arr.filter(ids, (i) => at(left, i) === at(right, i))
    ]
    const selected = yield* Effect.reduce(buckets, Arr.empty<number>, (selected, bucket) =>
      Effect.gen(function*() {
        const take = Num.min(Num.min(bucket.length, 2), 5 - selected.length)
        return yield* Boolean.match(take > 0, {
          onFalse: () => Effect.succeed(selected),
          onTrue: () =>
            rng.sample(Chunk.fromIterable(bucket), take).pipe(
              Effect.map((sample) => Arr.appendAll(selected, sample))
            )
        })
      }))
    return yield* Boolean.match(selected.length === 5, {
      onTrue: () => Effect.succeed(selected),
      onFalse: () =>
        rng.sample(Chunk.fromIterable(Arr.difference(ids, selected)), 5 - selected.length).pipe(
          Effect.map((sample) => Arr.appendAll(selected, sample))
        )
    })
  })
