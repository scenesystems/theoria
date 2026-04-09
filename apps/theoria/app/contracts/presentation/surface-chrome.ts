import { Schema } from "effect"
import type * as Option from "effect/Option"
import * as OptionValue from "effect/Option"

import type { EntryPresentation } from "../entry/routing.js"

class SurfaceChromeMeta extends Schema.Class<SurfaceChromeMeta>("SurfaceChromeMeta")({
  label: Schema.String,
  value: Schema.String
}) {}

class SurfaceChromeBadge extends Schema.Class<SurfaceChromeBadge>("SurfaceChromeBadge")({
  label: Schema.String,
  visible: Schema.Boolean
}) {}

export class SurfaceChromeLink extends Schema.Class<SurfaceChromeLink>("SurfaceChromeLink")({
  href: Schema.NullOr(Schema.String),
  label: Schema.String
}) {}

class SurfaceChromePrimaryAction extends Schema.Class<SurfaceChromePrimaryAction>("SurfaceChromePrimaryAction")({
  label: Schema.String,
  pendingLabel: Schema.String
}) {}

export class SurfaceChromeThemeControl extends Schema.Class<SurfaceChromeThemeControl>("SurfaceChromeThemeControl")({
  visible: Schema.Boolean
}) {}

export class SurfaceChromeContentModel extends Schema.Class<SurfaceChromeContentModel>("SurfaceChromeContentModel")({
  badgeLabel: Schema.String,
  title: Schema.String,
  packageMeta: SurfaceChromeMeta,
  compactPackageValue: Schema.NullOr(Schema.String),
  useCaseMeta: SurfaceChromeMeta,
  summary: Schema.String,
  runtimeBadge: SurfaceChromeBadge,
  themeControl: SurfaceChromeThemeControl,
  primaryAction: SurfaceChromePrimaryAction
}) {}

export class SurfaceChromeModel extends Schema.Class<SurfaceChromeModel>("SurfaceChromeModel")({
  badgeLabel: Schema.String,
  title: Schema.String,
  packageMeta: SurfaceChromeMeta,
  compactPackageValue: Schema.NullOr(Schema.String),
  useCaseMeta: SurfaceChromeMeta,
  summary: Schema.String,
  runtimeBadge: SurfaceChromeBadge,
  themeControl: SurfaceChromeThemeControl,
  primaryAction: SurfaceChromePrimaryAction,
  backLink: SurfaceChromeLink,
  deepDiveLink: SurfaceChromeLink
}) {}

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
    themeControl: SurfaceChromeThemeControl.make({
      visible: true
    }),
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
}): SurfaceChromeModel =>
  SurfaceChromeModel.make({
    ...content,
    backLink: SurfaceChromeLink.make({
      href: OptionValue.getOrNull(backHref),
      label: "Back"
    }),
    deepDiveLink: SurfaceChromeLink.make({
      href: OptionValue.getOrNull(deepDiveHref),
      label: "Deep Dive"
    })
  })
