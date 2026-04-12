import { Schema } from "effect"

import type { DeepDiveProjectionSurfaceState } from "./deep-dive-projection-order-state.js"
import { DeepDiveProjectionPlane, projectedProjectionSurfaces } from "./deep-dive-projection.js"
import { DeepDivePanePercentMax, DeepDivePanePercentMin } from "./layout.js"

const DeepDiveCompactActivePane = Schema.Literal("first", "second")

export class ProjectionSplitBounds extends Schema.Class<ProjectionSplitBounds>("ProjectionSplitBounds")({
  maxPercent: Schema.Number,
  minPercent: Schema.Number
}) {}

export class EmptyDeepDiveProjectionWorkspaceLayout
  extends Schema.TaggedClass<EmptyDeepDiveProjectionWorkspaceLayout>()("Empty", {})
{}

export class SingleDeepDiveProjectionWorkspaceLayout
  extends Schema.TaggedClass<SingleDeepDiveProjectionWorkspaceLayout>()("Single", {
    surfaceId: DeepDiveProjectionPlane
  })
{}

export class SplitDeepDiveProjectionWorkspaceLayout
  extends Schema.TaggedClass<SplitDeepDiveProjectionWorkspaceLayout>()("Split", {
    compactActivePane: DeepDiveCompactActivePane,
    firstPanePercent: Schema.Number,
    firstSurfaceId: DeepDiveProjectionPlane,
    maxPercent: Schema.Number,
    minPercent: Schema.Number,
    secondSurfaceId: DeepDiveProjectionPlane
  })
{}

export class TripleDeepDiveProjectionWorkspaceLayout
  extends Schema.TaggedClass<TripleDeepDiveProjectionWorkspaceLayout>()("Triple", {
    compactActivePane: DeepDiveCompactActivePane,
    firstPanePercent: Schema.Number,
    firstSurfaceId: DeepDiveProjectionPlane,
    maxPercent: Schema.Number,
    minPercent: Schema.Number,
    secondCompactActivePane: DeepDiveCompactActivePane,
    secondFirstPanePercent: Schema.Number,
    secondMaxPercent: Schema.Number,
    secondMinPercent: Schema.Number,
    secondSurfaceId: DeepDiveProjectionPlane,
    thirdSurfaceId: DeepDiveProjectionPlane
  })
{}

export const DeepDiveProjectionWorkspaceLayout = Schema.Union(
  EmptyDeepDiveProjectionWorkspaceLayout,
  SingleDeepDiveProjectionWorkspaceLayout,
  SplitDeepDiveProjectionWorkspaceLayout,
  TripleDeepDiveProjectionWorkspaceLayout
)

export type DeepDiveProjectionWorkspaceLayout = typeof DeepDiveProjectionWorkspaceLayout.Type

const threePaneMinimumOverallPercent = 24

const clampPercent = ({
  bounds,
  percent
}: {
  readonly bounds: ProjectionSplitBounds
  readonly percent: number
}): number => Math.max(bounds.minPercent, Math.min(bounds.maxPercent, percent))

export const threePanePrimaryBounds = ProjectionSplitBounds.make({
  maxPercent: 100 - (threePaneMinimumOverallPercent * 2),
  minPercent: threePaneMinimumOverallPercent
})

export const clampedThreePanePrimaryPercent = (percent: number): number =>
  clampPercent({ bounds: threePanePrimaryBounds, percent })

export const threePaneSecondaryBounds = (primaryPercent: number): ProjectionSplitBounds => {
  const clampedPrimaryPercent = clampedThreePanePrimaryPercent(primaryPercent)
  const trailingPairPercent = 100 - clampedPrimaryPercent
  const minPercent = Math.ceil((threePaneMinimumOverallPercent / trailingPairPercent) * 100)

  return ProjectionSplitBounds.make({
    maxPercent: 100 - minPercent,
    minPercent
  })
}

export const clampedThreePaneSecondaryPercent = ({
  primaryPercent,
  secondaryPercent
}: {
  readonly primaryPercent: number
  readonly secondaryPercent: number
}): number => clampPercent({ bounds: threePaneSecondaryBounds(primaryPercent), percent: secondaryPercent })

const focusedProjectedSurfaceIndex = ({
  focusedSurface,
  surfaces
}: {
  readonly focusedSurface: DeepDiveProjectionPlane
  readonly surfaces: ReadonlyArray<DeepDiveProjectionSurfaceState>
}): number => {
  const projected = projectedProjectionSurfaces(surfaces)
  const resolvedIndex = projected.findIndex((surface) => surface.id === focusedSurface)

  return resolvedIndex === -1 ? 0 : resolvedIndex
}

export const deepDiveProjectionWorkspaceLayout = ({
  focusedSurface,
  panePercent,
  secondaryPanePercent,
  surfaces
}: {
  readonly focusedSurface: DeepDiveProjectionPlane
  readonly panePercent: number
  readonly secondaryPanePercent: number
  readonly surfaces: ReadonlyArray<DeepDiveProjectionSurfaceState>
}): DeepDiveProjectionWorkspaceLayout => {
  const projected = projectedProjectionSurfaces(surfaces)
  const firstSurface = projected[0] ?? null

  if (firstSurface === null) {
    return EmptyDeepDiveProjectionWorkspaceLayout.make({})
  }

  const secondSurface = projected[1] ?? null

  if (secondSurface === null) {
    return SingleDeepDiveProjectionWorkspaceLayout.make({ surfaceId: firstSurface.id })
  }

  const thirdSurface = projected[2] ?? null

  if (thirdSurface === null) {
    return SplitDeepDiveProjectionWorkspaceLayout.make({
      compactActivePane: focusedProjectedSurfaceIndex({ focusedSurface, surfaces }) === 1 ? "second" : "first",
      firstPanePercent: panePercent,
      firstSurfaceId: firstSurface.id,
      maxPercent: DeepDivePanePercentMax,
      minPercent: DeepDivePanePercentMin,
      secondSurfaceId: secondSurface.id
    })
  }

  const firstPanePercent = clampedThreePanePrimaryPercent(panePercent)
  const trailingBounds = threePaneSecondaryBounds(firstPanePercent)
  const activeIndex = focusedProjectedSurfaceIndex({ focusedSurface, surfaces })

  return TripleDeepDiveProjectionWorkspaceLayout.make({
    compactActivePane: activeIndex === 0 ? "first" : "second",
    firstPanePercent,
    firstSurfaceId: firstSurface.id,
    maxPercent: threePanePrimaryBounds.maxPercent,
    minPercent: threePanePrimaryBounds.minPercent,
    secondCompactActivePane: activeIndex === 2 ? "second" : "first",
    secondFirstPanePercent: clampedThreePaneSecondaryPercent({
      primaryPercent: firstPanePercent,
      secondaryPercent: secondaryPanePercent
    }),
    secondMaxPercent: trailingBounds.maxPercent,
    secondMinPercent: trailingBounds.minPercent,
    secondSurfaceId: secondSurface.id,
    thirdSurfaceId: thirdSurface.id
  })
}
