import type { Effect } from "effect"
import { Schema } from "effect"

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

export const EntrySeed = Schema.Struct({
  seedId: NonEmptyString,
  label: NonEmptyString,
  summary: NonEmptyString
})

export type EntrySeed = typeof EntrySeed.Type

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

export type EntryDescriptor<
  Input,
  EncodedInput,
  Controls,
  EncodedControls,
  SeedId extends string = string,
  Entry extends EntryIdType = EntryIdType
> = {
  readonly entryId: Entry
  readonly title: string
  readonly packageName: string
  readonly description: string
  readonly useCase: string
  readonly summary: string
  readonly runLabel: string
  readonly releaseState: typeof CardReleaseState.Type
  readonly path: string
  readonly interactiveLabel: string | null
  readonly primaryAuthorityId: AuthorityId
  readonly authorityIds: readonly [AuthorityId, ...Array<AuthorityId>]
  readonly seeds: ReadonlyArray<EntrySeed>
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

export const makeEntryDescriptor = <
  Entry extends EntryIdType,
  Input,
  EncodedInput,
  Controls,
  EncodedControls,
  SeedId extends string
>({
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
  primaryAuthorityId,
  authorityIds,
  seeds,
  seedIdSchema,
  inputSchema,
  controlsSchema
}: {
  readonly entryId: Entry
  readonly title: string
  readonly packageName: string
  readonly description: string
  readonly useCase: string
  readonly summary: string
  readonly runLabel: string
  readonly releaseState: typeof CardReleaseState.Type
  readonly path: string
  readonly interactiveLabel: string | null
  readonly primaryAuthorityId: AuthorityId
  readonly authorityIds: readonly [AuthorityId, ...Array<AuthorityId>]
  readonly seeds: ReadonlyArray<EntrySeed>
  readonly seedIdSchema: Schema.Schema<SeedId>
  readonly inputSchema: Schema.Schema<Input, EncodedInput>
  readonly controlsSchema: Schema.Schema<Controls, EncodedControls>
}): EntryDescriptor<Input, EncodedInput, Controls, EncodedControls, SeedId, Entry> => {
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

  return {
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
    primaryAuthorityId,
    authorityIds,
    seeds,
    inputSchema,
    controlsSchema,
    draftSchema,
    runRequestSchema,
    encodeDraftJson: Schema.encodeSync(draftJsonSchema)
  }
}

export const defaultEntrySeeds = (summary: string): ReadonlyArray<EntrySeed> => [
  {
    seedId: "default",
    label: "Authored default",
    summary
  }
]

const EntryDescriptorFingerprintFields = Schema.Struct({
  entryId: EntryId,
  title: NonEmptyString,
  packageName: NonEmptyString,
  description: NonEmptyString,
  useCase: NonEmptyString,
  summary: NonEmptyString,
  runLabel: NonEmptyString,
  releaseState: CardReleaseState,
  path: NonEmptyString,
  interactiveLabel: Schema.NullOr(NonEmptyString),
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
  primaryAuthorityId: descriptor.primaryAuthorityId,
  authorityIds: descriptor.authorityIds,
  seeds: descriptor.seeds
})

export const entryDescriptorFingerprint = <
  Input,
  EncodedInput,
  Controls,
  EncodedControls,
  SeedId extends string,
  Entry extends EntryIdType
>(
  descriptor: EntryDescriptor<Input, EncodedInput, Controls, EncodedControls, SeedId, Entry>
): Effect.Effect<DurableFingerprint, never, never> =>
  fingerprintOf(encodeEntryDescriptorFingerprintFields(entryDescriptorFingerprintFieldsFor(descriptor)))
