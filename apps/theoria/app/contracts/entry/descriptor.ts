import type { PackageName } from "@theoria/source-proof/contracts"
import { PackageNameSchema } from "@theoria/source-proof/contracts"
import type { Effect } from "effect"
import { Data, Schema } from "effect"

import type { ReleaseStage } from "../release-stage.js"
import { type DurableFingerprint, fingerprintOf } from "./fingerprint.js"
import { AuthorityId, EntryId, type EntryId as EntryIdType } from "./id.js"

const NonEmptyString = Schema.String.pipe(Schema.minLength(1))

export const EmptyStruct = Schema.Struct({})
export const DefaultSeedId = Schema.Literal("default")
export const WorkflowSeedId = Schema.Literal(
  "task-briefing",
  "chat-handoff",
  "retrieval-required",
  "render-sensitive"
)

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

type EntryDraftValue<Entry extends EntryIdType, SeedId extends string, Input, Controls> = {
  readonly entryId: Entry
  readonly seedId: SeedId
  readonly input: Input
  readonly controls: Controls
}

type EncodedEntryDraftValue<Entry extends EntryIdType, SeedId extends string, EncodedInput, EncodedControls> = {
  readonly entryId: Entry
  readonly seedId: SeedId
  readonly input: EncodedInput
  readonly controls: EncodedControls
}

type EntryRunRequestValue<Entry extends EntryIdType, SeedId extends string, Input, Controls> = {
  readonly runToken: string
  readonly draft: EntryDraftValue<Entry, SeedId, Input, Controls>
}

type EncodedEntryRunRequestValue<
  Entry extends EntryIdType,
  SeedId extends string,
  EncodedInput,
  EncodedControls
> = {
  readonly runToken: string
  readonly draft: EncodedEntryDraftValue<Entry, SeedId, EncodedInput, EncodedControls>
}

export class EntryDescriptor<
  Input,
  EncodedInput,
  Controls,
  EncodedControls,
  SeedId extends string = string,
  Entry extends EntryIdType = EntryIdType
> extends Data.Class<EntryDescriptor.Shape<Input, EncodedInput, Controls, EncodedControls, SeedId, Entry>> {
  static make<Entry extends EntryIdType, Input, EncodedInput, Controls, EncodedControls, SeedId extends string>({
    entryId,
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
    seeds,
    defaultSeedId,
    defaultInput,
    defaultControls,
    seedIdSchema,
    inputSchema,
    controlsSchema
  }: EntryDescriptor.Construction<Entry, Input, EncodedInput, Controls, EncodedControls, SeedId>): EntryDescriptor<
    Input,
    EncodedInput,
    Controls,
    EncodedControls,
    SeedId,
    Entry
  > {
    const draftSchema = Schema.Struct({
      entryId: Schema.Literal(entryId),
      seedId: seedIdSchema,
      input: inputSchema,
      controls: controlsSchema
    })

    const runRequestSchema = Schema.Struct({
      runToken: NonEmptyString,
      draft: draftSchema
    })

    const draftJsonSchema = Schema.parseJson(draftSchema)

    return new EntryDescriptor({
      entryId,
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
      seeds,
      defaultDraftValue: {
        entryId,
        seedId: defaultSeedId,
        input: defaultInput,
        controls: defaultControls
      },
      inputSchema,
      controlsSchema,
      draftSchema,
      runRequestSchema,
      encodeDraftJson: Schema.encodeSync(draftJsonSchema)
    })
  }

  defaultSeedId(): SeedId {
    return this.defaultDraftValue.seedId
  }

  defaultInput(): Input {
    return this.defaultDraftValue.input
  }

  defaultControls(): Controls {
    return this.defaultDraftValue.controls
  }

  defaultDraft(): EntryDraftValue<Entry, SeedId, Input, Controls> {
    return {
      entryId: this.defaultDraftValue.entryId,
      seedId: this.defaultDraftValue.seedId,
      input: this.defaultDraftValue.input,
      controls: this.defaultDraftValue.controls
    }
  }

  fingerprint(): Effect.Effect<DurableFingerprint, never, never> {
    return fingerprintOf(encodeEntryDescriptorFingerprintFields(entryDescriptorFingerprintFieldsFor(this)))
  }

  visibleInReleaseStage(stage: ReleaseStage): boolean {
    return stage === "preview" || this.releaseState === "published"
  }
}

export namespace EntryDescriptor {
  export interface Shape<
    Input,
    EncodedInput,
    Controls,
    EncodedControls,
    SeedId extends string = string,
    Entry extends EntryIdType = EntryIdType
  > {
    readonly entryId: Entry
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
    readonly defaultDraftValue: EntryDraftValue<Entry, SeedId, Input, Controls>
    readonly inputSchema: Schema.Schema<Input, EncodedInput>
    readonly controlsSchema: Schema.Schema<Controls, EncodedControls>
    readonly draftSchema: Schema.Schema<
      EntryDraftValue<Entry, SeedId, Input, Controls>,
      EncodedEntryDraftValue<Entry, SeedId, EncodedInput, EncodedControls>
    >
    readonly runRequestSchema: Schema.Schema<
      EntryRunRequestValue<Entry, SeedId, Input, Controls>,
      EncodedEntryRunRequestValue<Entry, SeedId, EncodedInput, EncodedControls>
    >
    readonly encodeDraftJson: (draft: EntryDraftValue<Entry, SeedId, Input, Controls>) => string
  }

  export interface Construction<
    Entry extends EntryIdType,
    Input,
    EncodedInput,
    Controls,
    EncodedControls,
    SeedId extends string
  > {
    readonly entryId: Entry
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
    readonly defaultSeedId: SeedId
    readonly defaultInput: Input
    readonly defaultControls: Controls
    readonly seedIdSchema: Schema.Schema<SeedId>
    readonly inputSchema: Schema.Schema<Input, EncodedInput>
    readonly controlsSchema: Schema.Schema<Controls, EncodedControls>
  }
}

const EntryDescriptorFingerprintFields = Schema.Struct({
  entryId: EntryId,
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

const entryDescriptorFingerprintFieldsFor = <
  Input,
  EncodedInput,
  Controls,
  EncodedControls,
  SeedId extends string,
  Entry extends EntryIdType
>(
  descriptor: EntryDescriptor<Input, EncodedInput, Controls, EncodedControls, SeedId, Entry>
) => ({
  entryId: descriptor.entryId,
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
