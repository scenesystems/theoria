import { Effect, Option, Ref } from "effect"
import * as Arr from "effect/Array"

import { bestTrialPoint, type TrialPoint } from "../../contracts/demo/objective.js"
import type { EvidenceEvent } from "../../contracts/evidence-stream.js"
import { SectionUpsert } from "../../contracts/evidence-stream.js"
import type { EvidenceSection } from "../../contracts/evidence.js"

export const optimizationEvidenceBatchSize = 5
export const optimizationEvidenceLiveRowWindow = 12

const visibleTrialPoints = ({
  force,
  points
}: {
  readonly force: boolean
  readonly points: ReadonlyArray<TrialPoint>
}): ReadonlyArray<TrialPoint> =>
  force || points.length <= optimizationEvidenceLiveRowWindow
    ? points
    : points.slice(-optimizationEvidenceLiveRowWindow)

const trialTableLabel = ({
  force,
  prefix,
  totalCount,
  visibleCount
}: {
  readonly force: boolean
  readonly prefix: string
  readonly totalCount: number
  readonly visibleCount: number
}): string =>
  force || visibleCount === totalCount
    ? `${prefix} trial coordinates`
    : `${prefix} trial coordinates (latest ${visibleCount} of ${totalCount})`

const trialPositionsSection = ({
  force,
  randomPoints,
  tpePoints
}: {
  readonly force: boolean
  readonly randomPoints: ReadonlyArray<TrialPoint>
  readonly tpePoints: ReadonlyArray<TrialPoint>
}): EvidenceSection => {
  const visibleTpePoints = visibleTrialPoints({ force, points: tpePoints })
  const visibleRandomPoints = visibleTrialPoints({ force, points: randomPoints })

  return {
    title: "Trial Positions",
    items: [
      {
        _tag: "Table",
        label: trialTableLabel({
          force,
          prefix: "TPE",
          totalCount: tpePoints.length,
          visibleCount: visibleTpePoints.length
        }),
        columns: ["Trial", "x", "y", "Objective"],
        rows: Arr.map(visibleTpePoints, (point) => [
          String(point.index + 1),
          point.x.toFixed(4),
          point.y.toFixed(4),
          point.value.toFixed(6)
        ])
      },
      {
        _tag: "Table",
        label: trialTableLabel({
          force,
          prefix: "Random",
          totalCount: randomPoints.length,
          visibleCount: visibleRandomPoints.length
        }),
        columns: ["Trial", "x", "y", "Objective"],
        rows: Arr.map(visibleRandomPoints, (point) => [
          String(point.index + 1),
          point.x.toFixed(4),
          point.y.toFixed(4),
          point.value.toFixed(6)
        ])
      }
    ]
  }
}

const bestFoundSection = (
  tpePoints: ReadonlyArray<TrialPoint>,
  randomPoints: ReadonlyArray<TrialPoint>
): Option.Option<EvidenceSection> =>
  Option.map(
    Option.zipWith(bestTrialPoint(tpePoints), bestTrialPoint(randomPoints), (tpe, random) => ({ tpe, random })),
    ({ tpe, random }) => ({
      title: "Best Found",
      items: [
        {
          _tag: "Text",
          label: "TPE best",
          value: `(${tpe.x.toFixed(4)}, ${tpe.y.toFixed(4)}) → ${tpe.value.toFixed(6)}`
        },
        {
          _tag: "Text",
          label: "Random best",
          value: `(${random.x.toFixed(4)}, ${random.y.toFixed(4)}) → ${random.value.toFixed(6)}`
        },
        {
          _tag: "Comparison",
          label: "Best objective value",
          baseline: random.value,
          improved: tpe.value,
          unit: "loss",
          direction: "lower-is-better"
        }
      ]
    })
  )

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
