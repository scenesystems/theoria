import { Data, Effect, Number as Num, Option, Ref, Stream } from "effect"
import * as Arr from "effect/Array"

import { frames } from "./AnimationFrame.js"
import { AnswerRect, placeAnswer } from "./answer-placement.js"
import { BrowserDocument } from "./BrowserDocument.js"
import { BrowserWindow } from "./BrowserWindow.js"

const rectOf = (element: Element): AnswerRect => {
  const { left, top, width, height } = element.getBoundingClientRect()
  return new AnswerRect({ left, top, width, height })
}

class AnswerGeometry extends Data.Class<{
  readonly viewport: AnswerRect
  readonly trigger: AnswerRect
  readonly discs: ReadonlyArray<AnswerRect>
  readonly width: number
  readonly height: number
}> {}

/**
 * The portalled positioner's mount owns this stream. Frame reads include
 * scrolling, visual-viewport changes, resizing, and moving/transformed discs;
 * ResizeObserver alone cannot see the latter. Cancellation releases the frame
 * callback and all DOM references, including during a closing transition.
 */
export const placements = (positioner: HTMLElement) =>
  Stream.unwrap(Effect.gen(function*() {
    const document = yield* BrowserDocument
    const window = yield* BrowserWindow
    // Base UI removes data-popup-open before its closing animation unmounts.
    // Keep observing that anchor until the positioner's own lifetime ends.
    const lastTrigger = yield* Ref.make(Option.none<HTMLElement>())
    return frames.pipe(
      Stream.mapEffect(() =>
        Effect.gen(function*() {
          // A stable scrollbar gutter is not drawable, even when clientWidth
          // and visualViewport include it (Chromium's overlay-scrollbar mode).
          const documentWidth = document.documentElement.getBoundingClientRect().width
          const viewport = Option.match(Option.fromNullishOr(window.visualViewport), {
            onNone: () =>
              new AnswerRect({
                left: 12,
                top: 12,
                width: Num.subtract(Num.min(documentWidth, window.innerWidth), 24),
                height: Num.subtract(window.innerHeight, 24)
              }),
            onSome: (visual) =>
              new AnswerRect({
                left: Num.sum(visual.offsetLeft, 12),
                top: Num.sum(visual.offsetTop, 12),
                width: Num.subtract(Num.min(visual.width, Num.subtract(documentWidth, visual.offsetLeft)), 24),
                height: Num.subtract(visual.height, 24)
              })
          })
          const popup = positioner.querySelector<HTMLElement>("[data-place-provenance]")
          const trigger = yield* Ref.updateAndGet(lastTrigger, (previous) =>
            Option.orElse(
              Option.fromNullishOr(document.querySelector<HTMLElement>("[data-provenance][data-popup-open]")),
              () => previous
            ))
          positioner.style.setProperty("--answer-viewport-width", `${viewport.width}px`)
          return Option.map(
            Option.all([Option.fromNullishOr(popup), trigger]),
            ([surface, anchor]) => {
              const discs = Arr.map(
                Arr.fromIterable(document.querySelectorAll("[data-place-marker]:not([data-place-marker-leaving])")),
                (disc) =>
                  rectOf(Option.getOrElse(Option.fromNullishOr(disc.querySelector("[data-place-reach]")), () => disc))
              )
              return new AnswerGeometry({
                viewport,
                trigger: rectOf(anchor),
                discs,
                width: surface.offsetWidth,
                height: Num.sum(surface.scrollHeight, Num.subtract(surface.offsetHeight, surface.clientHeight))
              })
            }
          )
        })
      ),
      Stream.changes,
      Stream.map(Option.map((geometry: AnswerGeometry) =>
        placeAnswer(geometry.viewport, geometry.trigger, geometry.discs, geometry)
      )),
      Stream.changes,
      Stream.tap((placement) =>
        Effect.sync(() => {
          Option.match(placement, {
            onNone: () => {},
            onSome: ({ rect, kind }) => {
              positioner.style.setProperty("--answer-left", `${rect.left}px`)
              positioner.style.setProperty("--answer-top", `${rect.top}px`)
              positioner.style.setProperty("--answer-height", `${rect.height}px`)
              positioner.style.visibility = "visible"
              Option.match(Option.fromNullishOr(positioner.querySelector("[data-place-provenance]")), {
                onNone: () => {},
                onSome: (popup) =>
                  popup.setAttribute("data-answer-placement", kind)
              })
            }
          })
        })
      )
    )
  }))
