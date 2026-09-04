/** Cooperative descriptor admission and record sorting. @internal */

import { Array as Arr, Either, MutableHashSet, MutableRef, Option } from "effect"

import { CyclicValue } from "../schemas/errors.js"
import { classifyContainer, descriptorShape, ownKeys, reflect, rejection, snapshot } from "./admission.js"
import type { Frame, State } from "./jcs-model.js"
import { emit, fail, indexBelow, push, ref } from "./jcs-model.js"

export const startObject = (state: State, value: object): void => {
  const result = classifyContainer(value)
  if (Either.isLeft(result)) return fail(state, result.left)
  const keys = ownKeys(result.right.identity)
  if (Either.isLeft(keys)) return fail(state, keys.left)
  push(state, { _tag: "Symbols", container: result.right, keys: keys.right, stringKeys: [], at: ref(0) })
}

const finishSymbols = (state: State, frame: Extract<Frame, { _tag: "Symbols" }>): void => {
  const cycle = reflect(() => MutableHashSet.has(state.active, frame.container.identity))
  if (Either.isLeft(cycle)) return fail(state, cycle.left)
  if (cycle.right) return fail(state, new CyclicValue())
  const added = reflect(() => MutableHashSet.add(state.active, frame.container.identity))
  if (Either.isLeft(added)) return fail(state, added.left)
  push(state, {
    _tag: "Descriptors",
    container: frame.container,
    keys: frame.stringKeys,
    entries: [],
    at: ref(0),
    accessor: ref(false),
    hidden: ref(false),
    length: ref(Option.none())
  })
}

const admitSymbol = (state: State, frame: Extract<Frame, { _tag: "Symbols" }>, key: PropertyKey): void => {
  if (typeof key === "string") frame.stringKeys[frame.stringKeys.length] = key
  else {
    if (frame.container._tag === "Record") return fail(state, rejection("symbol-property"))
    const result = descriptorShape(frame.container.identity, key)
    if (Either.isLeft(result)) return fail(state, result.left)
    if (result.right.accessor) return fail(state, rejection("accessor-property"))
    if (result.right.enumerable) return fail(state, rejection("symbol-property"))
  }
  MutableRef.update(frame.at, (at) => at + 1)
  push(state, frame)
}

export const processSymbols = (state: State, frame: Extract<Frame, { _tag: "Symbols" }>): void =>
  Option.match(Arr.get(frame.keys, MutableRef.get(frame.at)), {
    onNone: () => finishSymbols(state, frame),
    onSome: (key) => admitSymbol(state, frame, key)
  })

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

const admitDescriptor = (state: State, frame: Extract<Frame, { _tag: "Descriptors" }>, key: string): void => {
  const at = MutableRef.get(frame.at)
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

export const processDescriptors = (state: State, frame: Extract<Frame, { _tag: "Descriptors" }>): void =>
  Option.match(Arr.get(frame.keys, MutableRef.get(frame.at)), {
    onNone: () => finishDescriptors(state, frame),
    onSome: (key) => admitDescriptor(state, frame, key)
  })

const finishArrayCheck = (state: State, frame: Extract<Frame, { _tag: "ArrayCheck" }>): void => {
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

export const processArrayCheck = (state: State, frame: Extract<Frame, { _tag: "ArrayCheck" }>): void =>
  Option.match(Arr.get(frame.entries, MutableRef.get(frame.at)), {
    onNone: () => finishArrayCheck(state, frame),
    onSome: (entry) => {
      if (indexBelow(entry.key, frame.length)) {
        MutableRef.update(frame.count, (count) => count + 1)
        if (!entry.enumerable) MutableRef.set(frame.hidden, true)
      }
      MutableRef.update(frame.at, (at) => at + 1)
      push(state, frame)
    }
  })

export const processArrayFill = (state: State, frame: Extract<Frame, { _tag: "ArrayFill" }>): void =>
  Option.match(Arr.get(frame.entries, MutableRef.get(frame.at)), {
    onNone: () => {
      if (!emit(state, "[")) return
      push(state, { _tag: "ArrayCursor", identity: frame.identity, values: frame.values, at: ref(0) })
    },
    onSome: (entry) => {
      if (indexBelow(entry.key, frame.length)) frame.values[Number(entry.key)] = entry.value
      MutableRef.update(frame.at, (at) => at + 1)
      push(state, frame)
    }
  })

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
    const source = MutableRef.get(frame.source)
    const fromLeft = i < middle ? Arr.get(source, i) : Option.none()
    const fromRight = j < right ? Arr.get(source, j) : Option.none()
    const takeLeft = Option.isSome(fromLeft) && (Option.isNone(fromRight) || fromLeft.value.key <= fromRight.value.key)
    const picked = takeLeft ? fromLeft : fromRight
    if (Option.isSome(picked)) {
      MutableRef.get(frame.target)[k] = picked.value
      MutableRef.set(takeLeft ? frame.i : frame.j, (takeLeft ? i : j) + 1)
      MutableRef.set(frame.k, k + 1)
      return push(state, frame)
    }
  }
  MutableRef.set(frame.left, right)
  MutableRef.set(frame.i, right)
  MutableRef.set(frame.j, Math.min(right + width, length))
  MutableRef.set(frame.k, right)
  push(state, frame)
}
