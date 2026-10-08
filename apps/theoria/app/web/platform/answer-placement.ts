import { Boolean as Bool, Data, Number as Num, Option, Order } from "effect"
import * as Arr from "effect/Array"

import * as Numeric from "@scenesystems/effect-math/Numeric"

/** Viewport coordinates, including a disc's invisible touch reach. */
export class AnswerRect extends Data.Class<{
  readonly left: number
  readonly top: number
  readonly width: number
  readonly height: number
}> {}

export class AnswerPlacement extends Data.Class<{
  readonly rect: AnswerRect
  readonly kind: "free" | "fallback"
}> {}

const right = (rect: AnswerRect) => Num.sum(rect.left, rect.width)
const bottom = (rect: AnswerRect) => Num.sum(rect.top, rect.height)
const gap = 8

export const answersOverlap = (a: AnswerRect, b: AnswerRect): boolean =>
  Bool.every([
    a.left < right(b),
    right(a) > b.left,
    a.top < bottom(b),
    bottom(a) > b.top
  ])

/**
 * Prefer a whole answer above its trigger, then the nearest free whole box.
 * Candidate edges include every obstacle, so side and shifted placements are
 * considered as well as top/bottom. If no whole box fits, use the tallest free
 * reading region (at least 96px), scrolling its contents. If none exists,
 * every tap must still answer: cover the fewest discs, preferring those
 * farthest from the trigger. Escape or outside-dismiss restores their access.
 */
export const placeAnswer = (
  viewport: AnswerRect,
  trigger: AnswerRect,
  discs: ReadonlyArray<AnswerRect>,
  size: { readonly width: number; readonly height: number }
): AnswerPlacement => {
  const width = Num.min(size.width, viewport.width)
  const height = Num.min(size.height, viewport.height)
  const obstacles = Arr.append(discs, trigger)
  const preferredLeft = Num.subtract(
    Num.sum(trigger.left, Num.divideUnsafe(trigger.width, 2)),
    Num.divideUnsafe(width, 2)
  )
  const preferredTop = Num.subtract(Num.subtract(trigger.top, gap), height)
  const xs = Arr.dedupe(Arr.map(
    Arr.appendAll(
      [preferredLeft, viewport.left, Num.subtract(right(viewport), width)],
      Arr.flatMap(
        obstacles,
        (
          rect
        ) => [
          Num.subtract(Num.subtract(rect.left, gap), width),
          Num.sum(right(rect), gap),
          Num.subtract(rect.left, width),
          right(rect)
        ]
      )
    ),
    Num.clamp({ minimum: viewport.left, maximum: Num.subtract(right(viewport), width) })
  ))
  const ys = Arr.dedupe(Arr.map(
    Arr.appendAll(
      [preferredTop, Num.sum(bottom(trigger), gap), viewport.top, Num.subtract(bottom(viewport), height)],
      Arr.flatMap(
        obstacles,
        (
          rect
        ) => [
          Num.subtract(Num.subtract(rect.top, gap), height),
          Num.sum(bottom(rect), gap),
          Num.subtract(rect.top, height),
          bottom(rect)
        ]
      )
    ),
    Num.clamp({ minimum: viewport.top, maximum: Num.subtract(bottom(viewport), height) })
  ))
  const clear = (rect: AnswerRect) => Arr.every(obstacles, (disc) => Bool.not(answersOverlap(rect, disc)))
  const distance = (rect: AnswerRect) =>
    Num.sum(Numeric.abs(Num.subtract(rect.left, preferredLeft)), Numeric.abs(Num.subtract(rect.top, preferredTop)))
  const nearest = Order.mapInput(Num.Order, distance)
  const whole = Arr.flatMap(xs, (left) => Arr.map(ys, (top) => new AnswerRect({ left, top, width, height })))
  const spaced = (rect: AnswerRect) =>
    clear(
      new AnswerRect({
        left: Num.subtract(rect.left, gap),
        top: Num.subtract(rect.top, gap),
        width: Num.sum(rect.width, Num.multiply(gap, 2)),
        height: Num.sum(rect.height, Num.multiply(gap, 2))
      })
    )
  return Arr.head(Arr.sort(Arr.filter(whole, spaced), nearest)).pipe(
    Option.orElse(() => Arr.head(Arr.sort(Arr.filter(whole, clear), nearest))),
    Option.orElse(() => {
      const tops = Arr.prepend(Arr.map(obstacles, bottom), viewport.top)
      const shortened = Arr.flatMap(xs, (left) =>
        Arr.map(tops, (top) => {
          const ceiling = Arr.reduce(obstacles, bottom(viewport), (limit, disc) =>
            Bool.match(Bool.every([right(disc) > left, disc.left < Num.sum(left, width), disc.top >= top]), {
              onTrue: () =>
                Num.min(limit, disc.top),
              onFalse: () =>
                limit
            }))
          return new AnswerRect({ left, top, width, height: Num.min(height, Num.subtract(ceiling, top)) })
        }))
      return Arr.head(Arr.sort(
        Arr.filter(shortened, (rect) =>
          Bool.every([
            rect.top >= viewport.top,
            bottom(rect) <= bottom(viewport),
            rect.height >= Num.min(96, height),
            clear(rect)
          ])),
        Order.combine(Order.mapInput(Order.flip(Num.Order), (rect: AnswerRect) => rect.height), nearest)
      ))
    }),
    Option.match({
      onSome: (rect) => new AnswerPlacement({ rect, kind: "free" }),
      onNone: () => {
        const covered = (rect: AnswerRect) => Arr.filter(discs, (disc) => answersOverlap(rect, disc))
        const coveredDistance = (rect: AnswerRect) =>
          Arr.reduce(
            covered(rect),
            0,
            (total, disc) =>
              Num.sum(
                total,
                Num.sum(
                  Numeric.abs(Num.subtract(disc.left, trigger.left)),
                  Numeric.abs(Num.subtract(disc.top, trigger.top))
                )
              )
          )
        const order = Order.combineAll([
          Order.mapInput(Num.Order, (rect: AnswerRect) => covered(rect).length),
          Order.mapInput(Order.flip(Num.Order), coveredDistance),
          nearest
        ])
        const rect = Arr.reduce(
          whole,
          new AnswerRect({ left: viewport.left, top: viewport.top, width, height }),
          (best, candidate) => Bool.match(order(candidate, best) < 0, { onTrue: () => candidate, onFalse: () => best })
        )
        return new AnswerPlacement({ rect, kind: "fallback" })
      }
    })
  )
}
