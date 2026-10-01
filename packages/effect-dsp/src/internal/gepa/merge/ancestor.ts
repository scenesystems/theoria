/**
 * GEPA common-ancestor discovery — finds the nearest shared ancestor in
 * candidate lineage.
 *
 * @see {@link https://arxiv.org/abs/2507.19457 | Agrawal et al., "GEPA: Reflective Prompt Evolution Can Outperform Reinforcement Learning", 2025}
 * @since 0.1.0
 */
import { Array as Arr, Match, Number as Num, Option, Order, Schema, String as Str, Tuple } from "effect"
import { ProgramCandidate, ProgramCandidates } from "../model.js"

export const ResolveMergeInputsOptions = Schema.Struct({
  candidates: ProgramCandidates,
  parentAId: Schema.String,
  parentBId: Schema.String
})

export type ResolveMergeInputsOptions = typeof ResolveMergeInputsOptions.Type

export class MergeInputs extends Schema.Class<MergeInputs>(
  "@scenesystems/effect-dsp/internal/gepa/merge/ancestor/MergeInputs"
)({
  commonAncestorId: Schema.String,
  ancestor: ProgramCandidate,
  parentA: ProgramCandidate,
  parentB: ProgramCandidate
}) {}

class AncestorDistance extends Schema.Class<AncestorDistance>(
  "@scenesystems/effect-dsp/internal/gepa/merge/ancestor/AncestorDistance"
)({
  candidateId: Schema.String,
  distance: Schema.Number
}) {}

const AncestorDistances = Schema.Array(AncestorDistance)

type AncestorDistances = typeof AncestorDistances.Type

class CommonAncestorCandidate extends Schema.Class<CommonAncestorCandidate>(
  "@scenesystems/effect-dsp/internal/gepa/merge/ancestor/CommonAncestorCandidate"
)({
  candidateId: Schema.String,
  parentADistance: Schema.Number,
  parentBDistance: Schema.Number
}) {}

const CommonAncestorCandidates = Schema.Array(CommonAncestorCandidate)

type CommonAncestorCandidates = typeof CommonAncestorCandidates.Type

const makeAncestorDistance = (candidateId: string, distance: number): AncestorDistance =>
  new AncestorDistance({
    candidateId,
    distance
  })

const commonAncestorOrder: Order.Order<CommonAncestorCandidate> = Order.mapInput(
  Order.tuple(Order.number, Order.number, Order.number, Order.number, Order.string),
  (candidate) =>
    Tuple.make(
      Num.max(candidate.parentADistance, candidate.parentBDistance),
      Num.sum(candidate.parentADistance, candidate.parentBDistance),
      candidate.parentADistance,
      candidate.parentBDistance,
      candidate.candidateId
    )
)

const findCandidate = (
  candidates: ProgramCandidates,
  candidateId: string
): Option.Option<ProgramCandidate> =>
  Arr.findFirst(candidates, (candidate) => Str.Equivalence(candidate.candidateId, candidateId))

const parentIdsForCandidate = (
  candidates: ProgramCandidates,
  candidateId: string
): ProgramCandidate["parentIds"] =>
  findCandidate(candidates, candidateId).pipe(
    Option.match({
      onNone: () => Arr.empty<string>(),
      onSome: (candidate) => candidate.parentIds
    })
  )

const distanceForCandidate = (
  distances: AncestorDistances,
  candidateId: string
): Option.Option<number> =>
  Arr.findFirst(distances, (entry) => Str.Equivalence(entry.candidateId, candidateId)).pipe(
    Option.map((entry) => entry.distance)
  )

const replaceDistance = (
  distances: AncestorDistances,
  candidateId: string,
  distance: number
): AncestorDistances =>
  Arr.map(distances, (entry) =>
    Match.value(Str.Equivalence(entry.candidateId, candidateId)).pipe(
      Match.when(true, () => makeAncestorDistance(candidateId, distance)),
      Match.orElse(() => entry)
    ))

