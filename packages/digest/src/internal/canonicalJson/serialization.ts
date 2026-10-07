/** Native JSON scalar encoding and canonical collection traversal. @internal */

import * as Arr from "effect/Array"
import * as B from "effect/Boolean"
import type * as Data from "effect/Data"
import * as Equivalence from "effect/Equivalence"
import * as Match from "effect/Match"
import * as MutableHashSet from "effect/MutableHashSet"
import * as MutableList from "effect/MutableList"
import * as MutableRef from "effect/MutableRef"
import * as N from "effect/Number"
import * as Option from "effect/Option"
import * as Predicate from "effect/Predicate"
import * as Record from "effect/Record"
import * as Result from "effect/Result"
import * as Schema from "effect/Schema"
import * as SchemaCompiler from "effect/schema/SchemaCompiler"
import * as SchemaParser from "effect/SchemaParser"
import * as Str from "effect/String"
import * as Struct from "effect/Struct"

import { CyclicValue, UnsupportedValue } from "../../CanonicalJson.js"
import { InvalidUnicode } from "../../Utf8.js"
import { unicodeFault } from "../utf8.js"
import {
  ArrayFrame,
  ArrayHalt,
  type Container,
  emit,
  fail,
  Frame,
  Halt,
  LeafHalt,
  pop,
  push,
  RecordFrame,
  RecordHalt,
  runBytes,
  scannedDepth,
  Shape,
  type State,
  StringFrame,
  VisitFrame
} from "./state.js"

