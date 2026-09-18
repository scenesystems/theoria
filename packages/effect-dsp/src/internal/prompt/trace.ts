/**
 * Prompt-to-trace text projection.
 *
 * @since 0.1.0
 * @internal
 */
import * as Prompt from "@effect/ai/Prompt"
import { Array as Arr, Effect, Match, Schema } from "effect"
import { TraceError } from "../../DspError.js"

const partText = Match.type<Prompt.Part>().pipe(
  Match.discriminatorsExhaustive("type")({
    text: (part) => Effect.succeed(part.text),
    reasoning: (part) => Effect.succeed(part.text),
    file: Schema.encode(Schema.parseJson(Prompt.FilePart)),
    "tool-call": Schema.encode(Schema.parseJson(Prompt.ToolCallPart)),
    "tool-result": Schema.encode(Schema.parseJson(Prompt.ToolResultPart))
  })
)

const partsText = (parts: Iterable<Prompt.Part>) => Effect.forEach(parts, partText).pipe(Effect.map(Arr.join("\n")))

const messageText = Match.type<Prompt.Message>().pipe(
  Match.discriminatorsExhaustive("role")({
    system: (message) => Effect.succeed(message.content),
    user: (message) => partsText(message.content),
    assistant: (message) => partsText(message.content),
    tool: (message) => partsText(message.content)
  })
)

/**
 * Normalizes native or encoded prompts and retains structured parts in trace
 * text. Serialization failures remain checked trace-projection failures.
 *
 * @since 0.1.0
 * @category formatters
 * @internal
 */
export const promptToTraceText = (prompt: Prompt.RawInput): Effect.Effect<string, TraceError> =>
  Effect.forEach(Prompt.make(prompt).content, messageText).pipe(
    Effect.map(Arr.join("\n\n")),
    Effect.mapError(() => new TraceError({ message: "Prompt could not be serialized for tracing" }))
  )
