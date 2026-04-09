import { type PackageName, PackageNameSchema } from "@theoria/source-proof/contracts"
import { Schema } from "effect"
import * as Arr from "effect/Array"
import * as Option from "effect/Option"
import type { ReleaseStage } from "../release-stage.js"

import { CardReleaseState } from "./descriptor.js"
import { type EntryId, EntryId as EntryIdSchema } from "./id.js"
import {
  type AnyEntryDescriptor,
  entryDescriptorForId,
  entryDescriptorForPackageName,
  entryDescriptors
} from "./registry.js"

const NonEmptyString = Schema.String.pipe(Schema.minLength(1))

export class EntryPresentation extends Schema.Class<EntryPresentation>("EntryPresentation")({
  entryId: EntryIdSchema,
  title: NonEmptyString,
  packageName: PackageNameSchema,
  description: NonEmptyString,
  useCase: NonEmptyString,
  summary: NonEmptyString,
  runLabel: NonEmptyString,
  path: NonEmptyString,
  interactiveLabel: Schema.NullOr(NonEmptyString),
  releaseState: CardReleaseState
}) {}

export class EntryRunIdentity extends Schema.Class<EntryRunIdentity>("EntryRunIdentity")({
  id: EntryIdSchema,
  packageName: PackageNameSchema
}) {}

type EntryVisibilityOwner = {
  readonly releaseState: typeof CardReleaseState.Type
}

const entryPresentationFromDescriptor = (descriptor: AnyEntryDescriptor): EntryPresentation =>
  EntryPresentation.make({
    entryId: descriptor.entryId,
    title: descriptor.title,
    packageName: descriptor.packageName,
    description: descriptor.description,
    useCase: descriptor.useCase,
    summary: descriptor.summary,
    runLabel: descriptor.runLabel,
    path: descriptor.path,
    interactiveLabel: descriptor.interactiveLabel,
    releaseState: descriptor.releaseState
  })

export const entryPresentationForId = (entryId: EntryId): EntryPresentation =>
  entryPresentationFromDescriptor(entryDescriptorForId(entryId))

export const entryPresentationForPackageName = (packageName: PackageName): Option.Option<EntryPresentation> =>
  entryDescriptorForPackageName(packageName).pipe(Option.map(entryPresentationFromDescriptor))

export const entryRunIdentityForId = (entryId: EntryId): EntryRunIdentity =>
  EntryRunIdentity.make({
    id: entryId,
    packageName: entryDescriptorForId(entryId).packageName
  })

export const entryTitleForId = (entryId: EntryId): string => entryDescriptorForId(entryId).title

export const entryPackageNameForId = (entryId: EntryId): PackageName => entryRunIdentityForId(entryId).packageName

export const entryPathForId = (entryId: EntryId): string => entryDescriptorForId(entryId).path

export const entryRunLabelForId = (entryId: EntryId): string => entryDescriptorForId(entryId).runLabel

export const entryInteractiveLabelForId = (entryId: EntryId): string | null =>
  entryDescriptorForId(entryId).interactiveLabel

export const entryDescriptorForPath = (pathname: string): Option.Option<AnyEntryDescriptor> =>
  Arr.findFirst(entryDescriptors, (descriptor) => descriptor.path === pathname)

export const entryIdForPath = (pathname: string): Option.Option<EntryId> =>
  entryDescriptorForPath(pathname).pipe(Option.map((descriptor) => descriptor.entryId))

export const entryVisibleInReleaseStage = (
  entry: EntryVisibilityOwner,
  stage: ReleaseStage
): boolean => stage === "preview" || entry.releaseState === "published"

export const visibleEntryDescriptorForPath = (
  pathname: string,
  stage: ReleaseStage
): Option.Option<AnyEntryDescriptor> =>
  entryDescriptorForPath(pathname).pipe(
    Option.filter((descriptor) => entryVisibleInReleaseStage(descriptor, stage))
  )

export const visibleEntryIdForPath = (pathname: string, stage: ReleaseStage): Option.Option<EntryId> =>
  visibleEntryDescriptorForPath(pathname, stage).pipe(Option.map((descriptor) => descriptor.entryId))

export const visibleEntryDescriptorsForReleaseStage = (stage: ReleaseStage): ReadonlyArray<AnyEntryDescriptor> =>
  Arr.filter(entryDescriptors, (descriptor) => entryVisibleInReleaseStage(descriptor, stage))

export const visibleEntryIdsForReleaseStage = (stage: ReleaseStage): ReadonlyArray<EntryId> =>
  Arr.map(visibleEntryDescriptorsForReleaseStage(stage), (descriptor) => descriptor.entryId)

export const visiblePackageDocsPackageIdsForReleaseStage = (
  stage: ReleaseStage
): ReadonlyArray<PackageName> =>
  Arr.map(visibleEntryDescriptorsForReleaseStage(stage), (descriptor) => descriptor.packageName)
