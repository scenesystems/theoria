/**
 * GEPA common-ancestor discovery — finds the nearest shared ancestor in
 * candidate lineage.
 *
 * @see {@link https://arxiv.org/abs/2507.19457 | Agrawal et al., "GEPA: Reflective Prompt Evolution Can Outperform Reinforcement Learning", 2025}
 * @since 0.1.0
 */
import { Array as Arr, Match, Option, Order, Tuple } from "effect"
import type { ProgramCandidate } from "../model.js"

export type ResolveMergeInputsOptions = Readonly<{
  readonly candidates: ReadonlyArray<ProgramCandidate>
  readonly parentAId: string
  readonly parentBId: string
}>

export type MergeInputs = Readonly<{
  readonly commonAncestorId: string
  readonly ancestor: ProgramCandidate
  readonly parentA: ProgramCandidate
  readonly parentB: ProgramCandidate
}>

type AncestorDistance = Readonly<{
  readonly candidateId: string
  readonly distance: number
}>

type CommonAncestorCandidate = Readonly<{
  readonly candidateId: string
  readonly parentADistance: number
  readonly parentBDistance: number
}>

const makeAncestorDistance = (candidateId: string, distance: number): AncestorDistance => ({
  candidateId,
  distance
})

const commonAncestorOrder: Order.Order<CommonAncestorCandidate> = Order.mapInput(
  Order.tuple(Order.number, Order.number, Order.number, Order.number, Order.string),
  (candidate) =>
    Tuple.make(
      Math.max(candidate.parentADistance, candidate.parentBDistance),
      candidate.parentADistance + candidate.parentBDistance,
      candidate.parentADistance,
      candidate.parentBDistance,
      candidate.candidateId
    )
)

const findCandidate = (
  candidates: ReadonlyArray<ProgramCandidate>,
  candidateId: string
): Option.Option<ProgramCandidate> => Arr.findFirst(candidates, (candidate) => candidate.candidateId === candidateId)

const parentIdsForCandidate = (
  candidates: ReadonlyArray<ProgramCandidate>,
  candidateId: string
): ReadonlyArray<string> =>
  findCandidate(candidates, candidateId).pipe(
    Option.match({
      onNone: () => Arr.empty<string>(),
      onSome: (candidate) => candidate.parentIds
    })
  )

const distanceForCandidate = (
  distances: ReadonlyArray<AncestorDistance>,
  candidateId: string
): Option.Option<number> =>
  Arr.findFirst(distances, (entry) => entry.candidateId === candidateId).pipe(
    Option.map((entry) => entry.distance)
  )

const replaceDistance = (
  distances: ReadonlyArray<AncestorDistance>,
  candidateId: string,
  distance: number
): ReadonlyArray<AncestorDistance> =>
  Arr.map(distances, (entry) =>
    Match.value(entry.candidateId === candidateId).pipe(
      Match.when(true, () => makeAncestorDistance(candidateId, distance)),
      Match.orElse(() => entry)
    ))

const upsertDistance = (
  distances: ReadonlyArray<AncestorDistance>,
  candidateId: string,
  distance: number
): ReadonlyArray<AncestorDistance> =>
  Option.match(distanceForCandidate(distances, candidateId), {
    onNone: () => Arr.append(distances, makeAncestorDistance(candidateId, distance)),
    onSome: () => replaceDistance(distances, candidateId, distance)
  })

const shouldExploreCandidate = (
  distances: ReadonlyArray<AncestorDistance>,
  candidateId: string,
  distance: number
): boolean =>
  Option.match(distanceForCandidate(distances, candidateId), {
    onNone: () => true,
    onSome: (knownDistance) => distance < knownDistance
  })

const collectAncestorDistances = (
  candidates: ReadonlyArray<ProgramCandidate>,
  pending: ReadonlyArray<AncestorDistance>,
  distances: ReadonlyArray<AncestorDistance>
): ReadonlyArray<AncestorDistance> =>
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
              (parentId) => makeAncestorDistance(parentId, current.distance + 1)
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
  parentADistances: ReadonlyArray<AncestorDistance>,
  parentBDistances: ReadonlyArray<AncestorDistance>
): ReadonlyArray<CommonAncestorCandidate> =>
  Arr.filterMap(
    parentADistances,
    (parentAEntry) =>
      distanceForCandidate(parentBDistances, parentAEntry.candidateId).pipe(
        Option.map((parentBDistance) => ({
          candidateId: parentAEntry.candidateId,
          parentADistance: parentAEntry.distance,
          parentBDistance
        }))
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
  candidates: ReadonlyArray<ProgramCandidate>,
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
                Option.map((ancestor) => ({ commonAncestorId, ancestor, parentA, parentB }))
              )
            )
          )
        )
      )
    )
  )
