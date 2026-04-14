/**
 * Content-block normalization helpers for the `pi-mono` adapter.
 *
 * @since 0.2.0
 */
import { digest } from "@scenesystems/digest"
import { Array as Arr, Effect, Match, Schema } from "effect"

import type { FieldRecord } from "../../contracts/FieldValue.js"
import { decodeOpenAgentTraceContentDigest, OpenAgentTraceBlockId, OpenAgentTraceContentBlock } from "../schema.js"

type RawPiContentBlock = Readonly<Record<string, unknown>>
type NormalizedContentBlock = Schema.Schema.Type<typeof OpenAgentTraceContentBlock>

const decodeBlockId = (value: string) => Schema.decode(OpenAgentTraceBlockId)(value)
const decodeContentBlock = Schema.decodeUnknown(OpenAgentTraceContentBlock)
const singleBlock = (block: NormalizedContentBlock): ReadonlyArray<NormalizedContentBlock> => [block]

const textBlock = (eventId: string, text: string) =>
  Effect.flatMap(decodeBlockId(`${eventId}:text`), (blockId) => decodeContentBlock({ type: "text", blockId, text }))

const thinkingBlock = (eventId: string, thinking: string) =>
  Effect.flatMap(
    decodeBlockId(`${eventId}:thinking`),
    (blockId) => decodeContentBlock({ type: "thinking", blockId, thinking })
  )

const imageBlock = (eventId: string, mimeType: string, data: string) =>
  Effect.gen(function*() {
    const contentDigest = yield* Effect.flatMap(digest("blake3-256", data), decodeOpenAgentTraceContentDigest)
    const blockId = yield* decodeBlockId(`${eventId}:image:${contentDigest.digest}`)

    return yield* decodeContentBlock({ type: "image", blockId, mimeType, contentDigest })
  })

const toolCallBlock = (eventId: string, toolCallId: string, toolName: string, argumentsValue: FieldRecord) =>
  Effect.flatMap(decodeBlockId(`${eventId}:toolCall:${toolCallId}`), (blockId) =>
    decodeContentBlock({
      type: "toolCall",
      blockId,
      toolCallId,
      toolName,
      arguments: argumentsValue
    }))

const unknownFieldRecord: FieldRecord = {}

const normalizeRawBlock = (eventId: string, index: number, block: RawPiContentBlock) =>
  Match.value(block.type).pipe(
    Match.when("text", () =>
      Effect.map(textBlock(`${eventId}:${index}`, typeof block.text === "string" ? block.text : ""), singleBlock)),
    Match.when("image", () =>
      Effect.map(
        imageBlock(
          `${eventId}:${index}`,
          typeof block.mimeType === "string" ? block.mimeType : "application/octet-stream",
          typeof block.data === "string" ? block.data : ""
        ),
        singleBlock
      )),
    Match.when("thinking", () =>
      Effect.map(
        thinkingBlock(`${eventId}:${index}`, typeof block.thinking === "string" ? block.thinking : ""),
        singleBlock
      )),
    Match.when("toolCall", () =>
      Effect.map(
        toolCallBlock(
          `${eventId}:${index}`,
          typeof block.id === "string" ? block.id : `${eventId}:${index}:tool`,
          typeof block.name === "string" ? block.name : "tool",
          unknownFieldRecord
        ),
        singleBlock
      )),
    Match.orElse(() =>
      Effect.succeed(Arr.empty<NormalizedContentBlock>())
    )
  )

/**
 * Normalizes raw `pi` content into deterministic open-agent-trace blocks.
 *
 * @since 0.2.0
 * @category combinators
 */
export const normalizeContent = (eventId: string, content: unknown) =>
  typeof content === "string"
    ? Effect.map(textBlock(eventId, content), singleBlock)
    : Arr.isArray(content)
    ? Effect.map(
      Effect.forEach(
        content,
        (block, index) =>
          typeof block === "object" && block !== null && "type" in block
            ? normalizeRawBlock(eventId, index, block)
            : Effect.succeed(Arr.empty<NormalizedContentBlock>()),
        { concurrency: 1 }
      ),
      (normalizedBlocks) => normalizedBlocks.flatMap((value) => value)
    )
    : Effect.succeed(Arr.empty<NormalizedContentBlock>())
