import type * as Option from "effect/Option"

import type { PublishedConsumerPresentation } from "../../contracts/proving-substrate.js"

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

export const surfaceChromeContentModel = (surface: PublishedConsumerPresentation): SurfaceChromeContentModel => ({
  badgeLabel: surface.consumerId,
  title: surface.title,
  packageMeta: {
    label: surface.group === "application" ? "Application" : "Package",
    value: surface.packageName
  },
  compactPackageValue: surface.title === surface.packageName ? null : surface.packageName,
  useCaseMeta: {
    label: "Use Case",
    value: surface.useCase
  },
  summary: surface.summary,
  runtimeBadge: {
    label: "Browser",
    visible: true
  },
  themeControl: {
    visible: true
  },
  primaryAction: {
    label: surface.runLabel,
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
