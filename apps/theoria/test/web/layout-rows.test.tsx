import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import * as Arr from "effect/Array"
import * as Option from "effect/Option"
import * as Str from "effect/String"
import type { ReactNode } from "react"

import * as BrowserDocument from "../../app/web/platform/BrowserDocument.js"
import { Cluster, Rail } from "../../app/web/view/primitives/Layout.js"
import { mountReact, waitForValue } from "../helpers/react-mount.js"

const alignmentClasses = (element: Element): ReadonlyArray<string> =>
  Arr.filter(Str.split(element.className, " "), (name) => name.startsWith("items-"))

const mountedRow = (node: ReactNode): Effect.Effect<Element> =>
  Effect.flatMap(
    mountReact(node),
    ({ container }) => waitForValue(() => Option.fromNullable(container.firstElementChild))
  )
    .pipe(Effect.scoped, Effect.provide(BrowserDocument.layer))

/**
 * A row's classes are joined, not merged, so the stylesheet decides between
 * two `items-*` utilities on one element. The row must therefore carry exactly
 * one, chosen by its `align` prop.
 */
describe("layout rows", () => {
  it.live("centre their items unless asked otherwise", () =>
    Effect.gen(function*() {
      const cluster = yield* mountedRow(<Cluster className="gap-2" />)
      const rail = yield* mountedRow(<Rail className="gap-2" />)

      expect(alignmentClasses(cluster)).toEqual(["items-center"])
      expect(alignmentClasses(rail)).toEqual(["items-center"])
    }))

  it.live("carry exactly the asked alignment", () =>
    Effect.gen(function*() {
      const baseline = yield* mountedRow(<Cluster align="baseline" className="gap-2" />)
      const start = yield* mountedRow(<Rail align="start" className="gap-2" />)

      expect(alignmentClasses(baseline)).toEqual(["items-baseline"])
      expect(alignmentClasses(start)).toEqual(["items-start"])
    }))

  it.live("keep the caller's other classes and the row's base", () =>
    Effect.gen(function*() {
      const cluster = yield* mountedRow(<Cluster align="baseline" className="justify-between gap-3" />)

      expect(cluster.className).toBe("flex min-w-0 flex-wrap items-baseline justify-between gap-3")
    }))
})
