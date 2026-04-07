/**
 * Deterministic redaction and review helpers for normalized open-agent-trace records.
 *
 * @since 0.2.0
 */
import { Effect, Match, Option, Schema } from "effect"

import { noFindings, redactText } from "./redactionEngine.js"
import type { OpenAgentTraceContentBlock, OpenAgentTraceEvent, OpenAgentTraceRedactionFinding } from "./schema.js"
import { OpenAgentTraceRecord, OpenAgentTraceReviewStatus, type PiShareHfReviewSidecar } from "./schema.js"

const OpenAgentTraceLiteralSecret = Schema.Struct({
  secretId: Schema.String,
  secretValue: Schema.RedactedFromSelf(Schema.NonEmptyString),
  replacementToken: Schema.String
})

const OpenAgentTraceCuratedPattern = Schema.Literal("anthropic-api-key", "github-pat", "openai-api-key")

/**
 * Deterministic policy surface for literal and curated-pattern redaction.
 *
 * @since 0.2.0
 * @category models
 */
export class OpenAgentTraceRedactionPolicy
  extends Schema.Class<OpenAgentTraceRedactionPolicy>("OpenAgentTraceRedactionPolicy")({
    policyId: Schema.String,
    policyVersion: Schema.Number,
    imageHandling: Schema.Literal("keep-images", "drop-images"),
    literalSecrets: Schema.Array(OpenAgentTraceLiteralSecret),
    curatedPatterns: Schema.Array(OpenAgentTraceCuratedPattern)
  })
{}

/**
 * Default publication-lane redaction policy for the experimental public corpus surface.
 *
 * @since 0.2.0
 * @category constructors
 */
export const defaultOpenAgentTraceRedactionPolicy = new OpenAgentTraceRedactionPolicy({
  policyId: "open-agent-trace-public-corpus",
  policyVersion: 1,
  imageHandling: "keep-images",
  literalSecrets: [],
  curatedPatterns: ["anthropic-api-key", "github-pat", "openai-api-key"]
})

const reviewStatusFrom = (
  findings: ReadonlyArray<OpenAgentTraceRedactionFinding>,
  policy: OpenAgentTraceRedactionPolicy,
  reviewSidecar?: PiShareHfReviewSidecar
) => {
  const reviewSidecarOption = Option.fromNullable(reviewSidecar)
  const semanticReviewStatus: "approved" | "manual-review-required" | "not-reviewed" = Option.match(
    reviewSidecarOption,
    {
      onNone: () => "not-reviewed",
      onSome: (value) =>
        value.semantic_review_status ??
          (value.shareable && !value.missed_sensitive_data ? "approved" : "manual-review-required")
    }
  )
  const findingsNeedManualReview = findings.some((finding) => finding.manualReviewRequired)
  const sidecarNeedsManualReview = Option.match(reviewSidecarOption, {
    onNone: () => true,
    onSome: (value) => value.missed_sensitive_data || semanticReviewStatus !== "approved"
  })

  return new OpenAgentTraceReviewStatus({
    projectionSafe: reviewSidecar?.about_project === true
      && reviewSidecar?.shareable === true
      && reviewSidecar?.missed_sensitive_data === false
      && !findingsNeedManualReview
      && semanticReviewStatus === "approved",
    manualReviewRequired: findingsNeedManualReview || sidecarNeedsManualReview,
    semanticReviewStatus,
    aboutProject: reviewSidecar?.about_project,
    shareable: reviewSidecar?.shareable,
    missedSensitiveData: reviewSidecar?.missed_sensitive_data,
    policyId: reviewSidecar?.policy_id ?? policy.policyId,
    policyVersion: reviewSidecar?.policy_version ?? policy.policyVersion,
    reviewKey: reviewSidecar?.review_key,
    promptVersion: reviewSidecar?.prompt_version
  })
}

type EncodedOpenAgentTraceContentBlock = typeof OpenAgentTraceContentBlock.Encoded
type EncodedOpenAgentTraceEvent = typeof OpenAgentTraceEvent.Encoded
type EncodedOpenAgentTraceRecord = typeof OpenAgentTraceRecord.Encoded

const redactEncodedBlock = (
  block: EncodedOpenAgentTraceContentBlock,
  eventId: string,
  policy: OpenAgentTraceRedactionPolicy
) =>
  Match.value(block).pipe(
    Match.when({ type: "text" }, (textBlock) =>
      Effect.map(
        redactText(textBlock.text, textBlock.blockId, eventId, policy),
        ({ findings, redactionRefs, text }) => ({
          findings,
          value: { ...textBlock, redactionRefs, text }
        })
      )),
    Match.when({ type: "thinking" }, (thinkingBlock) =>
      Effect.map(
        redactText(thinkingBlock.thinking, thinkingBlock.blockId, eventId, policy),
        ({ findings, redactionRefs, text }) => ({
          findings,
          value: { ...thinkingBlock, redactionRefs, thinking: text }
        })
      )),
    Match.orElse((untouchedBlock) => Effect.succeed({ findings: noFindings, value: untouchedBlock }))
  )

