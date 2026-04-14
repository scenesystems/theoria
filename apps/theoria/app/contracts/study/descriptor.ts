import { Data, Schema } from "effect"

import { type EntryId as EntryIdType } from "../entry/id.js"

import type { StudyId as StudyIdType } from "./id.js"

const NonEmptyString = Schema.String.pipe(Schema.minLength(1))

type StudyDraftValue<Entry extends EntryIdType, SeedId extends string, Input, Controls> = {
  readonly entryId: Entry
  readonly seedId: SeedId
  readonly input: Input
  readonly controls: Controls
}

type EncodedStudyDraftValue<Entry extends EntryIdType, SeedId extends string, EncodedInput, EncodedControls> = {
  readonly entryId: Entry
  readonly seedId: SeedId
  readonly input: EncodedInput
  readonly controls: EncodedControls
}

type StudyRunRequestValue<Entry extends EntryIdType, SeedId extends string, Input, Controls> = {
  readonly runToken: string
  readonly draft: StudyDraftValue<Entry, SeedId, Input, Controls>
}

type EncodedStudyRunRequestValue<
  Entry extends EntryIdType,
  SeedId extends string,
  EncodedInput,
  EncodedControls
> = {
  readonly runToken: string
  readonly draft: EncodedStudyDraftValue<Entry, SeedId, EncodedInput, EncodedControls>
}

export class StudyDescriptor<
  Input,
  EncodedInput,
  Controls,
  EncodedControls,
  SeedId extends string = string,
  Entry extends EntryIdType = EntryIdType,
  Study extends StudyIdType = StudyIdType
> extends Data.Class<StudyDescriptor.Shape<Input, EncodedInput, Controls, EncodedControls, SeedId, Entry, Study>> {
  static make<
    Entry extends EntryIdType,
    Study extends StudyIdType,
    Input,
    EncodedInput,
    Controls,
    EncodedControls,
    SeedId extends string
  >({
    studyId,
    entryId,
    defaultSeedId,
    defaultInput,
    defaultControls,
    seedIdSchema,
    inputSchema,
    controlsSchema
  }: StudyDescriptor.Construction<
    Study,
    Entry,
    Input,
    EncodedInput,
    Controls,
    EncodedControls,
    SeedId
  >): StudyDescriptor<
    Input,
    EncodedInput,
    Controls,
    EncodedControls,
    SeedId,
    Entry,
    Study
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

    return new StudyDescriptor({
      studyId,
      entryId,
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

  defaultDraft(): StudyDraftValue<Entry, SeedId, Input, Controls> {
    return {
      entryId: this.defaultDraftValue.entryId,
      seedId: this.defaultDraftValue.seedId,
      input: this.defaultDraftValue.input,
      controls: this.defaultDraftValue.controls
    }
  }
}

export namespace StudyDescriptor {
  export interface Shape<
    Input,
    EncodedInput,
    Controls,
    EncodedControls,
    SeedId extends string = string,
    Entry extends EntryIdType = EntryIdType,
    Study extends StudyIdType = StudyIdType
  > {
    readonly studyId: Study
    readonly entryId: Entry
    readonly defaultDraftValue: StudyDraftValue<Entry, SeedId, Input, Controls>
    readonly inputSchema: Schema.Schema<Input, EncodedInput>
    readonly controlsSchema: Schema.Schema<Controls, EncodedControls>
    readonly draftSchema: Schema.Schema<
      StudyDraftValue<Entry, SeedId, Input, Controls>,
      EncodedStudyDraftValue<Entry, SeedId, EncodedInput, EncodedControls>
    >
    readonly runRequestSchema: Schema.Schema<
      StudyRunRequestValue<Entry, SeedId, Input, Controls>,
      EncodedStudyRunRequestValue<Entry, SeedId, EncodedInput, EncodedControls>
    >
    readonly encodeDraftJson: (draft: StudyDraftValue<Entry, SeedId, Input, Controls>) => string
  }

  export interface Construction<
    Study extends StudyIdType,
    Entry extends EntryIdType,
    Input,
    EncodedInput,
    Controls,
    EncodedControls,
    SeedId extends string
  > {
    readonly studyId: Study
    readonly entryId: Entry
    readonly defaultSeedId: SeedId
    readonly defaultInput: Input
    readonly defaultControls: Controls
    readonly seedIdSchema: Schema.Schema<SeedId>
    readonly inputSchema: Schema.Schema<Input, EncodedInput>
    readonly controlsSchema: Schema.Schema<Controls, EncodedControls>
  }
}
