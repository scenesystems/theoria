/**
 * Stack-safe RFC 8785 canonical serializer.
 *
 * @internal
 */

import { Array as Arr, Chunk, Data, Effect, Either, HashSet, Option } from "effect"

import type { CanonicalizationError } from "../schemas/errors.js"
import { UnsupportedValue } from "../schemas/errors.js"
import { AdmittedValue, admitValue } from "./admission.js"

const escapeJsonString = (s: string): string => {
  const escaped = Arr.map(Arr.fromIterable(s), (ch) => {
    const code = ch.charCodeAt(0)
    if (ch === "\"") return "\\\""
    if (ch === "\\") return "\\\\"
    if (code < 0x20) {
      if (ch === "\n") return "\\n"
      if (ch === "\r") return "\\r"
      if (ch === "\t") return "\\t"
      if (ch === "\b") return "\\b"
      if (ch === "\f") return "\\f"
      return `\\u${code.toString(16).padStart(4, "0")}`
    }
    return ch
  })
  return `"${escaped.join("")}"`
}

const serializeNumber = (n: number): string => Object.is(n, -0) ? "0" : String(n)

type Frame =
  | { readonly _tag: "Enter"; readonly value: unknown }
  | { readonly _tag: "EmitText"; readonly text: string }
  | { readonly _tag: "CloseContainer"; readonly identity: object; readonly text: "]" | "}" }

const Frame = Data.taggedEnum<Frame>()

class SerializerState extends Data.Class<{
  readonly todo: Chunk.Chunk<Frame>
  readonly output: Chunk.Chunk<string>
  readonly active: HashSet.HashSet<object>
}> {}

const updateActive = (
  operation: () => HashSet.HashSet<object>
): Effect.Effect<HashSet.HashSet<object>, UnsupportedValue> =>
  Effect.try({
    try: operation,
    catch: () => new UnsupportedValue({ reason: "reflection-failure" })
  })

const arrayFrames = (
  values: ReadonlyArray<unknown>,
  identity: object
): Array<Frame> =>
  Arr.append(
    Arr.flatMap(values, (value, index) =>
      index === 0
        ? [Frame.Enter({ value })]
        : [Frame.EmitText({ text: "," }), Frame.Enter({ value })]),
    Frame.CloseContainer({ identity, text: "]" })
  )

const recordFrames = (
  entries: ReadonlyArray<readonly [string, unknown]>,
  identity: object
): Array<Frame> =>
  Arr.append(
    Arr.flatMap(entries, ([key, value], index) => {
      const entry = [Frame.EmitText({ text: `${escapeJsonString(key)}:` }), Frame.Enter({ value })]
      return index === 0 ? entry : Arr.prepend(entry, Frame.EmitText({ text: "," }))
    }),
    Frame.CloseContainer({ identity, text: "}" })
  )

const enterContainer = (
  state: SerializerState,
  identity: object,
  open: "[" | "{",
  frames: ReadonlyArray<Frame>
): Effect.Effect<SerializerState, UnsupportedValue> =>
  Effect.map(updateActive(() => HashSet.add(state.active, identity)), (active) =>
    new SerializerState({
      todo: Chunk.prependAll(state.todo, Chunk.fromIterable(frames)),
      output: Chunk.append(state.output, open),
      active
    }))

const processAdmitted = (
  state: SerializerState,
  admitted: AdmittedValue
): Effect.Effect<SerializerState, UnsupportedValue> =>
  AdmittedValue.$match(admitted, {
    Null: () => Effect.succeed(new SerializerState({ ...state, output: Chunk.append(state.output, "null") })),
    Boolean: ({ value }) =>
      Effect.succeed(
        new SerializerState({ ...state, output: Chunk.append(state.output, value ? "true" : "false") })
      ),
    Number: ({ value }) =>
      Effect.succeed(new SerializerState({ ...state, output: Chunk.append(state.output, serializeNumber(value)) })),
    String: ({ value }) =>
      Effect.succeed(new SerializerState({ ...state, output: Chunk.append(state.output, escapeJsonString(value)) })),
    Array: ({ identity, values }) => enterContainer(state, identity, "[", arrayFrames(values, identity)),
    Record: ({ entries, identity }) => enterContainer(state, identity, "{", recordFrames(entries, identity))
  })

const processFrame = (
  state: SerializerState,
  frame: Frame
): Effect.Effect<SerializerState, CanonicalizationError> =>
  Frame.$match(frame, {
    Enter: ({ value }) =>
      Either.match(admitValue(value, state.active), {
        onLeft: Effect.fail,
        onRight: (admitted) => processAdmitted(state, admitted)
      }),
    EmitText: ({ text }) => Effect.succeed(new SerializerState({ ...state, output: Chunk.append(state.output, text) })),
    CloseContainer: ({ identity, text }) =>
      Effect.map(updateActive(() => HashSet.remove(state.active, identity)), (active) =>
        new SerializerState({
          ...state,
          output: Chunk.append(state.output, text),
          active
        }))
  })

const serializerStep = (state: SerializerState): Effect.Effect<SerializerState, CanonicalizationError> =>
  Option.match(Chunk.head(state.todo), {
    onNone: () => Effect.succeed(state),
    onSome: (frame) => processFrame(new SerializerState({ ...state, todo: Chunk.drop(state.todo, 1) }), frame)
  })

/**
 * Serialize a value to RFC 8785 canonical JSON without call-stack growth.
 *
 * @internal
 */
export const canonicalizeValue = (
  value: unknown
): Effect.Effect<string, CanonicalizationError> =>
  Effect.map(
    Effect.iterate<SerializerState, never, CanonicalizationError>(
      new SerializerState({
        todo: Chunk.of(Frame.Enter({ value })),
        output: Chunk.empty(),
        active: HashSet.empty()
      }),
      {
        while: ({ todo }) => !Chunk.isEmpty(todo),
        body: serializerStep
      }
    ),
    ({ output }) => Chunk.join(output, "")
  )
