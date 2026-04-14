import type { PackageName } from "@theoria/source-proof/contracts"
import { Data, Effect } from "effect"
import * as Option from "effect/Option"

import type { ReleaseStage } from "../release-stage.js"
import { type DurableFingerprint, fingerprintOf } from "./fingerprint.js"
import { type EntryId, workflowEntryId } from "./id.js"

import { workflowEntryDescriptor } from "./descriptors/workflow.js"

const entryDescriptorTuple = [workflowEntryDescriptor]

export type AnyEntryDescriptor = (typeof entryDescriptorTuple)[number]

type EntryDescriptorById = {
  readonly [Id in EntryId]: Extract<AnyEntryDescriptor, { readonly entryId: Id }>
}

const entryDescriptorById: EntryDescriptorById = {
  [workflowEntryId]: workflowEntryDescriptor
}

export class EntryRegistry extends Data.Class<EntryRegistry.Shape> {
  static make(shape: EntryRegistry.Shape): EntryRegistry {
    return new EntryRegistry(shape)
  }

  static current(): EntryRegistry {
    return currentEntryRegistry
  }

  descriptorForId<Id extends EntryId>(entryId: Id): EntryDescriptorById[Id] {
    return this.descriptorById[entryId]
  }

  descriptorForPackageName(packageName: PackageName): Option.Option<AnyEntryDescriptor> {
    return this.descriptorById[workflowEntryId].packageName === packageName
      ? Option.some(this.descriptorById[workflowEntryId])
      : Option.none()
  }

  descriptorForPath(pathname: string): Option.Option<AnyEntryDescriptor> {
    return this.descriptorById[workflowEntryId].path === pathname
      ? Option.some(this.descriptorById[workflowEntryId])
      : Option.none()
  }

  entryIdForPackageName(packageName: PackageName): Option.Option<EntryId> {
    return this.descriptorForPackageName(packageName).pipe(Option.map((descriptor) => descriptor.entryId))
  }

  entryIdForPath(pathname: string): Option.Option<EntryId> {
    return this.descriptorForPath(pathname).pipe(Option.map((descriptor) => descriptor.entryId))
  }

  visibleDescriptorForPath(pathname: string, stage: ReleaseStage): Option.Option<AnyEntryDescriptor> {
    return this.descriptorForPath(pathname).pipe(
      Option.filter((descriptor) => descriptor.visibleInReleaseStage(stage))
    )
  }

  visibleDescriptorsForReleaseStage(stage: ReleaseStage): ReadonlyArray<AnyEntryDescriptor> {
    return this.descriptorById[workflowEntryId].visibleInReleaseStage(stage)
      ? [this.descriptorById[workflowEntryId]]
      : []
  }

  visibleEntryIdsForReleaseStage(stage: ReleaseStage): ReadonlyArray<EntryId> {
    return this.visibleDescriptorsForReleaseStage(stage).map((descriptor) => descriptor.entryId)
  }

  visiblePackageDocsPackageIdsForReleaseStage(stage: ReleaseStage): ReadonlyArray<PackageName> {
    return this.visibleDescriptorsForReleaseStage(stage).map((descriptor) => descriptor.packageName)
  }

  fingerprint(): Effect.Effect<DurableFingerprint, never, never> {
    return Effect.forEach(this.descriptors, (descriptor) => descriptor.fingerprint()).pipe(
      Effect.flatMap(fingerprintOf)
    )
  }
}

export namespace EntryRegistry {
  export interface Shape {
    readonly descriptors: ReadonlyArray<AnyEntryDescriptor>
    readonly descriptorById: EntryDescriptorById
  }
}

const currentEntryRegistry = EntryRegistry.make({
  descriptors: entryDescriptorTuple,
  descriptorById: entryDescriptorById
})
