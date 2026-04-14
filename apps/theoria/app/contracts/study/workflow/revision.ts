import { ContentDigest, Digest256 } from "@scenesystems/digest"
import { Effect, Schema } from "effect"
import { WorkflowExecutionRecordSchema, WorkflowKindSchema } from "effect-inference/Contracts"

import { WorkflowSeedIdSchema } from "./manifest.js"

const NonEmptyString = Schema.String.pipe(Schema.minLength(1))
const TaggedDigestString = Schema.String.pipe(Schema.pattern(/^(blake3-256|sha256):[A-Za-z0-9_-]{43}$/u))

export const WorkflowReferenceSourceKind = Schema.Literal("fixture", "open-agent-trace")

export type WorkflowReferenceSourceKind = Schema.Schema.Type<typeof WorkflowReferenceSourceKind>

export class WorkflowReference extends Schema.Class<WorkflowReference>("WorkflowReference")({
  seedId: WorkflowSeedIdSchema,
  sourceKind: WorkflowReferenceSourceKind
}) {}

export class WorkflowRevision extends Schema.Class<WorkflowRevision>("WorkflowRevision")({
  reference: WorkflowReference,
  revisionDigest: ContentDigest,
  title: NonEmptyString,
  summary: NonEmptyString,
  workflowKind: WorkflowKindSchema,
  executionRecord: WorkflowExecutionRecordSchema
}) {}

const digestAlgorithmFrom = (value: string): Schema.Schema.Type<typeof ContentDigest>["algorithm"] =>
  value.startsWith("blake3-256:") ? "blake3-256" : "sha256"

const digestValueFrom = (value: string): string => value.slice(value.indexOf(":") + 1)

export const decodeWorkflowRevisionDigest = (value: string) =>
  Effect.gen(function*() {
    const taggedDigest = yield* Schema.decode(TaggedDigestString)(value)
    const digest = yield* Schema.decode(Digest256)(digestValueFrom(taggedDigest))

    return ContentDigest.make({
      algorithm: digestAlgorithmFrom(taggedDigest),
      digest
    })
  })

export const formatWorkflowRevisionDigest = (value: Schema.Schema.Type<typeof ContentDigest>): string =>
  `${value.algorithm}:${value.digest}`
