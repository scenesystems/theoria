import { type PackageName, PackageNameSchema } from "@theoria/source-proof/contracts"
import { Schema } from "effect"
import * as Option from "effect/Option"
import type { ReleaseStage } from "../release-stage.js"

import { CardReleaseState, EntryProjectionHint } from "./descriptor.js"
import { type EntryId, EntryId as EntryIdSchema } from "./id.js"
import { type AnyEntryDescriptor, EntryRegistry } from "./registry.js"

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
  projectionHint: EntryProjectionHint,
  releaseState: CardReleaseState
}) {
  static project(descriptor: AnyEntryDescriptor): EntryPresentation {
    return EntryPresentation.make({
      entryId: descriptor.entryId,
      title: descriptor.title,
      packageName: descriptor.packageName,
      description: descriptor.description,
      useCase: descriptor.useCase,
      summary: descriptor.summary,
      runLabel: descriptor.runLabel,
      path: descriptor.path,
      interactiveLabel: descriptor.interactiveLabel,
      projectionHint: descriptor.projectionHint,
      releaseState: descriptor.releaseState
    })
  }

  static fromEntryId(entryId: EntryId, registry: EntryRegistry = EntryRegistry.current()): EntryPresentation {
    return EntryPresentation.project(registry.descriptorForId(entryId))
  }

  static fromPackageName(
    packageName: PackageName,
    registry: EntryRegistry = EntryRegistry.current()
  ): Option.Option<EntryPresentation> {
    return registry.descriptorForPackageName(packageName).pipe(Option.map(EntryPresentation.project))
  }

  visibleInReleaseStage(stage: ReleaseStage): boolean {
    return stage === "preview" || this.releaseState === "published"
  }
}

export class EntryRunIdentity extends Schema.Class<EntryRunIdentity>("EntryRunIdentity")({
  id: EntryIdSchema,
  packageName: PackageNameSchema
}) {
  static project(descriptor: AnyEntryDescriptor): EntryRunIdentity {
    return EntryRunIdentity.make({
      id: descriptor.entryId,
      packageName: descriptor.packageName
    })
  }

  static fromEntryId(entryId: EntryId, registry: EntryRegistry = EntryRegistry.current()): EntryRunIdentity {
    return EntryRunIdentity.project(registry.descriptorForId(entryId))
  }
}
