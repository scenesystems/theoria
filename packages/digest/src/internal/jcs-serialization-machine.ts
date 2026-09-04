/** Cooperative JCS value, key, and string serialization. @internal */

import { Array as Arr, Either, MutableHashSet, MutableRef, Option, Record } from "effect"

import { classifyPrimitive, reflect } from "./admission.js"
import { startObject } from "./jcs-admission-machine.js"
import type { Frame, State } from "./jcs-model.js"
import { emit, fail, push, ref } from "./jcs-model.js"
import { unicodeFaultAt } from "./unicode.js"

const SHORT_ESCAPES: Readonly<Record<string, string>> = {
  "\b": "\\b",
  "\t": "\\t",
  "\n": "\\n",
  "\f": "\\f",
  "\r": "\\r"
}
const escapeUnit = (text: string, at: number): string => {
  const character = text.charAt(at)
  if (character === "\"") return "\\\""
  if (character === "\\") return "\\\\"
  return Option.getOrElse(Record.get(SHORT_ESCAPES, character), () => {
    const code = text.charCodeAt(at)
    return code < 0x20 ? `\\u${code.toString(16).padStart(4, "0")}` : character
  })
}
const scalarWidth = (text: string, at: number): number => {
  const code = text.charCodeAt(at)
  return code >= 0xd800 && code <= 0xdbff ? 2 : 1
}

const checkKey = (state: State, frame: Extract<Frame, { _tag: "Keys" }>, key: string): void => {
  const code = MutableRef.get(frame.code)
  if (code === key.length) {
    MutableRef.update(frame.entry, (entry) => entry + 1)
    MutableRef.set(frame.code, 0)
    return push(state, frame)
  }
  const fault = unicodeFaultAt(key, code)
  if (Option.isSome(fault)) return fail(state, fault.value)
  MutableRef.set(frame.code, code + scalarWidth(key, code))
  push(state, frame)
}

export const processKeys = (state: State, frame: Extract<Frame, { _tag: "Keys" }>): void =>
  Option.match(Arr.get(frame.entries, MutableRef.get(frame.entry)), {
    onNone: () => {
      if (!emit(state, "{")) return
      push(state, { _tag: "RecordCursor", identity: frame.identity, entries: frame.entries, at: ref(0) })
    },
    onSome: (entry) => checkKey(state, frame, entry.key)
  })

export const processString = (state: State, frame: Extract<Frame, { _tag: "String" }>): void => {
  const at = MutableRef.get(frame.at)
  if (at === frame.text.length) {
    emit(state, `"${frame.suffix}`)
    return
  }
  const fault = unicodeFaultAt(frame.text, at)
  if (Option.isSome(fault)) return fail(state, fault.value)
  const width = scalarWidth(frame.text, at)
  if (!emit(state, width === 2 ? frame.text.slice(at, at + 2) : escapeUnit(frame.text, at))) return
  MutableRef.set(frame.at, at + width)
  push(state, frame)
}

type Cursor = Extract<Frame, { _tag: "ArrayCursor" | "RecordCursor" }>

const closeCursor = (state: State, frame: Cursor, token: "]" | "}"): void =>
  push(state, { _tag: "Close", identity: frame.identity, token })

/** Emits the separator and moves the cursor past `at`; `false` when the byte budget stopped the machine. */
const advanceCursor = (state: State, frame: Cursor, at: number): boolean => {
  if (at > 0 && !emit(state, ",")) return false
  MutableRef.set(frame.at, at + 1)
  push(state, frame)
  return true
}

export const processCursor = (state: State, frame: Cursor): void => {
  const at = MutableRef.get(frame.at)
  if (frame._tag === "ArrayCursor") {
    return Option.match(Arr.get(frame.values, at), {
      onNone: () => closeCursor(state, frame, "]"),
      onSome: (value) => {
        if (!advanceCursor(state, frame, at)) return
        push(state, { _tag: "Visit", value })
      }
    })
  }
  Option.match(Arr.get(frame.entries, at), {
    onNone: () => closeCursor(state, frame, "}"),
    onSome: (entry) => {
      if (!advanceCursor(state, frame, at) || !emit(state, "\"")) return
      push(state, { _tag: "Visit", value: entry.value })
      push(state, { _tag: "String", text: entry.key, at: ref(0), suffix: ":" })
    }
  })
}

export const processVisit = (state: State, frame: Extract<Frame, { _tag: "Visit" }>): void => {
  const result = classifyPrimitive(frame.value)
  if (Either.isLeft(result)) return fail(state, result.left)
  const value = result.right
  if (value._tag === "Object") return startObject(state, value.value)
  if (value._tag === "String") {
    if (!emit(state, "\"")) return
    return push(state, { _tag: "String", text: value.value, at: ref(0), suffix: "" })
  }
  emit(
    state,
    value._tag === "Null" ? "null" : value._tag === "Boolean" ?
      (value.value ? "true" : "false")
      : Object.is(value.value, -0)
      ? "0"
      : String(value.value)
  )
}

export const processClose = (state: State, frame: Extract<Frame, { _tag: "Close" }>): void => {
  if (!emit(state, frame.token)) return
  const removed = reflect(() => MutableHashSet.remove(state.active, frame.identity))
  if (Either.isLeft(removed)) fail(state, removed.left)
}
