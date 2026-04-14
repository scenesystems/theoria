import type { PackageName } from "@theoria/source-proof/contracts"
import { PackageNameSchema } from "@theoria/source-proof/contracts"
import type { Effect } from "effect"
import { Data, Schema } from "effect"

import type { ReleaseStage } from "../release-stage.js"
import type { StudyId } from "../study/id.js"
import { type DurableFingerprint, fingerprintOf } from "./fingerprint.js"
import { AuthorityId, EntryId, type EntryId as EntryIdType } from "./id.js"

const NonEmptyString = Schema.String.pipe(Schema.minLength(1))

export const CardReleaseState = Schema.Literal("published", "coming-soon")

export type CardReleaseState = typeof CardReleaseState.Type

export class EntrySeed extends Schema.Class<EntrySeed>("EntrySeed")({
  seedId: NonEmptyString,
  label: NonEmptyString,
  summary: NonEmptyString
}) {
  static default(summary: string): EntrySeed {
    return EntrySeed.make({
      seedId: "default",
      label: "Authored default",
      summary
    })
  }
}

export class EntryProjectionHint extends Schema.Class<EntryProjectionHint>("EntryProjectionHint")({
  stage: NonEmptyString,
  evidence: NonEmptyString,
  source: NonEmptyString
}) {
  static defaults(): EntryProjectionHint {
    return EntryProjectionHint.make({
      stage: "Adjust parameters and inspect the active projection surface.",
      evidence: "Evidence appears here once this entry starts publishing a study ledger.",
      source: "Inspect the prepared and runtime program projections exactly as executed, file by file."
    })
  }
}

export class EntryDescriptor<Entry extends EntryIdType = EntryIdType> extends Data.Class<EntryDescriptor.Shape<Entry>> {
  static make<Entry extends EntryIdType>({
    entryId,
    studyId,
    title,
    packageName,
    description,
    useCase,
    summary,
    runLabel,
    releaseState,
    path,
    interactiveLabel,
    projectionHint,
    primaryAuthorityId,
    authorityIds,
    seeds
  }: EntryDescriptor.Construction<Entry>): EntryDescriptor<Entry> {
    return new EntryDescriptor({
      entryId,
      studyId,
      title,
      packageName,
      description,
      useCase,
      summary,
      runLabel,
      releaseState,
      path,
      interactiveLabel,
      projectionHint,
      primaryAuthorityId,
      authorityIds,
      seeds
    })
  }

  fingerprint(): Effect.Effect<DurableFingerprint, never, never> {
    return fingerprintOf(encodeEntryDescriptorFingerprintFields(entryDescriptorFingerprintFieldsFor(this)))
  }

  visibleInReleaseStage(stage: ReleaseStage): boolean {
    return stage === "preview" || this.releaseState === "published"
  }
}

export namespace EntryDescriptor {
  export interface Shape<Entry extends EntryIdType = EntryIdType> {
    readonly entryId: Entry
    readonly studyId: StudyId
    readonly title: string
    readonly packageName: PackageName
    readonly description: string
    readonly useCase: string
    readonly summary: string
    readonly runLabel: string
    readonly releaseState: typeof CardReleaseState.Type
    readonly path: string
    readonly interactiveLabel: string | null
    readonly projectionHint: EntryProjectionHint
    readonly primaryAuthorityId: AuthorityId
    readonly authorityIds: readonly [AuthorityId, ...Array<AuthorityId>]
    readonly seeds: ReadonlyArray<EntrySeed>
  }

  export interface Construction<Entry extends EntryIdType> {
    readonly entryId: Entry
    readonly studyId: StudyId
    readonly title: string
    readonly packageName: PackageName
    readonly description: string
    readonly useCase: string
    readonly summary: string
    readonly runLabel: string
    readonly releaseState: typeof CardReleaseState.Type
    readonly path: string
    readonly interactiveLabel: string | null
    readonly projectionHint: EntryProjectionHint
    readonly primaryAuthorityId: AuthorityId
    readonly authorityIds: readonly [AuthorityId, ...Array<AuthorityId>]
    readonly seeds: ReadonlyArray<EntrySeed>
  }
}

const EntryDescriptorFingerprintFields = Schema.Struct({
  entryId: EntryId,
  studyId: Schema.String,
  title: NonEmptyString,
  packageName: PackageNameSchema,
  description: NonEmptyString,
  useCase: NonEmptyString,
  summary: NonEmptyString,
  runLabel: NonEmptyString,
  releaseState: CardReleaseState,
  path: NonEmptyString,
  interactiveLabel: Schema.NullOr(NonEmptyString),
  projectionHint: EntryProjectionHint,
  primaryAuthorityId: AuthorityId,
  authorityIds: Schema.NonEmptyArray(AuthorityId),
  seeds: Schema.Array(EntrySeed)
})

const encodeEntryDescriptorFingerprintFields = Schema.encodeSync(EntryDescriptorFingerprintFields)

const entryDescriptorFingerprintFieldsFor = <Entry extends EntryIdType>(descriptor: EntryDescriptor<Entry>) => ({
  entryId: descriptor.entryId,
  studyId: descriptor.studyId,
  title: descriptor.title,
  packageName: descriptor.packageName,
  description: descriptor.description,
  useCase: descriptor.useCase,
  summary: descriptor.summary,
  runLabel: descriptor.runLabel,
  releaseState: descriptor.releaseState,
  path: descriptor.path,
  interactiveLabel: descriptor.interactiveLabel,
  projectionHint: descriptor.projectionHint,
  primaryAuthorityId: descriptor.primaryAuthorityId,
  authorityIds: descriptor.authorityIds,
  seeds: descriptor.seeds
})
