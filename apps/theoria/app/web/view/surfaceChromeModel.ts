import { Schema } from "effect"
import type * as Option from "effect/Option"

import type { EntryPresentation } from "../../contracts/entry/routing.js"

class SurfaceChromeMeta extends Schema.Class<SurfaceChromeMeta>("SurfaceChromeMeta")({
  label: Schema.String,
  value: Schema.String
}) {}

class SurfaceChromeBadge extends Schema.Class<SurfaceChromeBadge>("SurfaceChromeBadge")({
  label: Schema.String,
  visible: Schema.Boolean
}) {}

class SurfaceChromePrimaryAction extends Schema.Class<SurfaceChromePrimaryAction>("SurfaceChromePrimaryAction")({
  label: Schema.String,
  pendingLabel: Schema.String
}) {}

export class SurfaceChromeContentModel extends Schema.Class<SurfaceChromeContentModel>("SurfaceChromeContentModel")({
  badgeLabel: Schema.String,
  title: Schema.String,
  packageMeta: SurfaceChromeMeta,
  compactPackageValue: Schema.NullOr(Schema.String),
  useCaseMeta: SurfaceChromeMeta,
  summary: Schema.String,
  runtimeBadge: SurfaceChromeBadge,
  themeControl: Schema.Struct({
    visible: Schema.Boolean
  }),
  primaryAction: SurfaceChromePrimaryAction
}) {}

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

export const surfaceChromeContentModel = (surface: EntryPresentation): SurfaceChromeContentModel =>
  SurfaceChromeContentModel.make({
    badgeLabel: surface.entryId,
    title: surface.title,
    packageMeta: SurfaceChromeMeta.make({
      label: "Entry",
      value: surface.packageName
    }),
    compactPackageValue: surface.title === surface.packageName ? null : surface.packageName,
    useCaseMeta: SurfaceChromeMeta.make({
      label: "Use Case",
      value: surface.useCase
    }),
    summary: surface.summary,
    runtimeBadge: SurfaceChromeBadge.make({
      label: "Browser",
      visible: true
    }),
    themeControl: {
      visible: true
    },
    primaryAction: SurfaceChromePrimaryAction.make({
      label: surface.runLabel,
      pendingLabel: "Running…"
    })
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
