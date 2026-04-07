/**
 * Internal text-redaction engine for normalized open-agent-trace records.
 *
 * @since 0.2.0
 */
import { digest } from "@scenesystems/digest"
import { Array as Arr, Effect, Redacted, Schema } from "effect"

import type { OpenAgentTraceRedactionPolicy } from "./redaction.js"
import {
  decodeOpenAgentTraceContentDigest,
  OpenAgentTraceBlockId,
  OpenAgentTraceEventId,
  OpenAgentTraceFindingId,
  OpenAgentTraceRedactionFinding
} from "./schema.js"

type CuratedPatternDefinition = Readonly<{
  readonly confidence: "medium"
  readonly manualReviewRequired: true
  readonly pattern: RegExp
  readonly replacementToken: string
}>

/**
 * Internal redacted-text payload returned by the deterministic redaction engine.
 *
 * @since 0.2.0
 * @category models
 */
export type RedactedText = Readonly<{
  readonly findings: ReadonlyArray<OpenAgentTraceRedactionFinding>
  readonly redactionRefs?: ReadonlyArray<Schema.Schema.Type<typeof OpenAgentTraceFindingId>>
  readonly text: string
}>

/**
 * Empty finding set reused by deterministic redaction paths that do not modify content.
 *
 * @since 0.2.0
 * @category constants
 */
export const noFindings: ReadonlyArray<OpenAgentTraceRedactionFinding> = []

const curatedPattern = (patternId: "anthropic-api-key" | "github-pat" | "openai-api-key"): CuratedPatternDefinition =>
  patternId === "anthropic-api-key"
    ? {
      confidence: "medium",
      manualReviewRequired: true,
      pattern: /\bsk-ant-[A-Za-z0-9_-]{16,}\b/g,
      replacementToken: "[REDACTED:ANTHROPIC-API-KEY]"
    }
    : patternId === "github-pat"
    ? {
      confidence: "medium",
      manualReviewRequired: true,
      pattern: /\bghp_[A-Za-z0-9]{20,}\b/g,
      replacementToken: "[REDACTED:GITHUB-PAT]"
    }
    : {
      confidence: "medium",
      manualReviewRequired: true,
      pattern: /\bopenai-api-key:[A-Za-z0-9_-]{12,}\b/g,
      replacementToken: "[REDACTED:OPENAI-API-KEY]"
    }

const findingsForMatches = (options: {
  readonly blockId: Schema.Schema.Type<typeof OpenAgentTraceBlockId>
  readonly confidence: "high" | "medium"
  readonly eventId: Schema.Schema.Type<typeof OpenAgentTraceEventId>
  readonly findingKind: "literal-secret" | "credential-pattern"
  readonly label: string
  readonly manualReviewRequired: boolean
  readonly matches: ReadonlyArray<string>
  readonly replacementToken: string
}) =>
  Effect.forEach(
    options.matches,
    (match, index) =>
      Effect.gen(function*() {
        const findingId = yield* Schema.decode(OpenAgentTraceFindingId)(
          `${options.blockId}:${options.label}:${index + 1}`
        )
        const matchTextDigest = yield* Effect.flatMap(
          Effect.orDie(digest("blake3-256", match)),
          decodeOpenAgentTraceContentDigest
        )

        return new OpenAgentTraceRedactionFinding({
          findingId,
          findingKind: options.findingKind,
          matchTextDigest,
          replacementToken: options.replacementToken,
          blockId: options.blockId,
          eventId: options.eventId,
          confidence: options.confidence,
          manualReviewRequired: options.manualReviewRequired
        })
      }),
    {
      concurrency: 1
    }
  )

const replaceLiteralSecrets = (
  text: string,
  blockId: Schema.Schema.Type<typeof OpenAgentTraceBlockId>,
  eventId: Schema.Schema.Type<typeof OpenAgentTraceEventId>,
  policy: OpenAgentTraceRedactionPolicy
) =>
  Effect.reduce(policy.literalSecrets, { findings: noFindings, text }, (state, secret) => {
    const literalSecret = Redacted.value(secret.secretValue)
    const matches = state.text.includes(literalSecret)
      ? Arr.makeBy(state.text.split(literalSecret).length - 1, () => literalSecret)
      : []

    return Effect.map(
      findingsForMatches({
        blockId,
        confidence: "high",
        eventId,
        findingKind: "literal-secret",
        label: secret.secretId,
        manualReviewRequired: false,
        matches,
        replacementToken: secret.replacementToken
      }),
      (findings) => ({
        findings: [...state.findings, ...findings],
        text: state.text.split(literalSecret).join(secret.replacementToken)
      })
    )
  })

const replaceCuratedPatterns = (
  text: string,
  blockId: Schema.Schema.Type<typeof OpenAgentTraceBlockId>,
  eventId: Schema.Schema.Type<typeof OpenAgentTraceEventId>,
  policy: OpenAgentTraceRedactionPolicy
) =>
  Effect.reduce(policy.curatedPatterns, { findings: noFindings, text }, (state, patternId) => {
    const definition = curatedPattern(patternId)
    const matches = [...state.text.matchAll(definition.pattern)].map((match) => match[0])

    return Effect.map(
      findingsForMatches({
        blockId,
        confidence: definition.confidence,
        eventId,
        findingKind: "credential-pattern",
        label: patternId,
        manualReviewRequired: definition.manualReviewRequired,
        matches,
        replacementToken: definition.replacementToken
      }),
      (findings) => ({
        findings: [...state.findings, ...findings],
        text: state.text.replace(definition.pattern, definition.replacementToken)
      })
    )
  })

/**
 * Deterministically redacts literal secrets and curated credential patterns from one text surface.
 *
 * @since 0.2.0
 * @category combinators
 */
export const redactText = (
  text: string,
  blockId: string,
  eventId: string,
  policy: OpenAgentTraceRedactionPolicy
) =>
  Effect.gen(function*() {
    const decodedBlockId = yield* Schema.decode(OpenAgentTraceBlockId)(blockId)
    const decodedEventId = yield* Schema.decode(OpenAgentTraceEventId)(eventId)
    const literalState = yield* replaceLiteralSecrets(text, decodedBlockId, decodedEventId, policy)
    const patternState = yield* replaceCuratedPatterns(literalState.text, decodedBlockId, decodedEventId, policy)
    const findings = [...literalState.findings, ...patternState.findings]

    return {
      findings,
      ...(findings.length > 0 ? { redactionRefs: findings.map((finding) => finding.findingId) } : {}),
      text: patternState.text
    }
  })