const encodeString = Schema.encodeResult(Schema.fromJsonString(Schema.String))
// Runs of already admitted values are serialized by Schema's JSON codec, whose
// scalar spelling and string escaping are exactly the RFC 8785 forms.
const encodeRun = Schema.encodeResult(Schema.fromJsonString(Schema.Unknown))
// Intrinsic view classification also covers cross-realm and future typed arrays,
// without reading user properties, Symbol.toStringTag, or Hash/Equal hooks.
const viewPredicate = (value: unknown): value is ArrayBufferView => ArrayBuffer.isView(value)
const BufferView = Schema.declare(viewPredicate)
// The boolean compiler operation avoids allocating a Schema issue for every
// ordinary object. It is exactly the declaration predicate, with no AST interpretation.
SchemaCompiler.set(BufferView.ast, {
  is: viewPredicate,
  decodeEffect: SchemaParser.decodeUnknownEffect(BufferView)
})
const isBufferView = Schema.is(BufferView)
const isNaN = Predicate.and(Predicate.isNumber, (value: number) => !Equivalence.strictEqual<number>()(value, value))
// Exactly the `Schema.Finite` check through Effect's public `Number` export:
// `Schema.is(Schema.Finite)` would allocate a parse exit per number.
const isFinite = N.Number.isFinite
const isHighSurrogate = N.between({ minimum: 0xd800, maximum: 0xdbff })
// Quotes, backslashes, lone surrogates, and code points below U+0020 require
// Schema escaping or the precise Unicode error validator. Valid pairs do not match.
const needsStringEncoding = /["\\\ud800-\udfff]|[^\u0020-\u{10ffff}]/u
// Non-matching text yields the shared `None` without allocating.
const unsafeCharacter = Str.match(needsStringEncoding)
// Canonical array indices enumerate before other keys regardless of insertion order.
const isIndexKey = (key: string): boolean => Option.isSome(Str.match(/^(?:0|[1-9][0-9]*)$/)(key))
const concat = Str.ReducerConcat.combine
const shortText = 1_024
const sameObject = Equivalence.strictEqual<object>()
const isPositive = N.isGreaterThan(0)

// Objects of these kinds are refused before array or record admission, in this order.
const isRefused = Predicate.or(
  Predicate.or(Predicate.or(Predicate.isDate, Predicate.isRegExp), Predicate.or(isBufferView, Predicate.isMap)),
  Predicate.or(Predicate.isSet, Predicate.isPromise)
)
const reason = (reason: UnsupportedValue["reason"]) => (): UnsupportedValue["reason"] => reason
const refusal = Match.type<unknown>().pipe(
  Match.when(Predicate.isUndefined, reason("undefined")),
  Match.when(Predicate.isBigInt, reason("bigint")),
  Match.when(Predicate.isFunction, reason("function")),
  Match.when(Predicate.isSymbol, reason("symbol")),
  Match.when(Predicate.isDate, reason("date")),
  Match.when(Predicate.isRegExp, reason("regexp")),
  Match.when(isBufferView, reason("typed-array")),
  Match.when(Predicate.isMap, reason("map")),
  Match.when(Predicate.isSet, reason("set")),
  Match.when(Predicate.isPromise, reason("promise")),
  Match.orElse(reason("unsupported-value"))
)

const reject = <E>(state: State<E>, reason: UnsupportedValue["reason"]): void => {
  fail(state, new UnsupportedValue({ reason }))
}

// Register every open ancestor at or beyond the tracked prefix, outermost first.
const register = <E>(state: State<E>, parent: Option.Option<Container>): void => {
  if (Option.isSome(parent) && N.isGreaterThanOrEqualTo(parent.value.depth, MutableRef.get(state.tracked))) {
    register(state, parent.value.parent)
    MutableHashSet.add(state.active, state.identity(parent.value.identity))
  }
}

const depthBelow = Option.match({ onNone: () => 0, onSome: (parent: Container) => N.increment(parent.depth) })

const isCyclic = <E>(state: State<E>, identity: object, depth: number, parent: Option.Option<Container>): boolean => {
  if (N.isLessThan(depth, scannedDepth)) return encloses(parent, identity)
  register(state, parent)
  MutableRef.set(state.tracked, N.increment(depth))
  const ancestor = state.identity(identity)
  if (MutableHashSet.has(state.active, ancestor)) return true
  MutableHashSet.add(state.active, ancestor)
  return false
}

const close = <E>(state: State<E>, frame: Container, token: string): void => {
  pop(state, frame)
  emit(state, token)
  if (N.isLessThan(frame.depth, MutableRef.get(state.tracked))) {
    MutableHashSet.remove(state.active, state.identity(frame.identity))
    MutableRef.set(state.tracked, frame.depth)
  }
}

const startString = <E>(state: State<E>, text: string, prefix: string, suffix: string): void => {
  if (N.isLessThanOrEqualTo(Str.length(text), shortText) && Option.isNone(unsafeCharacter(text))) {
    return emit(state, concat(concat(concat(prefix, "\""), text), suffix))
  }
  emit(state, concat(prefix, "\""))
  const frame = StringFrame({ text, at: 0, suffix, parent: MutableRef.get(state.top) })
  if (N.isLessThanOrEqualTo(Str.length(text), shortText) && Option.isNone(MutableRef.get(state.failure))) {
    processString(state, frame)
  } else {
    push(state, frame)
  }
}

const sameKeys = Equivalence.Array(Str.Equivalence)

const quoteKey = (key: string, at: number): string => concat(isPositive(at) ? ",\"" : "\"", concat(key, "\":"))

const keyPrefix = (key: string, at: number): Option.Option<string> =>
  N.isLessThanOrEqualTo(Str.length(key), shortText) && Option.isNone(unsafeCharacter(key))
    ? Option.some(quoteKey(key, at))
    : Option.none()

/*
 * Serialized byte bounds charged before any further read. Unescaped text is
 * at most three UTF-8 bytes per code unit, escaped text at most six, a number
 * spells in at most 24 characters, and each bound includes the separator.
 */
const numberBytes = 25
const unescapedBytes = (units: number): number => N.sum(N.multiply(units, 3), 3)
const escapedBytes = (units: number): number => N.sum(N.multiply(units, 6), 3)
const keyBytes = (key: string): number => N.sum(N.multiply(Str.length(key), 3), 4)

// Consecutive records usually share one key layout; sort and quote it once.
const shapeOf = <E>(state: State<E>, identity: Readonly<Record<string, unknown>>): Shape => {
  const keys = Record.keys(identity)
  const cached = MutableRef.get(state.shape)
  if (sameKeys(keys, cached.keys)) return cached
  const sorted = Arr.sort(keys, Str.Order)
  const prefixes = Arr.map(sorted, keyPrefix)
  // Fresh objects enumerate index-like keys first, so only index-free layouts
  // keep sorted insertion order under Schema's JSON serializer.
  const plain = Arr.every(prefixes, Option.isSome) && !Arr.some(sorted, isIndexKey)
  const shape = new Shape({ keys, sorted, prefixes, costs: Arr.map(sorted, keyBytes), plain })
  MutableRef.set(state.shape, shape)
  return shape
}

/*
 * Bounded canonical copies. A run of consecutive plain values (admitted
 * scalars, dense arrays, and index-free records within the scanned depth) is
 * copied into fresh JSON data and serialized by Schema in one call. Copies
 * read every element exactly once, after its own-index check, and never carry
 * prototypes, hooks, or hidden properties. Each value is charged an upper
 * bound of its serialized bytes before the next read, against `runBytes` or
 * the remaining byte limit if smaller, so a run never crosses a limit and the
 * reads stop exactly where single emissions would. A copy that cannot continue
 * halts with everything it already read; the frame machine resumes from that
 * exact position and reproduces the exact rejection.
 *
 * Copying allocates nothing per scalar: halts travel through `state.halt`,
 * elements accumulate in one mutable list per container, and entries are
 * assigned into one fresh record per container.
 */
const runElements = 8_192

const encloses = (parent: Option.Option<Container>, identity: object): boolean =>
  Option.isSome(parent) && (sameObject(parent.value.identity, identity) || encloses(parent.value.parent, identity))

// Copied containers occupy the lineage slots between the copying frame and `depth`.
const within = <E>(state: State<E>, identity: object, depth: number, frame: Container): boolean =>
  withinSlots(state, identity, N.increment(frame.depth), depth) || sameObject(frame.identity, identity) ||
  encloses(frame.parent, identity)

const withinSlots = <E>(state: State<E>, identity: object, from: number, to: number): boolean =>
  from < to &&
  (sameObject(MutableRef.get(Arr.getUnsafe(state.lineage, from)), identity) ||
    withinSlots(state, identity, from + 1, to))

const halted = <E>(state: State<E>): boolean => Option.isSome(MutableRef.get(state.halt))

const halt = <E>(state: State<E>, where: Halt): void => {
  MutableRef.set(state.halt, Option.some(where))
}

const stop = <E>(state: State<E>, value: unknown): unknown => {
  halt(state, LeafHalt({ value }))
  return value
}

// Owner-accepted native arithmetic and comparisons: `spend`, `open`, `copy`, and `withinSlots` run per value.
const spend = <E>(state: State<E>, bytes: number): boolean => {
  const left = MutableRef.get(state.budget) - bytes
  if (left < 0) return false
  MutableRef.set(state.budget, left)
  return true
}

// Printable ASCII without quotes or backslashes serializes byte for byte.
const nonPlainCharacter = Str.match(/[^\u0020\u0021\u0023-\u005b\u005d-\u007e]/)

// No run budget admits this charge, so a string charged with it is visited on
// its own, where it is validated exactly. Charges allocate nothing per string.
const uncopyableBytes = N.increment(runBytes)

const stringBytes = (text: string): number =>
  N.isGreaterThan(Str.length(text), shortText)
    ? uncopyableBytes
    : Option.isNone(nonPlainCharacter(text))
    ? N.sum(Str.length(text), 3)
    : Option.isNone(unsafeCharacter(text))
    ? unescapedBytes(Str.length(text))
    : Option.isNone(unicodeFault(text))
    ? escapedBytes(Str.length(text))
    : uncopyableBytes

const copyString = <E>(state: State<E>, text: string): unknown =>
  spend(state, stringBytes(text)) ? text : stop(state, text)

// Returns the admitted copy, or any value after recording a halt.
const copy = <E>(state: State<E>, value: unknown, depth: number, frame: Container): unknown => {
  if (Predicate.isString(value)) return copyString(state, value)
  if (Predicate.isNumber(value)) return isFinite(value) && spend(state, numberBytes) ? value : stop(state, value)
  if (Predicate.isBoolean(value)) return spend(state, 6) ? value : stop(state, value)
  if (Predicate.isNull(value)) return spend(state, 5) ? value : stop(state, value)
  if (depth >= scannedDepth) return stop(state, value)
  if (Arr.isArray(value)) {
    return isRefused(value) || within(state, value, depth, frame)
      ? stop(state, value)
      : copyArray(state, value, depth, frame)
  }
  if (Predicate.isObject(value) && !isRefused(value)) {
    return within(state, value, depth, frame) ? stop(state, value) : copyRecord(state, value, depth, frame)
  }
  return stop(state, value)
}

// Run offsets are shared: short runs use a prepared prefix, others a native slice.
const runOffsets = Arr.range(0, N.decrement(runElements))
const shortOffsets = Arr.makeBy(65, (count) => Arr.take(runOffsets, count))
const offsets = (count: number): ReadonlyArray<number> =>
  N.isLessThan(count, shortOffsets.length)
    ? Arr.getUnsafe(shortOffsets, count)
    : N.Equivalence(count, runElements)
    ? runOffsets
    : Arr.take(runOffsets, count)

// Appends admitted elements until one halts or is not an own property.
const copyElements = <E>(
  state: State<E>,
  run: MutableList.MutableList<unknown>,
  identity: ReadonlyArray<unknown>,
  from: number,
  count: number,
  depth: number,
  frame: Container
): void => {
  // One data-last partial per run: elements then add without a dual dispatch.
  const at = N.sum(from)
  Arr.every(offsets(count), (offset) => {
    const index = at(offset)
    // Holes and inherited indices are both absent from own properties.
    if (!Record.has<`${number}`, unknown>(identity, `${index}`)) return false
    const value = copy(state, Arr.getUnsafe(identity, index), depth, frame)
    if (halted(state)) return false
    MutableList.append(run, value)
    return true
  })
}

// Charge the separator and brackets first: nothing may fail after its children were read.
const open = <E>(state: State<E>, depth: number, identity: object, size: number): boolean => {
  const left = MutableRef.get(state.budget) - 3
  // Every element charges at least one byte, so the budget bounds index checks too.
  if (left < size) return false
  MutableRef.set(state.budget, left)
  MutableRef.set(Arr.getUnsafe(state.lineage, depth), identity)
  return true
}

const copyArray = <E>(state: State<E>, identity: ReadonlyArray<unknown>, depth: number, frame: Container): unknown => {
  if (!open(state, depth, identity, identity.length)) return stop(state, identity)
  const run = MutableList.make<unknown>()
  copyElements(state, run, identity, 0, identity.length, N.increment(depth), frame)
  const elements = MutableList.takeAll(run)
  if (N.Equivalence(elements.length, identity.length)) return elements
  halt(state, ArrayHalt({ identity, elements, child: MutableRef.getAndSet(state.halt, Option.none()) }))
  return identity
}

// keys is our own-key snapshot; the input graph must remain stable.
const copyEntry = <E>(
  state: State<E>,
  fresh: Record<string, unknown>,
  identity: Readonly<Record<string, unknown>>,
  shape: Shape,
  at: number,
  depth: number,
  frame: Container
): boolean => {
  const key = Arr.getUnsafe(shape.sorted, at)
  // The value is read before its key prefix is charged, as single emissions do.
  const read = Struct.get(identity, key)
  const value = spend(state, Arr.getUnsafe(shape.costs, at)) ? copy(state, read, depth, frame) : stop(state, read)
  if (halted(state)) return false
  // Insertion order is the sorted order; `__proto__` becomes an own data property.
  Record.assignProperty(fresh, key, value)
  return true
}

// Returns how many entries were copied: the first offset that halted, else all.
const copyEntries = <E>(
  state: State<E>,
  fresh: Record<string, unknown>,
  identity: Readonly<Record<string, unknown>>,
  shape: Shape,
  from: number,
  count: number,
  depth: number,
  frame: Container
): number => {
  const at = N.sum(from)
  return Option.getOrElse(
    Arr.findFirstIndex(offsets(count), (offset) => !copyEntry(state, fresh, identity, shape, at(offset), depth, frame)),
    () => count
  )
}

const copyRecord = <E>(
  state: State<E>,
  identity: Readonly<Record<string, unknown>>,
  depth: number,
  frame: Container
): unknown => {
  const shape = shapeOf(state, identity)
  if (!shape.plain || !open(state, depth, identity, shape.sorted.length)) return stop(state, identity)
  const fresh = Record.empty<string, unknown>()
  const copied = copyEntries(state, fresh, identity, shape, 0, shape.sorted.length, N.increment(depth), frame)
  if (N.Equivalence(copied, shape.sorted.length)) return fresh
  halt(state, RecordHalt({ identity, shape, fresh, copied, child: MutableRef.getAndSet(state.halt, Option.none()) }))
  return identity
}

// Emit one serialized run without its enclosing brackets.
const emitRun = <E>(state: State<E>, run: unknown, prefix: string): void =>
  Result.match(encodeRun(run), {
    onFailure: () => reject(state, "unsupported-value"),
    onSuccess: (text) => emit(state, concat(prefix, Str.slice(1, -1)(text)))
  })

const makeVisit = <E>(
  state: State<E>
): (value: unknown, prefix: string, parent: Option.Option<Container>) => void => {
  // A rejected value's separator and key were already admitted against the
  // byte limit, so a limit crossed there is the failure.
  const refuse = (prefix: string, reason: UnsupportedValue["reason"]): void => {
    emit(state, prefix)
    reject(state, reason)
  }
  const cyclic = (prefix: string): void => {
    emit(state, prefix)
    fail(state, new CyclicValue())
  }
  const openArray = (identity: ReadonlyArray<unknown>, prefix: string, parent: Option.Option<Container>): void => {
    const depth = depthBelow(parent)
    if (isCyclic(state, identity, depth, parent)) return cyclic(prefix)
    emit(state, concat(prefix, "["))
    push(state, ArrayFrame({ identity, at: MutableRef.make(0), depth, parent }))
  }
  const openRecord = (
    identity: Readonly<Record<string, unknown>>,
    prefix: string,
    parent: Option.Option<Container>
  ): void => {
    const depth = depthBelow(parent)
    if (isCyclic(state, identity, depth, parent)) return cyclic(prefix)
    emit(state, concat(prefix, "{"))
    const shape = shapeOf(state, identity)
    push(state, RecordFrame({ identity, shape, at: MutableRef.make(0), depth, parent }))
  }
  return (value, prefix, parent) => {
    if (Predicate.isString(value)) return startString(state, value, prefix, "\"")
    if (Predicate.isNumber(value)) {
      if (isNaN(value)) return refuse(prefix, "nan")
      if (!isFinite(value)) return refuse(prefix, "non-finite-number")
      return emit(state, concat(prefix, Str.String(value)))
    }
    if (Predicate.isBoolean(value)) return emit(state, concat(prefix, Str.String(value)))
    if (Predicate.isNull(value)) return emit(state, concat(prefix, "null"))
    if (Arr.isArray(value) && !isRefused(value)) return openArray(value, prefix, parent)
    if (Predicate.isObject(value) && !isRefused(value)) return openRecord(value, prefix, parent)
    return refuse(prefix, refusal(value))
  }
}

const processString = <E>(state: State<E>, frame: Data.TaggedEnum.Value<Frame, "String">): void =>
  B.match(N.Equivalence(frame.at, Str.length(frame.text)), {
    onTrue: () => emit(state, frame.suffix),
    onFalse: () => {
      // Keep escaping work bounded without splitting a surrogate pair: a high
      // surrogate at the slice end carries its pair along, never past the text.
      const limit = N.min(N.sum(frame.at, 32_768), Str.length(frame.text))
      const end = B.match(Option.exists(Str.charCodeAt(frame.text, N.decrement(limit)), isHighSurrogate), {
        onTrue: () => N.min(N.increment(limit), Str.length(frame.text)),
        onFalse: () => limit
      })
      const text = Str.slice(frame.at, end)(frame.text)
      const finish = (content: string): void => {
        emit(state, content)
        B.match(N.Equivalence(end, Str.length(frame.text)) && Option.isNone(MutableRef.get(state.failure)), {
          onTrue: () => emit(state, frame.suffix),
          onFalse: () =>
            push(state, StringFrame({ text: frame.text, at: end, suffix: frame.suffix, parent: frame.parent }))
        })
      }
      return Option.match(unsafeCharacter(text), {
        // In Unicode mode valid pairs do not match. No matching character means
        // both well-formed Unicode and JSON content requiring no escaping.
        onNone: () => finish(text),
        onSome: () =>
          Option.match(unicodeFault(text), {
            onSome: (error) =>
              fail(
                state,
                new InvalidUnicode({ kind: error.kind, codeUnitIndex: N.sum(frame.at, error.codeUnitIndex) })
              ),
            onNone: () =>
              Result.match(encodeString(text), {
                onFailure: () => reject(state, "unsupported-value"),
                onSuccess: (encoded) => finish(Str.slice(1, -1)(encoded))
              })
          })
      })
    }
  })

export const makeProcessor = <E>(state: State<E>): (frame: Frame) => void => {
  const visit = makeVisit(state)
  // Reopen the containers a halted copy was inside, emit what it copied, and
  // hand its halting value to the frame machine. Copies already checked cycles.
  const resume = (where: Halt, prefix: string, parent: Option.Option<Container>): void => {
    if (Option.isSome(MutableRef.get(state.failure))) return
    return Halt.$match(where, {
      Leaf: ({ value }) => visit(value, prefix, parent),
      Array: ({ child, elements, identity }) => {
        emit(state, concat(prefix, "["))
        const at = elements.length
        const frame = ArrayFrame({ identity, at: MutableRef.make(at), depth: depthBelow(parent), parent })
        push(state, frame)
        if (Arr.isReadonlyArrayNonEmpty(elements)) emitRun(state, elements, "")
        if (Option.isSome(child)) {
          MutableRef.set(frame.at, N.increment(at))
          resume(child.value, isPositive(at) ? "," : "", Option.some(frame))
        }
      },
      Record: ({ child, copied, fresh, identity, shape }) => {
        emit(state, concat(prefix, "{"))
        const frame = RecordFrame({ identity, shape, at: MutableRef.make(copied), depth: depthBelow(parent), parent })
        push(state, frame)
        if (isPositive(copied)) emitRun(state, fresh, "")
        if (Option.isSome(child)) {
          MutableRef.set(frame.at, N.increment(copied))
          resume(child.value, quoteKey(Arr.getUnsafe(shape.sorted, copied), copied), Option.some(frame))
        }
      }
    })
  }
  return Frame.$match({
    Visit: (frame) => {
      pop(state, frame)
      visit(frame.value, "", frame.parent)
    },
    String: (frame) => {
      pop(state, frame)
      processString(state, frame)
    },
    Array: (frame) => {
      const identity = frame.identity
      const at = MutableRef.get(frame.at)
      if (N.isGreaterThanOrEqualTo(at, identity.length)) return close(state, frame, "]")
      MutableRef.set(state.budget, N.min(runBytes, state.allowance()))
      const count = N.min(N.subtract(identity.length, at), runElements)
      const run = MutableList.make<unknown>()
      copyElements(state, run, identity, at, count, N.increment(frame.depth), frame)
      const copied = run.length
      const next = N.sum(at, copied)
      MutableRef.set(frame.at, next)
      if (isPositive(copied)) emitRun(state, MutableList.takeAll(run), isPositive(at) ? "," : "")
      const where = MutableRef.getAndSet(state.halt, Option.none())
      if (Option.isSome(where)) {
        MutableRef.set(frame.at, N.increment(next))
        return resume(where.value, isPositive(next) ? "," : "", Option.some(frame))
      }
      // Holes and inherited indices are both absent from own properties.
      if (N.isLessThan(copied, count)) reject(state, "sparse-array")
    },
    Record: (frame) => {
      const at = MutableRef.get(frame.at)
      if (N.isGreaterThanOrEqualTo(at, frame.shape.sorted.length)) return close(state, frame, "}")
      if (frame.shape.plain) {
        MutableRef.set(state.budget, N.min(runBytes, state.allowance()))
        const count = N.min(N.subtract(frame.shape.sorted.length, at), runElements)
        const fresh = Record.empty<string, unknown>()
        const copied = copyEntries(
          state,
          fresh,
          frame.identity,
          frame.shape,
          at,
          count,
          N.increment(frame.depth),
          frame
        )
        const next = N.sum(at, copied)
        MutableRef.set(frame.at, next)
        if (isPositive(copied)) emitRun(state, fresh, isPositive(at) ? "," : "")
        const where = MutableRef.getAndSet(state.halt, Option.none())
        if (Option.isSome(where)) {
          MutableRef.set(frame.at, N.increment(next))
          return resume(where.value, quoteKey(Arr.getUnsafe(frame.shape.sorted, next), next), Option.some(frame))
        }
        return
      }
      MutableRef.set(frame.at, N.increment(at))
      const key = Arr.getUnsafe(frame.shape.sorted, at)
      // keys is our own-key snapshot; the input graph must remain stable.
      const value = Struct.get(frame.identity, key)
      const prefix = Arr.getUnsafe(frame.shape.prefixes, at)
      if (Option.isSome(prefix)) return visit(value, prefix.value, Option.some(frame))
      if (isPositive(at)) emit(state, ",")
      if (N.isLessThanOrEqualTo(Str.length(key), shortText)) {
        startString(state, key, "", "\":")
        if (Option.isNone(MutableRef.get(state.failure))) visit(value, "", Option.some(frame))
      } else {
        push(state, VisitFrame({ value, parent: Option.some(frame) }))
        startString(state, key, "", "\":")
      }
    }
  })
}
