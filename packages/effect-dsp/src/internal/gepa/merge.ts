/** Common-ancestor crossover and balanced validation sampling. @internal */
import type * as PseudoRandom from "@scenesystems/effect-math/PseudoRandom"
import { Array as Arr, Chunk, Effect, Equivalence, Number as Num, Option, Schema, Tuple } from "effect"
import { GEPAError } from "../../DspError.js"
import type { State } from "../../GEPA.js"
import { ProgramCandidate } from "./model.js"

/** A concrete proposal has consumed all pair, ancestor and instruction draws. @internal */
export class MergeProposal
  extends Schema.Class<MergeProposal>("@scenesystems/effect-dsp/internal/gepa/merge/MergeProposal")({
    candidate: ProgramCandidate,
    parents: Schema.Tuple([Schema.Int, Schema.Int]),
    ancestor: Schema.Int,
    description: Schema.Array(Schema.Int)
  })
{}

const at = <A>(values: ReadonlyArray<A>, index: number): A => Option.getOrThrow(Arr.get(values, index))
const ancestors = (candidates: ReadonlyArray<ProgramCandidate>, index: number): ReadonlyArray<number> =>
  Arr.dedupe(Arr.flatMap(at(candidates, index).parentIds, (id) => {
    const parent = Option.getOrThrow(Arr.findFirstIndex(candidates, (candidate) => candidate.candidateId === id))
    return Arr.prepend(ancestors(candidates, parent), parent)
  }))

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
  Effect.gen(function*() {
    if (eligible.length < 2 || candidates.length < 3) return Option.none<MergeProposal>()
    return yield* Effect.reduce(Arr.range(1, 10), () =>
      Option.none<MergeProposal>(), (proposal) =>
      Effect.gen(function*() {
        if (Option.isSome(proposal)) {
          return proposal
        }
        const pair = yield* Effect.reduce(Arr.range(1, 10), () =>
          Option.none<readonly [number, number, number]>(), (selected) =>
          Effect.gen(function*() {
            if (Option.isSome(selected)) {
              return selected
            }
            const pair = Arr.sort(yield* rng.sample(Chunk.fromIterable(eligible), 2), Num.Order)
            const i = at(pair, 0), j = at(pair, 1)
            const ai = ancestors(candidates, i), aj = ancestors(candidates, j)
            const common = Arr.contains(ai, j) || Arr.contains(aj, i) ?
              [] :
              Arr.filter(Arr.sort(Arr.intersection(ai, aj), Num.Order), (ancestor) =>
                !Arr.some(triplets, (entry) =>
                  Equivalence.Array(Num.Equivalence)(entry, [i, j, ancestor])) &&
                at(scores, ancestor) <= at(scores, i) && at(scores, ancestor) <= at(scores, j) &&
                Arr.some(at(candidates, ancestor).predictorInstructions, (entry, k) => {
                  const left = at(at(candidates, i).predictorInstructions, k).instruction
                  const right = at(at(candidates, j).predictorInstructions, k).instruction
                  return left !== right && (entry.instruction === left || entry.instruction === right)
                }))
            if (common.length === 0) {
              return Option.none<readonly [number, number, number]>()
            }
            const cumulative = Arr.drop(
              Arr.scan(common, 0, (total, ancestor) =>
                total + at(scores, ancestor)),
              1
            )
            const total = at(cumulative, cumulative.length - 1)
            if (total <= 0) {
              return yield* new GEPAError({
                reason: "invalid-state",
                message: "Common-ancestor weights must have a positive total"
              })
            }
            const draw = (yield* rng.random()) * total
            const index = Option.getOrElse(
              Arr.findFirstIndex(cumulative, (value) =>
                value > draw),
              () => common.length - 1
            )
            return Option.some(Tuple.make(i, j, at(common, index)))
          }))
        if (Option.isNone(pair)) {
          return Option.none<MergeProposal>()
        }
        const [i, j, ancestor] = pair.value
        // Stable module order replaces Python's process-dependent string-set order.
        const description = yield* Effect.forEach(at(candidates, ancestor).predictorInstructions, (entry, k) =>
          Effect.gen(function*() {
            const left = at(at(candidates, i).predictorInstructions, k).instruction
            const right = at(at(candidates, j).predictorInstructions, k).instruction
            if (
              left !== right && (entry.instruction === left || entry.instruction === right)
            ) {
              return entry.instruction === left ? j : i
            }
            if (entry.instruction !== left && entry.instruction !== right) {
              return at(scores, i) > at(scores, j)
                ? i
                : at(scores, j) > at(scores, i)
                ? j
                : yield* rng.choice(Chunk.make(i, j))
            }
            return i
          }))
        if (
          !hasSupport ||
          Arr.some(
            descriptions,
            ([a, b, sources]) =>
              a === i && b === j && Equivalence.Array(Num.Equivalence)(sources, description)
          )
        ) {
          return Option.none<MergeProposal>()
        }
        return Option.some(
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
      }))
  })

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
        return take > 0 ? Arr.appendAll(selected, yield* rng.sample(Chunk.fromIterable(bucket), take)) : selected
      }))
    return selected.length === 5
      ? selected
      : Arr.appendAll(
        selected,
        yield* rng.sample(Chunk.fromIterable(Arr.difference(ids, selected)), 5 - selected.length)
      )
  })
