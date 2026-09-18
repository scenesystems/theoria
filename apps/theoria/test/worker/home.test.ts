// @vitest-environment node
import { expect, layer } from "@effect/vitest"
import { Numeric } from "@scenesystems/effect-math"
import { Boolean, Effect, Fiber, Layer, Match, Number as Num, Option, Schema } from "effect"
import * as Arr from "effect/Array"
import * as Str from "effect/String"
import { evaluate, evaluateElement } from "./browser.js"

import { PlaceBuildEnvelope } from "../../app/contracts/imagined-place-result.js"
import { PlaceBuildRequest } from "../../app/contracts/imagined-place.js"
import { howItsBuiltActionLabel, howItsBuiltSectionId } from "../../app/web/view/home/HomeHero.js"
import { placeArriveText, placeArriveTitle } from "../../app/web/view/home/PlaceArrive.js"
import {
  act,
  attribute,
  BrowserLive,
  click,
  containsText,
  count,
  eventually,
  fitsViewport,
  goto,
  nextResponse,
  openPage,
  scrollPositions,
  setViewport,
  urlMatches,
  visible
} from "./browser.js"
import { drawn } from "./demo.js"
import {
  boxOf,
  fullyInViewport,
  scrollPast,
  scrollToTop,
  scrollY,
  surfaceStyle,
  textFitsBox,
  topEdgeInViewport,
  typographyOf
} from "./platform/in-page.js"
import { Site, SiteLive } from "./site.js"

const buildPath = "/api/imagined-place/build"

const decodeRequest = Schema.decodeUnknown(PlaceBuildRequest)
const decodeEnvelope = Schema.decodeUnknown(PlaceBuildEnvelope)

/** The build inside a successful envelope; a failure envelope fails the test. */
const successfulBuild = (body: unknown) =>
  decodeEnvelope(body).pipe(
    Effect.flatMap((envelope) =>
      Match.value(envelope).pipe(
        Match.when({ ok: true }, ({ data }) => Effect.succeed(data)),
        Match.when({ ok: false }, ({ error }) => Effect.dieMessage(`build failed: ${error.code}`)),
        Match.exhaustive
      )
    )
  )

