/** Cooperative descriptor admission and record sorting. @internal */

import { Either, MutableHashSet, MutableRef, Option } from "effect"

import { CyclicValue } from "../schemas/errors.js"
import { classifyContainer, ownKeys, reflect, rejection, snapshot } from "./admission.js"
import type { Frame, State } from "./jcs-model.js"
import { emit, fail, indexBelow, push, ref } from "./jcs-model.js"

export const startObject = (state: State, value: object): void => {
  const result = classifyContainer(value)
  if (Either.isLeft(result)) return fail(state, result.left)
  const keys = ownKeys(result.right.identity)
  if (Either.isLeft(keys)) return fail(state, keys.left)
  push(state, { _tag: "Symbols", container: result.right, keys: keys.right, at: ref(0) })
}

export const processSymbols = (state: State, frame: Extract<Frame, { _tag: "Symbols" }>): void => {
  const at = MutableRef.get(frame.at)
  if (at === frame.keys.length) {
    const cycle = reflect(() => MutableHashSet.has(state.active, frame.container.identity))
    if (Either.isLeft(cycle)) return fail(state, cycle.left)
    if (cycle.right) return fail(state, new CyclicValue())
    const added = reflect(() => MutableHashSet.add(state.active, frame.container.identity))
    if (Either.isLeft(added)) return fail(state, added.left)
    return push(state, {
      _tag: "Descriptors",
      container: frame.container,
      keys: frame.keys,
      entries: [],
      at: ref(0),
      accessor: ref(false),
      hidden: ref(false),
      length: ref(Option.none())
    })
  }
  if (typeof frame.keys[at] === "symbol") return fail(state, rejection("symbol-property"))
  MutableRef.set(frame.at, at + 1)
  push(state, frame)
}

const finishDescriptors = (state: State, frame: Extract<Frame, { _tag: "Descriptors" }>): void => {
  if (MutableRef.get(frame.accessor)) return fail(state, rejection("accessor-property"))
  if (frame.container._tag === "Record") {
    if (MutableRef.get(frame.hidden)) return fail(state, rejection("non-enumerable-property"))
    const buffer = new Array(frame.entries.length)
    return push(state, {
      _tag: "Sort",
      identity: frame.container.identity,
      entries: frame.entries,
      buffer,
      source: ref(frame.entries),
      target: ref(buffer),
      width: ref(1),
      left: ref(0),
      i: ref(0),
      j: ref(Math.min(1, frame.entries.length)),
      k: ref(0)
    })
  }
  const length = MutableRef.get(frame.length)
  if (Option.isNone(length)) return fail(state, rejection("reflection-failure"))
  push(state, {
    _tag: "ArrayCheck",
    identity: frame.container.identity,
    entries: frame.entries,
    length: length.value,
    at: ref(0),
    count: ref(0),
    hidden: ref(false)
  })
}

export const processDescriptors = (state: State, frame: Extract<Frame, { _tag: "Descriptors" }>): void => {
  const at = MutableRef.get(frame.at)
  if (at === frame.keys.length) return finishDescriptors(state, frame)
  const key = frame.keys[at]
  if (typeof key !== "string") return fail(state, rejection("reflection-failure"))
  const result = snapshot(frame.container.identity, key)
  if (Either.isLeft(result)) return fail(state, result.left)
  frame.entries[at] = result.right
  if (result.right.accessor) MutableRef.set(frame.accessor, true)
  if (frame.container._tag === "Record" && !result.right.enumerable) MutableRef.set(frame.hidden, true)
  if (frame.container._tag === "Array" && key === "length" && typeof result.right.value === "number") {
    MutableRef.set(frame.length, Option.some(result.right.value))
  }
  MutableRef.set(frame.at, at + 1)
  push(state, frame)
}

export const processArrayCheck = (state: State, frame: Extract<Frame, { _tag: "ArrayCheck" }>): void => {
  const at = MutableRef.get(frame.at)
  if (at < frame.entries.length) {
    const entry = frame.entries[at]!
    if (indexBelow(entry.key, frame.length)) {
      MutableRef.update(frame.count, (count) => count + 1)
      if (!entry.enumerable) MutableRef.set(frame.hidden, true)
    }
    MutableRef.set(frame.at, at + 1)
    return push(state, frame)
  }
  if (MutableRef.get(frame.hidden)) return fail(state, rejection("non-enumerable-property"))
  if (MutableRef.get(frame.count) < frame.length) return fail(state, rejection("sparse-array"))
  if (frame.entries.length !== frame.length + 1) return fail(state, rejection("array-extra-property"))
  push(state, {
    _tag: "ArrayFill",
    identity: frame.identity,
    entries: frame.entries,
    values: new Array(frame.length),
    length: frame.length,
    at: ref(0)
  })
}

export const processArrayFill = (state: State, frame: Extract<Frame, { _tag: "ArrayFill" }>): void => {
  const at = MutableRef.get(frame.at)
  if (at === frame.entries.length) {
    if (!emit(state, "[")) return
    return push(state, { _tag: "ArrayCursor", identity: frame.identity, values: frame.values, at: ref(0) })
  }
  const entry = frame.entries[at]!
  if (indexBelow(entry.key, frame.length)) frame.values[Number(entry.key)] = entry.value
  MutableRef.set(frame.at, at + 1)
  push(state, frame)
}

export const processSort = (state: State, frame: Extract<Frame, { _tag: "Sort" }>): void => {
  const length = frame.entries.length, width = MutableRef.get(frame.width), left = MutableRef.get(frame.left)
  if (width >= length) {
    return push(state, {
      _tag: "Keys",
      identity: frame.identity,
      entries: MutableRef.get(frame.source),
      entry: ref(0),
      code: ref(0)
    })
  }
  if (left >= length) {
    const source = MutableRef.get(frame.source)
    MutableRef.set(frame.source, MutableRef.get(frame.target))
    MutableRef.set(frame.target, source)
    MutableRef.set(frame.width, width * 2)
    MutableRef.set(frame.left, 0)
    MutableRef.set(frame.i, 0)
    MutableRef.set(frame.j, Math.min(width * 2, length))
    MutableRef.set(frame.k, 0)
    return push(state, frame)
  }
  const middle = Math.min(left + width, length), right = Math.min(left + width * 2, length)
  const i = MutableRef.get(frame.i), j = MutableRef.get(frame.j), k = MutableRef.get(frame.k)
  if (k < right) {
    const source = MutableRef.get(frame.source),
      takeLeft = i < middle && (j >= right || source[i]!.key <= source[j]!.key)
    MutableRef.get(frame.target)[k] = source[takeLeft ? i : j]!
    MutableRef.set(takeLeft ? frame.i : frame.j, (takeLeft ? i : j) + 1)
    MutableRef.set(frame.k, k + 1)
    return push(state, frame)
  }
  MutableRef.set(frame.left, right)
  MutableRef.set(frame.i, right)
  MutableRef.set(frame.j, Math.min(right + width, length))
  MutableRef.set(frame.k, right)
  push(state, frame)
}
