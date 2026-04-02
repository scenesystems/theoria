export type ProjectionSplitBounds = {
  readonly maxPercent: number
  readonly minPercent: number
}

const threePaneMinimumOverallPercent = 24

const clampPercent = ({
  bounds,
  percent
}: {
  readonly bounds: ProjectionSplitBounds
  readonly percent: number
}): number => Math.max(bounds.minPercent, Math.min(bounds.maxPercent, percent))

export const threePanePrimaryBounds: ProjectionSplitBounds = {
  maxPercent: 100 - (threePaneMinimumOverallPercent * 2),
  minPercent: threePaneMinimumOverallPercent
}

export const clampedThreePanePrimaryPercent = (percent: number): number =>
  clampPercent({ bounds: threePanePrimaryBounds, percent })

export const threePaneSecondaryBounds = (primaryPercent: number): ProjectionSplitBounds => {
  const clampedPrimaryPercent = clampedThreePanePrimaryPercent(primaryPercent)
  const trailingPairPercent = 100 - clampedPrimaryPercent
  const minPercent = Math.ceil((threePaneMinimumOverallPercent / trailingPairPercent) * 100)

  return {
    maxPercent: 100 - minPercent,
    minPercent
  }
}

export const clampedThreePaneSecondaryPercent = ({
  primaryPercent,
  secondaryPercent
}: {
  readonly primaryPercent: number
  readonly secondaryPercent: number
}): number => clampPercent({ bounds: threePaneSecondaryBounds(primaryPercent), percent: secondaryPercent })
