import { Option } from "effect"
import * as Arr from "effect/Array"

import { authorityCatalogForId } from "../../../contracts/capability/catalog.js"
import type { CardReleaseState } from "../../../contracts/entry/descriptor.js"
import { primaryAuthorityIdForEntry } from "../../../contracts/entry/focus.js"
import type { EntryId } from "../../../contracts/entry/id.js"
import { entryDescriptors } from "../../../contracts/entry/registry.js"
import { entryPresentationForId } from "../../../contracts/entry/routing.js"
import type { ReleaseStage } from "../../../contracts/release-stage.js"

type InstrumentEntryInteractiveField = {
  readonly interactiveLabel: string
}

const interactiveLabelField = (
  interactiveLabel: Option.Option<string>
): {} | InstrumentEntryInteractiveField =>
  Option.match(interactiveLabel, {
    onNone: () => ({}),
    onSome: (resolvedInteractiveLabel) => ({
      interactiveLabel: resolvedInteractiveLabel
    })
  })

export type PackageGroup = "effect" | "scenesystems"

export type PackageGroupMeta = {
  readonly label: string
  readonly description: string
}

export type InstrumentEntry = {
  readonly id: EntryId
  readonly title: string
  readonly packageName: string
  readonly description: string
  readonly useCase: string
  readonly summary: string
  readonly runLabel: string
  readonly deepDivePath: string
  readonly group: PackageGroup
  readonly releaseState: CardReleaseState
  readonly version: string
  readonly npmUrl: string
  readonly repoUrl: string
  readonly license: string
  readonly interactiveLabel?: string
}

const packageGroupMetaById: Record<PackageGroup, PackageGroupMeta> = {
  effect: {
    label: "Effect Packages",
    description: "Effect-native scientific and inference packages published under the effect-* surface."
  },
  scenesystems: {
    label: "Scene Systems Packages",
    description: "Scene Systems cryptographic and proving entries published under the @scenesystems surface."
  }
}

const packageGroupForEntry = (entryId: EntryId): PackageGroup =>
  entryId.startsWith("effect-") ? "effect" : "scenesystems"

const instrumentEntryForId = (entryId: EntryId): InstrumentEntry => {
  const presentation = entryPresentationForId(entryId)
  const authority = authorityCatalogForId(primaryAuthorityIdForEntry(entryId))

  return {
    id: presentation.entryId,
    title: presentation.title,
    packageName: presentation.packageName,
    description: presentation.description,
    useCase: presentation.useCase,
    summary: presentation.summary,
    runLabel: presentation.runLabel,
    deepDivePath: presentation.path,
    group: packageGroupForEntry(presentation.entryId),
    releaseState: presentation.releaseState,
    version: authority.version,
    npmUrl: authority.npmUrl,
    repoUrl: authority.repoUrl,
    license: authority.license,
    ...interactiveLabelField(Option.fromNullable(presentation.interactiveLabel))
  }
}

export const packageGroupMeta = (group: PackageGroup): PackageGroupMeta => packageGroupMetaById[group]

export const instrumentEntries: ReadonlyArray<InstrumentEntry> = Arr.map(
  entryDescriptors,
  (descriptor) => instrumentEntryForId(descriptor.entryId)
)

export const instrumentEntriesForGroup = (group: PackageGroup): ReadonlyArray<InstrumentEntry> =>
  Arr.filter(instrumentEntries, (entry) => entry.group === group)

export const instrumentVisibleInReleaseStage = (entry: InstrumentEntry, stage: ReleaseStage): boolean =>
  stage === "preview" || entry.releaseState === "published"
