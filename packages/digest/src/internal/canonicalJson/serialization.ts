/** Native JSON scalar encoding and canonical collection traversal. @internal */

import * as Arr from "effect/Array"
import * as B from "effect/Boolean"
import type * as Data from "effect/Data"
import * as Equivalence from "effect/Equivalence"
import * as Match from "effect/Match"
import * as MutableHashMap from "effect/MutableHashMap"
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
import { emit, fail, Frame, push, type State } from "./state.js"

const encodeString = Schema.encodeResult(Schema.fromJsonString(Schema.String))
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
const isFinite = Schema.is(Schema.Finite)
const isHighSurrogate = N.between({ minimum: 0xd800, maximum: 0xdbff })
// Quotes, backslashes, lone surrogates, and code points below U+0020 require
// Schema escaping or the precise Unicode error validator. Valid pairs do not match.
const needsStringEncoding = /["\\\ud800-\udfff]|[^\u0020-\u{10ffff}]/u
const unsafeCharacter = Str.match(needsStringEncoding)
const concat = Str.ReducerConcat.combine

const reject = <E>(state: State<E>, reason: UnsupportedValue["reason"]): void => {
  fail(state, new UnsupportedValue({ reason }))
}

const open = <E>(state: State<E>, identity: object, token: string, cursor: Frame): void => {
  const ancestor = state.identity(identity)
  if (MutableHashSet.has(state.active, ancestor)) return fail(state, new CyclicValue())
  MutableHashSet.add(state.active, ancestor)
  emit(state, token)
  push(state, cursor)
}

const startString = <E>(state: State<E>, text: string, suffix: string): void => {
  if (N.isLessThanOrEqualTo(Str.length(text), 1_024) && Option.isNone(unsafeCharacter(text))) {
    return emit(state, concat(concat("\"", text), suffix))
  }
  emit(state, "\"")
  const frame = Frame.String({ text, at: 0, suffix })
  if (N.isLessThanOrEqualTo(Str.length(text), 1_024) && Option.isNone(MutableRef.get(state.failure))) {
    processString(state, frame)
  } else {
    push(state, frame)
  }
}

const sameKeys = Equivalence.Array(Str.Equivalence)

const makeVisit = <E>(state: State<E>): (value: unknown) => void => {
  const previousKeys = MutableRef.make<ReadonlyArray<string>>([])
  const previousSorted = MutableRef.make<ReadonlyArray<string>>([])
  const sortedKeys = (identity: object): ReadonlyArray<string> => {
    const keys = Record.keys(identity)
    if (sameKeys(keys, MutableRef.get(previousKeys))) return MutableRef.get(previousSorted)
    const sorted = Arr.sort(keys, Str.Order)
    MutableRef.set(previousKeys, keys)
    MutableRef.set(previousSorted, sorted)
    return sorted
  }
  const visit = Match.type<unknown>().pipe(
    Match.when(Predicate.isNumber, (value) => {
      if (isNaN(value)) return reject(state, "nan")
      if (!isFinite(value)) return reject(state, "non-finite-number")
      return emit(state, Str.String(value))
    }),
    Match.when(Predicate.isBoolean, (value) => emit(state, Str.String(value))),
    Match.when(Predicate.isNull, () => emit(state, "null")),
    Match.when(Predicate.isUndefined, () => reject(state, "undefined")),
    Match.when(Predicate.isBigInt, () => reject(state, "bigint")),
    Match.when(Predicate.isFunction, () => reject(state, "function")),
    Match.when(Predicate.isSymbol, () => reject(state, "symbol")),
    Match.when(Predicate.isDate, () => reject(state, "date")),
    Match.when(Predicate.isRegExp, () => reject(state, "regexp")),
    Match.when(isBufferView, () => reject(state, "typed-array")),
    Match.when(Predicate.isMap, () => reject(state, "map")),
    Match.when(Predicate.isSet, () => reject(state, "set")),
    Match.when(Predicate.isPromise, () => reject(state, "promise")),
    Match.when(
      Arr.isArray,
      (identity) => open(state, identity, "[", Frame.Array({ identity, at: MutableRef.make(0) }))
    ),
    Match.when(Predicate.isObject, (identity) =>
      open(
        state,
        identity,
        "{",
        Frame.Record({
          identity,
          keys: sortedKeys(identity),
          at: MutableRef.make(0)
        })
      )),
    Match.orElse(() => reject(state, "unsupported-value"))
  )
  return (value) => {
    if (Predicate.isString(value)) startString(state, value, "\"")
    else visit(value)
  }
}

const processString = <E>(state: State<E>, frame: Data.TaggedEnum.Value<Frame, "String">): void =>
  B.match(N.Equivalence(frame.at, Str.length(frame.text)), {
    onTrue: () => emit(state, frame.suffix),
    onFalse: () => {
      // Keep escaping work bounded without splitting a surrogate pair.
      const limit = N.min(N.sum(frame.at, 32_768), Str.length(frame.text))
      const end = B.match(
        limit < Str.length(frame.text) &&
          Option.exists(Str.charCodeAt(frame.text, N.decrement(limit)), isHighSurrogate),
        {
          onTrue: () => N.min(N.increment(limit), Str.length(frame.text)),
          onFalse: () => limit
        }
      )
      const text = Str.slice(frame.at, end)(frame.text)
      const finish = (content: string): void => {
        emit(state, content)
        B.match(N.Equivalence(end, Str.length(frame.text)) && Option.isNone(MutableRef.get(state.failure)), {
          onTrue: () => emit(state, frame.suffix),
          onFalse: () => push(state, Frame.String({ text: frame.text, at: end, suffix: frame.suffix }))
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
  const keyCache = MutableHashMap.empty<string, string>()
  const quotedKey = (key: string): Option.Option<string> => {
    const cached = MutableHashMap.get(keyCache, key)
    if (Option.isSome(cached)) return cached
    if (Option.isNone(unsafeCharacter(key))) {
      const quoted = concat(concat("\"", key), "\":")
      if (N.isGreaterThanOrEqualTo(MutableHashMap.size(keyCache), 128)) MutableHashMap.clear(keyCache)
      MutableHashMap.set(keyCache, key, quoted)
      return Option.some(quoted)
    }
    return Option.none()
  }
  return Frame.$match({
    Visit: ({ value }) => {
      MutableList.take(state.stack)
      visit(value)
    },
    String: (value) => {
      MutableList.take(state.stack)
      processString(state, value)
    },
    Array: (frame) => {
      const identity = frame.identity
      const at = MutableRef.getAndIncrement(frame.at)
      if (N.isGreaterThanOrEqualTo(at, identity.length)) {
        MutableList.take(state.stack)
        emit(state, "]")
        MutableHashSet.remove(state.active, state.identity(identity))
        return
      }
      const index = Str.String(at)
      if (!Predicate.hasProperty(identity, index) || !Record.has<string, unknown>(identity, index)) {
        return reject(state, "sparse-array")
      }
      if (N.isGreaterThan(at, 0)) emit(state, ",")
      if (Option.isNone(MutableRef.get(state.failure))) visit(Arr.getUnsafe(identity, at))
    },
    Record: (frame) => {
      const { identity, keys } = frame
      const at = MutableRef.getAndIncrement(frame.at)
      if (N.isGreaterThanOrEqualTo(at, keys.length)) {
        MutableList.take(state.stack)
        emit(state, "}")
        MutableHashSet.remove(state.active, state.identity(identity))
        return
      }
      const key = Arr.getUnsafe(keys, at)
      // keys is our own-key snapshot; the input graph must remain stable.
      const value = Struct.get(identity, key)
      if (N.isLessThanOrEqualTo(Str.length(key), 1_024)) {
        const quoted = quotedKey(key)
        if (Option.isSome(quoted)) {
          const prefix = at > 0 ? concat(",", quoted.value) : quoted.value
          if (Predicate.isString(value) && Str.length(value) <= 1_024 && Option.isNone(unsafeCharacter(value))) {
            return emit(state, concat(prefix, concat(concat("\"", value), "\"")))
          }
          emit(state, prefix)
        } else {
          if (at > 0) emit(state, ",")
          startString(state, key, "\":")
        }
        if (Option.isNone(MutableRef.get(state.failure))) visit(value)
      } else {
        if (at > 0) emit(state, ",")
        push(state, Frame.Visit({ value }))
        startString(state, key, "\":")
      }
    }
  })
}