layer(Layer.merge(SiteLive, BrowserLive), { excludeTestServices: true, timeout: "2 minutes" })(
  "Theoria home page in Chromium",
  (it) => {
    it.scoped("the imagined place is built by the real API and re-digested when a proposal is merged", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage()

        const firstBuild = yield* Effect.fork(nextResponse(page, "POST", buildPath))
        yield* goto(page, "/")
        const demo = page.getByRole("region", { name: "Imagined place demo" })
        yield* visible(demo)

        // The page opens with the recorded brief: the neighbor's proposal merged, the program's not.
        const initial = yield* Fiber.join(firstBuild)
        expect(initial.status()).toBe(200)
        expect(yield* decodeRequest(initial.request().postDataJSON())).toMatchObject({
          acceptNeighbor: true,
          acceptProgram: false
        })
        const opened = yield* successfulBuild(yield* act(() => initial.json()))
        expect(Arr.map(opened.proposals, (record) => record.accepted)).toEqual([true, false])
        expect(opened.artifact.accepted).toHaveLength(1)

        const merges = demo.getByRole("switch")
        yield* count(merges, 2)
        yield* attribute(merges.nth(0), "aria-checked", "true")
        yield* attribute(merges.nth(1), "aria-checked", "false")

        // Each card says whether the recorded version holds its proposal; the legend lists only who is in it.
        const neighborCard = demo.locator("[data-place-proposal=\"neighbor\"]")
        const programCard = demo.locator("[data-place-proposal=\"program\"]")
        yield* attribute(neighborCard, "data-place-recorded", "true")
        yield* attribute(programCard, "data-place-recorded", "false")
        yield* count(neighborCard.getByText("In v2"), 1)
        yield* count(programCard.getByText("In v2"), 0)
        const legend = demo.locator("[data-place-legend-participants]")
        yield* containsText(legend, "Neighbor")
        yield* count(legend.getByText("Proposer program"), 0)

        // Lineage: the origin, then one merged version digesting the origin as its parent.
        const versions = demo.locator("[data-place-version]")
        yield* count(versions, 2)
        const current = demo.locator("[data-place-version=\"2\"]")
        const openedCurrent = Option.getOrThrow(Arr.get(opened.evidence.lineage, 1))
        yield* containsText(current, "V2 · Current")
        yield* count(current.getByText(/^\+ /u), 1)
        yield* containsText(current, openedCurrent.contentId)
        yield* count(demo.getByText("did not verify"), 0)
        yield* count(demo.getByText("The place could not be built."), 0)

        // Merging the program's proposal rebuilds through the server: the merged
        // version now carries both features, so its content ID and signature change.
        const rebuild = yield* Effect.fork(nextResponse(page, "POST", buildPath))
        yield* click(merges.nth(1))
        const rebuilt = yield* Fiber.join(rebuild)
        expect(rebuilt.status()).toBe(200)
        expect(yield* decodeRequest(rebuilt.request().postDataJSON())).toMatchObject({
          acceptNeighbor: true,
          acceptProgram: true
        })
        const merged = yield* successfulBuild(yield* act(() => rebuilt.json()))
        expect(Arr.map(merged.proposals, (record) => record.accepted)).toEqual([true, true])
        expect(merged.artifact.accepted).toHaveLength(2)
        expect(merged.evidence.lineage).toHaveLength(2)
        const openedOrigin = Option.getOrThrow(Arr.get(opened.evidence.lineage, 0))
        const mergedOrigin = Option.getOrThrow(Arr.get(merged.evidence.lineage, 0))
        const mergedCurrent = Option.getOrThrow(Arr.get(merged.evidence.lineage, 1))
        expect(mergedOrigin).toEqual(openedOrigin)
        expect(mergedCurrent.contentId).not.toBe(openedCurrent.contentId)
        expect(mergedCurrent.featureCount).toBeGreaterThan(openedCurrent.featureCount)

        yield* attribute(merges.nth(1), "aria-checked", "true")
        yield* attribute(programCard, "data-place-recorded", "true")
        yield* count(demo.locator("[data-place-proposal=\"program\"][data-place-pending]"), 0)
        yield* count(programCard.getByText("In v2"), 1)
        yield* containsText(legend, "Proposer program")
        yield* count(versions, 2)
        yield* count(current.getByText(/^\+ /u), 2)
        yield* containsText(current, mergedCurrent.contentId)
        yield* containsText(current, "You signed · key")
        yield* count(demo.getByText("did not verify"), 0)
        expect(yield* failures).toEqual([])
      }))

    it.scoped("the place sits on the canvas: no surface between the page and the drawing", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage()
        yield* goto(page, "/")
        const demo = page.getByRole("region", { name: "Imagined place demo" })
        yield* visible(demo)
        // The blank paper stands in for the drawn one until the first frame; it
        // is the drawn paper that is asked, once the drawing has replaced the blank.
        const paper = demo.locator("[data-place-stage='paper']:not([aria-busy])")
        yield* visible(paper)

        // The page, the demo and the drawn paper are one canvas: none of them
        // is boxed by a border, rounded off or lifted by a shadow.
        const onCanvas = { border: "0px 0px 0px 0px", radius: "0px", shadow: "none" }
        expect(yield* evaluateElement(page.locator("main"), surfaceStyle)).toEqual(onCanvas)
        expect(yield* evaluateElement(demo, surfaceStyle)).toEqual(onCanvas)
        expect(yield* evaluateElement(demo.locator("[data-artifact-stage='frame']"), surfaceStyle)).toEqual(
          onCanvas
        )
        expect(yield* evaluateElement(paper, surfaceStyle)).toEqual(onCanvas)
        expect(yield* failures).toEqual([])
      }))

    it.scoped("the hero and the place share the first viewport", () =>
      Effect.gen(function*() {
        const { failures, page } = yield* openPage({ viewport: { width: 1440, height: 900 } })
        yield* goto(page, "/")
        const demo = page.getByRole("region", { name: "Imagined place demo" })
        const paper = demo.locator("[data-place-stage='paper']")
        yield* visible(paper)
        // The seeded search moves the discs while it runs; the claim is about the kept drawing.
        yield* drawn(page)
        yield* visible(demo.locator("[data-place-marker]").first())

        // Wide: the hero reads first; the arrival follows on the same screen,
        // and the demonstration begins under it with Compose and Arrange
        // starting on one line, so the first scroll reads down both columns.
        const heading = page.getByRole("heading", { level: 1 })
        const browse = page.getByRole("link", { exact: true, name: "Browse the packages" })
        const arriveTitle = demo.locator("[data-place-arrive] h2")
        expect(yield* evaluateElement(heading, topEdgeInViewport)).toBe(true)
        expect(yield* evaluateElement(browse, topEdgeInViewport)).toBe(true)
        expect(yield* evaluateElement(arriveTitle, topEdgeInViewport)).toBe(true)
        expect(yield* evaluateElement(demo.locator("[data-place-arrive] p"), topEdgeInViewport)).toBe(true)
        expect(
          yield* evaluateElement(
            demo.locator("[data-place-step='compose'] [data-place-step-header]"),
            topEdgeInViewport
          )
        ).toBe(true)
        expect(yield* evaluateElement(paper, topEdgeInViewport)).toBe(true)
        expect(yield* evaluateElement(demo.locator("[data-place-marker]").first(), fullyInViewport)).toBe(true)
        expect(
          yield* evaluateElement(
            demo.locator("[data-place-step='arrange'] [data-place-step-header]"),
            topEdgeInViewport
          )
        ).toBe(true)
        // The arrival says what this is and how it works; the place's name and
        // its story stay on the paper, where the composer put them.
        const arrive = demo.locator("[data-place-arrive]")
        yield* containsText(arriveTitle, placeArriveTitle)
        yield* containsText(arrive, placeArriveText)
        yield* count(arrive.getByText(/at high water the sea covers the causeway/u), 0)
        const composedTitle = yield* Option.fromNullable(
          yield* act(() => demo.locator("[data-place-composition-title]").textContent())
        )
        yield* count(arrive.getByText(composedTitle, { exact: true }), 0)

        // Narrow: the hero, both actions and the demonstration's title fit the
        // first screen; the paper follows directly under the arrival.
        yield* setViewport(page, { width: 390, height: 844 })
        yield* evaluate(page, scrollToTop)
        expect(yield* evaluateElement(heading, topEdgeInViewport)).toBe(true)
        expect(yield* evaluateElement(browse, topEdgeInViewport)).toBe(true)
        const howItsBuilt = page.getByRole("link", { exact: true, name: howItsBuiltActionLabel })
        expect(yield* evaluateElement(howItsBuilt, topEdgeInViewport)).toBe(true)
        expect(yield* evaluateElement(arriveTitle, topEdgeInViewport)).toBe(true)
        expect(yield* evaluateElement(paper, topEdgeInViewport)).toBe(true)

        // The hero's second action lands on how the demonstration is built, not on the demonstration already in view.
        yield* click(howItsBuilt)
        yield* urlMatches(page, new RegExp(`#${howItsBuiltSectionId}$`, "u"))
        yield* eventually(evaluateElement(page.locator("[data-place-how-its-built]"), topEdgeInViewport), true)
        expect(yield* failures).toEqual([])
      }))

    it.scoped("same-document anchors glide unless reduced motion asks them to land at once", () =>
      Effect.gen(function*() {
        const smooth = yield* openPage({
          viewport: { width: 1440, height: 900 },
          reducedMotion: "no-preference"
        })
        yield* goto(smooth.page, "/")
        const smoothLink = smooth.page.getByRole("link", { name: howItsBuiltActionLabel })
        const start = yield* evaluate(smooth.page, scrollY)
        yield* click(smoothLink)
        // The page passes through positions on its way: a glide, not a jump.
        const gliding = yield* scrollPositions(smooth.page, 24)
        yield* eventually(evaluateElement(smooth.page.locator("[data-place-how-its-built]"), topEdgeInViewport), true)
        const finish = yield* evaluate(smooth.page, scrollY)
        expect(finish).toBeGreaterThan(start)
        expect(
          Arr.some(gliding, (position) => Boolean.and(Num.greaterThan(position, start), Num.lessThan(position, finish)))
        ).toBe(true)
        yield* urlMatches(smooth.page, /#how-its-built$/u)

        const reduced = yield* openPage({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" })
        yield* goto(reduced.page, "/")
        const reducedStart = yield* evaluate(reduced.page, scrollY)
        yield* click(reduced.page.getByRole("link", { name: howItsBuiltActionLabel }))
        // Under reduced motion the page is where it is going from the first frame that moves.
        const landing = yield* scrollPositions(reduced.page, 24)
        yield* eventually(evaluateElement(reduced.page.locator("[data-place-how-its-built]"), topEdgeInViewport), true)
        const landed = yield* evaluate(reduced.page, scrollY)
        expect(
          Arr.every(
            landing,
            (position) => Boolean.or(Num.Equivalence(position, reducedStart), Num.Equivalence(position, landed))
          )
        ).toBe(true)
        yield* urlMatches(reduced.page, /#how-its-built$/u)

        const demo = reduced.page.getByRole("region", { name: "Imagined place demo" })
        const paper = demo.locator("[data-place-stage='paper']")
        yield* evaluateElement(paper, scrollPast)
        const band = reduced.page.locator("[data-place-band]")
        yield* visible(band)
        yield* click(band.getByRole("link", { name: "Back to the place" }))
        yield* eventually(evaluateElement(paper, topEdgeInViewport), true)
        yield* urlMatches(reduced.page, /#imagined-place$/u)
        expect(yield* smooth.failures).toEqual([])
        expect(yield* reduced.failures).toEqual([])
      }))

    it.scoped("the package index stays complete and unscrolled across responsive widths", () =>
      Effect.gen(function*() {
        const { manifest } = yield* Site
        const { failures, page } = yield* openPage({ viewport: { width: 320, height: 800 } })

        yield* goto(page, "/")
        // The home page is the integrated demo; the package index lives at /docs.
        yield* visible(page.getByRole("region", { name: "Imagined place demo" }))
        yield* count(page.locator("a[href^=\"/demos/\"]"), 0)

        yield* click(page.getByRole("link", { exact: true, name: "Browse the packages" }))
        yield* visible(page.getByRole("heading", { level: 1, name: "Packages" }))

        // Every documented package has a card, and each card shows the manifest's version.
        const packageIndex = page.locator("main")
        const packageCards = packageIndex.locator("[data-docs-package]")
        yield* count(packageCards, Arr.length(manifest.packages))
        yield* Effect.forEach(manifest.packages, (docsPackage) => {
          const card = packageIndex.locator(`[data-docs-package="${docsPackage.slug}"]`)
          return Effect.all([
            visible(card.getByRole("link", { name: docsPackage.name })),
            attribute(card.getByRole("link", { name: docsPackage.name }), "href", docsPackage.overview.path),
            containsText(card, `v${docsPackage.version}`)
          ])
        })

        // Include both sides of column transitions, not just device presets. Every row shares the
        // same card height; a long package identifier must fit in full, not wrap or be clipped.
        yield* Effect.forEach([320, 390, 639, 640, 768, 919, 920, 935, 936, 1280, 1391, 1392, 1920, 2560], (width) =>
          Effect.gen(function*() {
            yield* setViewport(page, { width, height: 800 })
            yield* count(packageCards, Arr.length(manifest.packages))
            expect(yield* fitsViewport(page)).toBe(true)
            const first = yield* evaluateElement(packageCards.first(), boxOf)
            yield* Effect.forEach(manifest.packages, (docsPackage) =>
              Effect.gen(function*() {
                const card = packageIndex.locator(`[data-docs-package="${docsPackage.slug}"]`)
                const box = yield* evaluateElement(card, boxOf)
                const title = card.getByRole("heading", { name: docsPackage.name, exact: true })
                const titleBox = yield* evaluateElement(title, boxOf)
                const type = yield* evaluateElement(title, typographyOf)
                const leading = yield* Schema.decodeUnknown(Schema.NumberFromString)(
                  Str.replace("px", "")(type.leading)
                )
                const size = yield* Schema.decodeUnknown(Schema.NumberFromString)(Str.replace("px", "")(type.size))
                expect(titleBox.height, `${docsPackage.slug} title at ${width}px`).toBeLessThanOrEqual(
                  Num.sum(leading, 1)
                )
                expect(yield* evaluateElement(title, textFitsBox)).toBe(true)
                expect(size).toBeGreaterThanOrEqual(16)
                expect(Numeric.abs(Num.subtract(box.width, first.width)), `card width at ${width}px`).toBeLessThan(1)
                expect(Numeric.abs(Num.subtract(box.height, first.height)), `card height at ${width}px`).toBeLessThan(1)
              }))
          }))
        expect(yield* failures).toEqual([])
      }))
  }
)
