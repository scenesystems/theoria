import * as Arr from "effect/Array"
import * as Option from "effect/Option"

import { type CardReleaseState } from "./descriptor.js"
import type { EntryId } from "./id.js"
import { type AnyEntryDescriptor, entryDescriptorForId, entryDescriptors } from "./registry.js"

export type EntryPresentation = {
  readonly entryId: EntryId
  readonly title: string
  readonly packageName: string
  readonly description: string
  readonly useCase: string
  readonly summary: string
  readonly runLabel: string
  readonly path: string
  readonly interactiveLabel: string | null
  readonly releaseState: CardReleaseState
}

export const entryPresentationForId = (entryId: EntryId): EntryPresentation => {
  const descriptor = entryDescriptorForId(entryId)

  return {
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
  }
}

export const entryDescriptorForPath = (pathname: string): Option.Option<AnyEntryDescriptor> =>
  Arr.findFirst(entryDescriptors, (descriptor) => descriptor.path === pathname)

export const entryIdForPath = (pathname: string): Option.Option<EntryId> =>
  entryDescriptorForPath(pathname).pipe(Option.map((descriptor) => descriptor.entryId))

export const entryVisibleInReleaseStage = (
  entry: AnyEntryDescriptor,
  stage: "preview" | "production"
): boolean => stage === "preview" || entry.releaseState === "published"
