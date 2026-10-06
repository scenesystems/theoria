/** Invocation-local state for stack-safe canonical traversal. @internal */

import * as Data from "effect/Data"
import type * as MutableHashSet from "effect/MutableHashSet"
import * as MutableList from "effect/MutableList"
import * as MutableRef from "effect/MutableRef"
import * as N from "effect/Number"
import * as Option from "effect/Option"
import * as Str from "effect/String"

import type { Error as CanonicalizationError } from "../../CanonicalJson.js"

/**
 * The traversal stack is the chain of `parent` links from the top frame down
 * to `None`. Open containers link to their enclosing container, so the chain
 * above any container is exactly its ancestor path, which cycle detection
 * scans by reference.
 */
export type Frame = Data.TaggedEnum<{
  Visit: { readonly value: unknown; readonly parent: Option.Option<Container> }
  Array: {
    readonly identity: ReadonlyArray<unknown>
    readonly at: MutableRef.MutableRef<number>
    readonly depth: number
    readonly parent: Option.Option<Container>
  }
  Record: {
    readonly identity: Readonly<Record<string, unknown>>
    readonly keys: ReadonlyArray<string>
    /** Per sorted key: `,"key":` when the key needs no escaping, else none. */
    readonly prefixes: ReadonlyArray<Option.Option<string>>
    /** Every key is short, needs no escaping, and is not an array index. */
    readonly plain: boolean
    readonly at: MutableRef.MutableRef<number>
    readonly depth: number
    readonly parent: Option.Option<Container>
  }
  String: { readonly text: string; readonly at: number; readonly suffix: string; readonly parent: Option.Option<Frame> }
}>

/** Frames that enclose values: open collections. */
export type Container = Extract<Frame, { readonly _tag: "Array" | "Record" }>

/**
 * Containers above this depth detect cycles by scanning their ancestors by
 * reference. Deeper containers register identities so every check stays bounded.
 */
export const scannedDepth = 32

export const Frame = Data.taggedEnum<Frame>()
// Constructors are bound once; the enum's proxy would otherwise rebuild them per access.
export const VisitFrame = Frame.Visit
export const ArrayFrame = Frame.Array
export const RecordFrame = Frame.Record
export const StringFrame = Frame.String

/** One record key layout: its enumeration order, sorted order, and inline key prefixes. */
export class Shape extends Data.Class<{
  readonly keys: ReadonlyArray<string>
  readonly sorted: ReadonlyArray<string>
  readonly prefixes: ReadonlyArray<Option.Option<string>>
  readonly plain: boolean
}> {}

/**
 * Where a bounded copy stopped, carrying every value it already read so the
 * frame machine resumes exactly there without reading any field twice.
 */
export type Halt = Data.TaggedEnum<{
  /** A value the frame machine must visit itself. */
  Leaf: { readonly value: unknown }
  /** An array copied up to its first halting element; none when that element is not own. */
  Array: {
    readonly identity: ReadonlyArray<unknown>
    readonly elements: ReadonlyArray<unknown>
    readonly child: Option.Option<Halt>
  }
  /** A record copied up to its first halting entry: `copied` sorted keys are in `fresh`. */
  Record: {
    readonly identity: Readonly<Record<string, unknown>>
    readonly shape: Shape
    readonly fresh: Readonly<Record<string, unknown>>
    readonly copied: number
    readonly child: Option.Option<Halt>
  }
}>

export const Halt = Data.taggedEnum<Halt>()
export const LeafHalt = Halt.Leaf
export const ArrayHalt = Halt.Array
export const RecordHalt = Halt.Record

export class State<E> extends Data.Class<{
  /** The current frame; none once traversal has completed. */
  readonly top: MutableRef.MutableRef<Option.Option<Frame>>
  /** Open containers shallower than this depth are registered in `active`. */
  readonly tracked: MutableRef.MutableRef<number>
  readonly active: MutableHashSet.MutableHashSet<number>
  readonly identity: (value: object) => number
  /** The most recent record key layout. */
  readonly shape: MutableRef.MutableRef<Shape>
  /** Text units a bounded copy may still spend. */
  readonly budget: MutableRef.MutableRef<number>
  /** The container being copied at each scanned depth, below the copying frame. */
  readonly lineage: ReadonlyArray<MutableRef.MutableRef<object>>
  /** Where the most recent bounded copy stopped, until its caller resumes it. */
  readonly halt: MutableRef.MutableRef<Option.Option<Halt>>
  readonly segments: MutableList.MutableList<string>
  readonly write: (state: State<E>, text: string) => void
  readonly pending: MutableRef.MutableRef<string>
  readonly failure: MutableRef.MutableRef<Option.Option<CanonicalizationError | E>>
}> {}

export const fail = <E>(state: State<E>, error: CanonicalizationError | E): void => {
  MutableRef.set(state.failure, Option.some(error))
}

export const push = <E>(state: State<E>, frame: Frame): void => {
  MutableRef.set(state.top, Option.some(frame))
}

export const pop = <E>(state: State<E>, frame: Frame): void => {
  MutableRef.set(state.top, frame.parent)
}

export const flushPending = <E>(state: State<E>, final = false): void => {
  const pending = MutableRef.get(state.pending)
  if (Str.isNonEmpty(pending)) {
    // ASCII-only preimages can preserve the hashers' 64-byte block alignment
    // before UTF-8 encoding, without a copying byte-rechunking stage.
    const remainder = !final && Option.isNone(Str.search(pending, /[\u0080-\uffff]/))
      ? N.remainder(Str.length(pending), 64)
      : 0
    const end = N.subtract(Str.length(pending), remainder)
    MutableList.append(state.segments, Str.slice(0, end)(pending))
    MutableRef.set(state.pending, Str.slice(end)(pending))
  }
}

export const append = <E>(state: State<E>, text: string): void => {
  MutableRef.set(state.pending, Str.ReducerConcat.combine(MutableRef.get(state.pending), text))
  if (N.isGreaterThanOrEqualTo(Str.length(MutableRef.get(state.pending)), 32_768)) flushPending(state)
}

export const emit = <E>(state: State<E>, text: string): void => state.write(state, text)
