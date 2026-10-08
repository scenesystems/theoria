import { expect, it } from "@effect/vitest"
import { Array as Arr, Boolean as Bool, Effect, MutableRef, Option } from "effect"
import { AnimatePresence } from "motion/react"
import { Profiler } from "react"
import { flushSync } from "react-dom"

import { PlaceMarker } from "../../app/contracts/imagined-place-result.js"
import * as BrowserDocument from "../../app/web/platform/BrowserDocument.js"
import { PlaceMarkerDisc } from "../../app/web/view/home/PlaceMarker.js"
import { mountReact } from "../helpers/react-mount.js"

it.live("removes a leaving disc in the replacement commit, before passive presence cleanup", () =>
  Effect.gen(function*() {
    const { container, root } = yield* mountReact(null)
    const marker = PlaceMarker.make({
      name: "Leaving",
      description: "Old geometry",
      x: 80,
      y: 60,
      radius: 24,
      reach: 0
    })
    const drawing = (present: boolean, onCommit: () => void) => (
      <Profiler id="drawing" onRender={onCommit}>
        <AnimatePresence initial={false}>
          {Bool.match(present, {
            onTrue: () => (
              <PlaceMarkerDisc
                drawn="leaving"
                index={0}
                key={marker.name}
                labelWidth={Option.none()}
                marker={marker}
                source="previous-story"
              />
            ),
            onFalse: () => null
          })}
        </AnimatePresence>
      </Profiler>
    )
    yield* Effect.sync(() => flushSync(() => root.render(drawing(true, () => {}))))
    expect(container.querySelector("[data-place-marker-leaving]")).not.toBeNull()
    const commits = MutableRef.make(Arr.empty<number>())
    yield* Effect.sync(() =>
      flushSync(() =>
        root.render(drawing(false, () => {
          MutableRef.update(commits, Arr.append(container.querySelectorAll("[data-place-marker-leaving]").length))
        }))
      )
    )
    expect(MutableRef.get(commits).length).toBeGreaterThan(0)
    expect(MutableRef.get(commits)).not.toContain(1)
  }).pipe(Effect.scoped, Effect.provide(BrowserDocument.layer)))
