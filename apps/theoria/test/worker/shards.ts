import { Data, Number, Option, Schema, Tuple } from "effect"
import * as Arr from "effect/Array"
import * as Order from "effect/Order"

/**
 * One runner's share of a serial test suite, named as on the vitest command
 * line: `--shard=index/count`, the index one-based.
 */
export const Shard = Schema.Struct({
  index: Schema.Int.check(Schema.isGreaterThan(0)),
  count: Schema.Int.check(Schema.isGreaterThan(0))
})
export type Shard = typeof Shard.Type

/** A shard as it is filled: the files in it and the weight they add up to. */
class Bin<A> extends Data.Class<{
  readonly total: number
  readonly files: ReadonlyArray<A>
}> {
  static readonly empty = <A>(): Bin<A> => new Bin<A>({ total: 0, files: [] })
  with(file: A, weight: number): Bin<A> {
    return new Bin<A>({ total: this.total + weight, files: Arr.append(this.files, file) })
  }
}

/** The index of the first bin that is no heavier than any other. */
const lightestIndex = <A>(bins: ReadonlyArray<Bin<A>>): number =>
  Arr.reduce(
    bins,
    Tuple.make<[number, number]>(0, Infinity),
    (lightest, bin, index) => bin.total < Tuple.get(lightest, 1) ? Tuple.make(index, bin.total) : lightest
  )[0]

/**
 * Cuts the files into `count` shards of about one weight each: the heaviest
 * file first, each file into the lightest shard so far. Files whose serial
 * runtime is the weight then finish in about the same time on every runner,
 * and no shard is heavier than the fair share by more than one file. Files of
 * one weight are ordered by key, so the cut is a function of the files, not
 * of the order they were found in. A shard may be empty when there are more
 * shards than files.
 */
export const balancedShards = <A>(
  files: ReadonlyArray<A>,
  count: number,
  weightOf: (file: A) => number,
  keyOf: (file: A) => string
): ReadonlyArray<ReadonlyArray<A>> => {
  const heaviestFirst = Order.combine(
    Order.flip(Order.mapInput(Order.Number, weightOf)),
    Order.mapInput(Order.String, keyOf)
  )
  const empty: ReadonlyArray<Bin<A>> = Arr.makeBy(count, Bin.empty<A>)
  const filled = Arr.reduce(
    Arr.sort(files, heaviestFirst),
    empty,
    (bins, file) =>
      Option.getOrElse(Arr.modify(bins, lightestIndex(bins), (bin) => bin.with(file, weightOf(file))), () => bins)
  )
  return Arr.map(filled, (bin) => bin.files)
}

/** The files of the one shard asked for, out of the balanced cut of them all. */
export const shardOf = <A>(
  files: ReadonlyArray<A>,
  shard: Shard,
  weightOf: (file: A) => number,
  keyOf: (file: A) => string
): ReadonlyArray<A> =>
  Option.getOrElse(
    Arr.get(balancedShards(files, shard.count, weightOf, keyOf), Number.subtract(shard.index, 1)),
    () => Arr.empty()
  )
