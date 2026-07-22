/** Cooperative JCS value, key, and string serialization. @internal */

import { Either, MutableHashSet, MutableRef, Option } from "effect"

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
  const character = text[at]!
  if (character === "\"") return "\\\""
  if (character === "\\") return "\\\\"
  if (Object.hasOwn(SHORT_ESCAPES, character)) return SHORT_ESCAPES[character]!
  const code = text.charCodeAt(at)
  return code < 0x20 ? `\\u${code.toString(16).padStart(4, "0")}` : character
}
const scalarWidth = (text: string, at: number): number => {
  const code = text.charCodeAt(at)
  return code >= 0xd800 && code <= 0xdbff ? 2 : 1
}

export const processKeys = (state: State, frame: Extract<Frame, { _tag: "Keys" }>): void => {
  const entry = MutableRef.get(frame.entry)
  if (entry === frame.entries.length) {
    emit(state, "{")
    return push(state, { _tag: "RecordCursor", identity: frame.identity, entries: frame.entries, at: ref(0) })
  }
  const key = frame.entries[entry]!.key, code = MutableRef.get(frame.code)
  if (code === key.length) {
    MutableRef.set(frame.entry, entry + 1)
    MutableRef.set(frame.code, 0)
    return push(state, frame)
  }
  const fault = unicodeFaultAt(key, code)
  if (Option.isSome(fault)) return fail(state, fault.value)
  MutableRef.set(frame.code, code + scalarWidth(key, code))
  push(state, frame)
}

export const processString = (state: State, frame: Extract<Frame, { _tag: "String" }>): void => {
  const at = MutableRef.get(frame.at)
  if (at === frame.text.length) return emit(state, `"${frame.suffix}`)
  const fault = unicodeFaultAt(frame.text, at)
  if (Option.isSome(fault)) return fail(state, fault.value)
  const width = scalarWidth(frame.text, at)
  emit(state, width === 2 ? frame.text.slice(at, at + 2) : escapeUnit(frame.text, at))
  MutableRef.set(frame.at, at + width)
  push(state, frame)
}

export const processCursor = (state: State, frame: Extract<Frame, { _tag: "ArrayCursor" | "RecordCursor" }>): void => {
  const at = MutableRef.get(frame.at),
    length = frame._tag === "ArrayCursor" ? frame.values.length : frame.entries.length
  if (at === length) {
    return push(state, { _tag: "Close", identity: frame.identity, token: frame._tag === "ArrayCursor" ? "]" : "}" })
  }
  if (at > 0) emit(state, ",")
  MutableRef.set(frame.at, at + 1)
  push(state, frame)
  if (frame._tag === "RecordCursor") {
    const entry = frame.entries[at]!
    push(state, { _tag: "Visit", value: entry.value })
    emit(state, "\"")
    return push(state, { _tag: "String", text: entry.key, at: ref(0), suffix: ":" })
  }
  push(state, { _tag: "Visit", value: frame.values[at] })
}

export const processVisit = (state: State, frame: Extract<Frame, { _tag: "Visit" }>): void => {
  const result = classifyPrimitive(frame.value)
  if (Either.isLeft(result)) return fail(state, result.left)
  const value = result.right
  if (value._tag === "Object") return startObject(state, value.value)
  if (value._tag === "String") {
    emit(state, "\"")
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
  emit(state, frame.token)
  const removed = reflect(() => MutableHashSet.remove(state.active, frame.identity))
  if (Either.isLeft(removed)) fail(state, removed.left)
}
