import { Effect, Option, Ref } from "effect"

import {
  bestFoundSection,
  optimizationEvidenceBatchSize,
  type TrialPoint,
  trialPositionsSection
} from "../../../contracts/capability/effect-search.js"
import type { EvidenceEvent } from "../../../contracts/evidence/stream.js"
import { SectionUpsert } from "../../../contracts/evidence/stream.js"

const shouldPublishOptimizationEvidence = ({
  force,
  nextTrialCount,
  publishedTrialCount
}: {
  readonly force: boolean
  readonly nextTrialCount: number
  readonly publishedTrialCount: number
}): boolean =>
  force
    ? nextTrialCount > 0
    : nextTrialCount > publishedTrialCount
      && (nextTrialCount === 1 || nextTrialCount % optimizationEvidenceBatchSize === 0)

export const publishOptimizationEvidence = ({
  emit,
  force,
  publishedTrialCountRef,
  randomPointsRef,
  tpePointsRef
}: {
  readonly emit: (event: EvidenceEvent) => Effect.Effect<void, never, never>
  readonly force: boolean
  readonly publishedTrialCountRef: Ref.Ref<number>
  readonly randomPointsRef: Ref.Ref<ReadonlyArray<TrialPoint>>
  readonly tpePointsRef: Ref.Ref<ReadonlyArray<TrialPoint>>
}): Effect.Effect<boolean, never, never> =>
  Effect.gen(function*() {
    const tpePoints = yield* Ref.get(tpePointsRef)
    const randomPoints = yield* Ref.get(randomPointsRef)
    const nextTrialCount = Math.min(tpePoints.length, randomPoints.length)
    const publishedTrialCount = yield* Ref.get(publishedTrialCountRef)

    if (!shouldPublishOptimizationEvidence({ force, nextTrialCount, publishedTrialCount })) {
      return false
    }

    yield* emit(new SectionUpsert({ section: trialPositionsSection({ force, tpePoints, randomPoints }) }))
    yield* Option.match(bestFoundSection(tpePoints, randomPoints), {
      onNone: () => Effect.void,
      onSome: (section) => emit(new SectionUpsert({ section }))
    })
    yield* Ref.set(publishedTrialCountRef, nextTrialCount)

    return true
  })