const upsertDistance = (
  distances: AncestorDistances,
  candidateId: string,
  distance: number
): AncestorDistances =>
  Option.match(distanceForCandidate(distances, candidateId), {
    onNone: () => Arr.append(distances, makeAncestorDistance(candidateId, distance)),
    onSome: () => replaceDistance(distances, candidateId, distance)
  })

const shouldExploreCandidate = (
  distances: AncestorDistances,
  candidateId: string,
  distance: number
): boolean =>
  Option.match(distanceForCandidate(distances, candidateId), {
    onNone: () => true,
    onSome: (knownDistance) => Num.lessThan(distance, knownDistance)
  })

const collectAncestorDistances = (
  candidates: ProgramCandidates,
  pending: AncestorDistances,
  distances: AncestorDistances
): AncestorDistances =>
  Arr.head(pending).pipe(
    Option.match({
      onNone: () => distances,
      onSome: (current) => {
        const remaining = Arr.drop(pending, 1)

        return Match.value(shouldExploreCandidate(distances, current.candidateId, current.distance)).pipe(
          Match.when(false, () => collectAncestorDistances(candidates, remaining, distances)),
          Match.orElse(() => {
            const updatedDistances = upsertDistance(distances, current.candidateId, current.distance)
            const parentDistances = Arr.map(
              parentIdsForCandidate(candidates, current.candidateId),
              (parentId) => makeAncestorDistance(parentId, Num.increment(current.distance))
            )

            return collectAncestorDistances(
              candidates,
              Arr.appendAll(remaining, parentDistances),
              updatedDistances
            )
          })
        )
      }
    })
  )

const sharedAncestorCandidates = (
  parentADistances: AncestorDistances,
  parentBDistances: AncestorDistances
): CommonAncestorCandidates =>
  Arr.filterMap(
    parentADistances,
    (parentAEntry) =>
      distanceForCandidate(parentBDistances, parentAEntry.candidateId).pipe(
        Option.map((parentBDistance) =>
          new CommonAncestorCandidate({
            candidateId: parentAEntry.candidateId,
            parentADistance: parentAEntry.distance,
            parentBDistance
          })
        )
      )
  )

/**
 * Find the nearest shared ancestor between two candidates.
 *
 * @see {@link https://arxiv.org/abs/2507.19457 | Agrawal et al. (2025)}
 * @since 0.1.0
 * @category combinators
 */
export const findNearestCommonAncestor = (
  candidates: ProgramCandidates,
  parentAId: string,
  parentBId: string
): Option.Option<string> => {
  const parentADistances = collectAncestorDistances(
    candidates,
    Arr.make(makeAncestorDistance(parentAId, 0)),
    Arr.empty<AncestorDistance>()
  )
  const parentBDistances = collectAncestorDistances(
    candidates,
    Arr.make(makeAncestorDistance(parentBId, 0)),
    Arr.empty<AncestorDistance>()
  )

  return Arr.head(Arr.sort(sharedAncestorCandidates(parentADistances, parentBDistances), commonAncestorOrder)).pipe(
    Option.map((candidate) => candidate.candidateId)
  )
}

/**
 * Resolve the full parent/ancestor candidates required to construct a merge.
 *
 * @since 0.1.0
 * @category combinators
 */
export const resolveMergeInputs = (
  options: ResolveMergeInputsOptions
): Option.Option<MergeInputs> =>
  findNearestCommonAncestor(options.candidates, options.parentAId, options.parentBId).pipe(
    Option.flatMap((commonAncestorId) =>
      findCandidate(options.candidates, options.parentAId).pipe(
        Option.flatMap((parentA) =>
          findCandidate(options.candidates, options.parentBId).pipe(
            Option.flatMap((parentB) =>
              findCandidate(options.candidates, commonAncestorId).pipe(
                Option.map((ancestor) => new MergeInputs({ commonAncestorId, ancestor, parentA, parentB }))
              )
            )
          )
        )
      )
    )
  )