const redactEncodedBlocks = (
  blocks: ReadonlyArray<EncodedOpenAgentTraceContentBlock>,
  eventId: string,
  policy: OpenAgentTraceRedactionPolicy
) =>
  Effect.map(
    Effect.forEach(blocks, (block) => redactEncodedBlock(block, eventId, policy), { concurrency: 1 }),
    (results) => ({
      blocks: results.map((result) => result.value),
      findings: results.flatMap((result) => result.findings)
    })
  )

const redactEncodedEvent = (
  event: EncodedOpenAgentTraceEvent,
  policy: OpenAgentTraceRedactionPolicy
) =>
  Match.value(event).pipe(
    Match.when({ eventKind: "message" }, (messageEvent) =>
      Effect.gen(function*() {
        const contentBlocks = yield* redactEncodedBlocks(messageEvent.contentBlocks, messageEvent.eventId, policy)
        const errorMessage = yield* Option.match(Option.fromNullable(messageEvent.errorMessage), {
          onNone: () => Effect.succeed({ findings: noFindings, text: undefined }),
          onSome: (value) => redactText(value, `${messageEvent.eventId}:errorMessage`, messageEvent.eventId, policy)
        })

        return {
          findings: [...contentBlocks.findings, ...errorMessage.findings],
          value: {
            ...messageEvent,
            contentBlocks: contentBlocks.blocks,
            errorMessage: errorMessage.text
          }
        }
      })),
    Match.when({ eventKind: "custom-message" }, (metadataEvent) =>
      Effect.gen(function*() {
        const redactedBlocks = yield* Option.match(Option.fromNullable(metadataEvent.contentBlocks), {
          onNone: () => Effect.succeed({ blocks: undefined, findings: noFindings }),
          onSome: (blocks) =>
            redactEncodedBlocks(blocks, metadataEvent.eventId, policy).pipe(
              Effect.map(({ blocks: nextBlocks, findings }) => ({ blocks: nextBlocks, findings }))
            )
        })

        return {
          findings: redactedBlocks.findings,
          value: {
            ...metadataEvent,
            contentBlocks: redactedBlocks.blocks
          }
        }
      })),
    Match.when({ eventKind: "bash-execution" }, (runtimeEvent) =>
      Effect.gen(function*() {
        const outputText = yield* Option.match(Option.fromNullable(runtimeEvent.outputText), {
          onNone: () => Effect.succeed({ findings: noFindings, text: undefined }),
          onSome: (value) => redactText(value, `${runtimeEvent.eventId}:outputText`, runtimeEvent.eventId, policy)
        })

        return {
          findings: outputText.findings,
          value: {
            ...runtimeEvent,
            outputText: outputText.text
          }
        }
      })),
    Match.when({ eventKind: "compaction" }, (summaryEvent) =>
      Effect.map(
        redactText(summaryEvent.summaryText, `${summaryEvent.eventId}:summaryText`, summaryEvent.eventId, policy),
        ({ findings, text }) => ({ findings, value: { ...summaryEvent, summaryText: text } })
      )),
    Match.when({ eventKind: "branch-summary" }, (summaryEvent) =>
      Effect.map(
        redactText(summaryEvent.summaryText, `${summaryEvent.eventId}:summaryText`, summaryEvent.eventId, policy),
        ({ findings, text }) => ({ findings, value: { ...summaryEvent, summaryText: text } })
      )),
    Match.orElse((untouchedEvent) => Effect.succeed({ findings: noFindings, value: untouchedEvent }))
  )

/**
 * Redacts normalized text surfaces deterministically and derives typed review status.
 *
 * @since 0.2.0
 * @category combinators
 */
export const redactOpenAgentTraceRecord = (options: {
  readonly record: OpenAgentTraceRecord
  readonly policy?: OpenAgentTraceRedactionPolicy
  readonly reviewSidecar?: PiShareHfReviewSidecar
}) =>
  Effect.gen(function*() {
    const policy = options.policy ?? defaultOpenAgentTraceRedactionPolicy
    const encoded: EncodedOpenAgentTraceRecord = yield* Schema.encode(OpenAgentTraceRecord)(options.record)
    const redactedEvents = yield* Effect.forEach(encoded.events, (event) => redactEncodedEvent(event, policy), {
      concurrency: 1
    })
    const redactionFindings = redactedEvents.flatMap((result) => result.findings)
    const reviewStatus = yield* Schema.encode(OpenAgentTraceReviewStatus)(
      reviewStatusFrom(redactionFindings, policy, options.reviewSidecar)
    )

    return yield* Schema.decodeUnknown(OpenAgentTraceRecord)({
      ...encoded,
      events: redactedEvents.map((result) => result.value),
      redactionFindings,
      reviewStatus
    })
  })
