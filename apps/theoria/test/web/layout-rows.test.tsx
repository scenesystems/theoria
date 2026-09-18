import { describe, expect, it } from "@effect/vitest"
import { Effect, Either, Layer, MutableRef, Number as Num, Schema } from "effect"
import * as Option from "effect/Option"
import type { ReactNode } from "react"

import { observeOnMount } from "../../app/web/atoms/element-observation.js"
import * as BrowserDocument from "../../app/web/platform/BrowserDocument.js"
import * as BrowserWindow from "../../app/web/platform/BrowserWindow.js"
import { Cluster, Rail, RowAlign } from "../../app/web/view/primitives/Layout.js"
import { mountReact, waitForValue } from "../helpers/react-mount.js"

const BrowserTest = Layer.merge(BrowserWindow.layer, BrowserDocument.layer)

const mountedRow = (node: ReactNode) =>
  Effect.flatMap(
    mountReact(node),
    ({ container }) => waitForValue(() => Option.fromNullable(container.firstElementChild))
  )

/**
 * A row is a Base UI slot: whatever the caller composes it with keeps the
 * caller's element, attributes, handlers and ref, and lets go of them when
 * the row leaves. Where its items rest is measured in Chromium, where a
 * stylesheet can be asked; here the row's contract with its caller is.
 */
describe("layout rows", () => {
  it.live("render as the element the caller composes them with, keeping the caller's attributes and children", () =>
    Effect.gen(function*() {
      const row = yield* mountedRow(
        <Cluster align="baseline" className="caller-mark" render={<ul aria-label="Things" />}>
          <li>one</li>
          <li>two</li>
        </Cluster>
      )

      expect(row.tagName).toBe("UL")
      expect(row.getAttribute("aria-label")).toBe("Things")
      expect(row.classList.contains("caller-mark")).toBe(true)
      expect(row.querySelectorAll(":scope > li")).toHaveLength(2)
    }).pipe(Effect.scoped, Effect.provide(BrowserTest)))

  it.live("forward the caller's handlers to the element they render", () =>
    Effect.gen(function*() {
      const browserWindow = yield* BrowserWindow.BrowserWindow
      const clicks = MutableRef.make(0)
      const row = yield* mountedRow(<Rail onClick={() => MutableRef.update(clicks, Num.increment)} />)

      row.dispatchEvent(new browserWindow.MouseEvent("click", { bubbles: true }))

      expect(MutableRef.get(clicks)).toBe(1)
    }).pipe(Effect.scoped, Effect.provide(BrowserTest)))

  it.live("hand the caller's ref the element while mounted, and take it back when the row leaves", () =>
    Effect.gen(function*() {
      const held = MutableRef.make(Option.none<Element>())
      const hold = observeOnMount<HTMLDivElement>((element) => {
        MutableRef.set(held, Option.some(element))
        return () => MutableRef.set(held, Option.none())
      })

      yield* Effect.scoped(
        Effect.gen(function*() {
          const row = yield* mountedRow(<Rail ref={hold} />)
          const holding = MutableRef.get(held)
          expect(Option.isSome(holding) && holding.value === row, "the ref holds the rendered element").toBe(true)
        })
      )

      expect(MutableRef.get(held)).toEqual(Option.none())
    }).pipe(Effect.provide(BrowserTest)))

  it.effect("refuse an alignment the row cannot draw", () =>
    Effect.sync(() => {
      expect(Either.isLeft(Schema.decodeUnknownEither(RowAlign)("middle"))).toBe(true)
      expect(Schema.decodeUnknownEither(RowAlign)("baseline")).toEqual(Either.right("baseline"))
    }))
})
