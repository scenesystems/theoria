import type * as Option from "effect/Option"

import type { Card } from "../../contracts/card.js"

export type SurfaceChromeContentModel = {
  readonly badgeLabel: string
  readonly title: string
  readonly packageMeta: {
    readonly label: string
    readonly value: string
  }
  readonly compactPackageValue: string | null
  readonly useCaseMeta: {
    readonly label: string
    readonly value: string
  }
  readonly summary: string
  readonly runtimeBadge: {
    readonly label: string
    readonly visible: boolean
  }
  readonly themeControl: {
    readonly visible: boolean
  }
  readonly primaryAction: {
    readonly label: string
    readonly pendingLabel: string
  }
}

export type SurfaceChromeModel = SurfaceChromeContentModel & {
  readonly backLink: {
    readonly href: Option.Option<string>
    readonly label: string
  }
  readonly deepDiveLink: {
    readonly href: Option.Option<string>
    readonly label: string
  }
}

export const surfaceChromeContentModel = (card: Card): SurfaceChromeContentModel => ({
  badgeLabel: card.id,
  title: card.title,
  packageMeta: {
    label: "Package",
    value: card.packageName
  },
  compactPackageValue: card.title === card.packageName ? null : card.packageName,
  useCaseMeta: {
    label: "Use Case",
    value: card.useCase
  },
  summary: card.summary,
  runtimeBadge: {
    label: "Browser",
    visible: true
  },
  themeControl: {
    visible: true
  },
  primaryAction: {
    label: card.runLabel,
    pendingLabel: "Running…"
  }
})

export const surfaceChromeModel = ({
  backHref,
  content,
  deepDiveHref
}: {
  readonly backHref: Option.Option<string>
  readonly content: SurfaceChromeContentModel
  readonly deepDiveHref: Option.Option<string>
}): SurfaceChromeModel => ({
  ...content,
  backLink: {
    href: backHref,
    label: "Back"
  },
  deepDiveLink: {
    href: deepDiveHref,
    label: "Deep Dive"
  }
})
