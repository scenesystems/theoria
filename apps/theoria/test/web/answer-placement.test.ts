import { expect, it } from "@effect/vitest"
import { Boolean as Bool, Effect, Match, Schema } from "effect"
import * as Arr from "effect/Array"

import { AnswerRect, placeAnswer } from "../../app/web/platform/answer-placement.js"

const rect = (left: number, top: number, width: number, height: number) => new AnswerRect({ left, top, width, height })

it.effect("uses an exactly 96px gap rather than falling back for decorative spacing", () =>
  Effect.sync(() => {
    const trigger = rect(0, 96, 240, 144)
    expect(placeAnswer(rect(0, 0, 240, 240), trigger, [trigger], { width: 180, height: 200 }).kind).toBe("free")
  }))

it.effect("shifts below every disc when flipping below the trigger would cover its neighbour", () =>
  Effect.sync(() => {
    const trigger = rect(280, 20, 44, 44)
    const neighbour = rect(285, 80, 50, 50)
    const answer = placeAnswer(rect(12, 12, 366, 820), trigger, [trigger, neighbour], { width: 352, height: 275 })
    expect(answer.kind).toBe("free")
    expect(answer.rect.top).toBeGreaterThanOrEqual(130)
    expect(answer.rect.left + answer.rect.width).toBeLessThanOrEqual(378)
  }))

it.effect("shortens a long answer to the largest free reading region", () =>
  Effect.sync(() => {
    const trigger = rect(200, 100, 44, 44)
    const lower = rect(200, 500, 44, 44)
    const answer = placeAnswer(rect(12, 12, 366, 820), trigger, [trigger, lower], { width: 352, height: 2400 })
    expect(answer.kind).toBe("free")
    expect(answer.rect.height).toBeGreaterThanOrEqual(340)
    expect(answer.rect.top).toBeGreaterThanOrEqual(144)
    expect(answer.rect.top + answer.rect.height).toBeLessThanOrEqual(500)
  }))

it.effect("fallback minimizes covered discs, then covers the farthest disc", () =>
  Effect.sync(() => {
    const trigger = rect(0, 0, 40, 180)
    const near = rect(70, 0, 40, 180)
    const far = rect(250, 0, 40, 180)
    const answer = placeAnswer(rect(0, 0, 320, 180), trigger, [trigger, near, far], { width: 180, height: 160 })
    expect(answer.kind).toBe("fallback")
    expect(answer.rect.left).toBeGreaterThanOrEqual(110)
    expect(answer.rect.left + answer.rect.width).toBeLessThanOrEqual(320)
  }))

const obstacle = Schema.Struct({
  left: Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 200 })),
  top: Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 180 })),
  width: Schema.Int.check(Schema.isBetween({ minimum: 10, maximum: 60 })),
  height: Schema.Int.check(Schema.isBetween({ minimum: 10, maximum: 60 }))
})

it.effect.prop("fallback occurs only when an exhaustive pixel search finds no readable free rectangle", {
  obstacles: Schema.Array(obstacle).check(Schema.isMinLength(1), Schema.isMaxLength(6))
}, ({ obstacles }) =>
  Effect.sync(() => {
    const trigger = rect(110, 90, 30, 30)
    const discs = Arr.map(obstacles, (value) => new AnswerRect(value))
    const answer = placeAnswer(rect(0, 0, 240, 240), trigger, discs, { width: 180, height: 200 })
    // Independent exhaustive reference: integer inputs admit a free box at integer
    // coordinates. Test the minimum readable height, not the solver's candidates.
    const clear = (left: number, top: number, width: number, height: number) =>
      Arr.every(Arr.append(discs, trigger), (disc) =>
        Bool.some([
          left + width <= disc.left,
          left >= disc.left + disc.width,
          top + height <= disc.top,
          top >= disc.top + disc.height
        ]))
    const freeExists = Arr.some(Arr.range(0, 60), (left) =>
      Arr.some(Arr.range(0, 144), (top) => clear(left, top, 180, 96)))
    expect(answer.rect.left).toBeGreaterThanOrEqual(0)
    expect(answer.rect.top).toBeGreaterThanOrEqual(0)
    expect(answer.rect.left + answer.rect.width).toBeLessThanOrEqual(240)
    expect(answer.rect.top + answer.rect.height).toBeLessThanOrEqual(240)
    Match.value(answer.kind).pipe(
      Match.when("free", () => {
        expect(freeExists).toBe(true)
        expect(clear(answer.rect.left, answer.rect.top, answer.rect.width, answer.rect.height)).toBe(true)
      }),
      Match.when("fallback", () =>
        expect(freeExists).toBe(false)),
      Match.exhaustive
    )
  }))
