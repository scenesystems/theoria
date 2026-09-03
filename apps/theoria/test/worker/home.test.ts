// @vitest-environment node
import { expect, layer } from "@effect/vitest"
import { Effect, Fiber, Layer, Schema } from "effect"
import * as Arr from "effect/Array"
import * as Str from "effect/String"

import { cards } from "../../app/contracts/card.js"
import type { PlaceBuild } from "../../app/contracts/imagined-place-result.js"
import { PlaceBuildEnvelope } from "../../app/contracts/imagined-place-result.js"
import { PlaceBuildRequest } from "../../app/contracts/imagined-place.js"
import {
  act,
  attribute,
  BrowserLive,
  click,
  containsText,
  count,
  fitsViewport,
  goto,
  nextResponse,
  openPage,
  setViewport,
  visible
} from "./browser.js"
import { Site, SiteLive } from "./site.js"

const buildPath = "/api/imagined-place/build"

const decodeRequest = Schema.decodeUnknown(PlaceBuildRequest)
const decodeEnvelope = Schema.decodeUnknown(PlaceBuildEnvelope)

/** The build inside a successful envelope; a failure envelope fails the test. */
const successfulBuild = (body: unknown): Effect.Effect<PlaceBuild> =>
  decodeEnvelope(body).pipe(
    Effect.flatMap((envelope) =>
      envelope.ok ? Effect.succeed(envelope.data) : Effect.dieMessage(`build failed: ${envelope.error.code}`)
    ),
    Effect.orDie
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
        expect(yield* decodeRequest(initial.request().postDataJSON()).pipe(Effect.orDie)).toMatchObject({
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
        yield* containsText(current, "v2 · Current")
        yield* containsText(current, "Built from v1")
        yield* count(current.getByText(/^\+ /u), 1)
        yield* containsText(current, opened.evidence.lineage[1]?.contentId ?? "")
        yield* count(demo.getByText("did not verify"), 0)
        yield* count(demo.getByText("The place could not be built."), 0)

        // Merging the program's proposal rebuilds through the server: the merged
        // version now carries both features, so its content ID and signature change.
        const rebuild = yield* Effect.fork(nextResponse(page, "POST", buildPath))
        yield* click(merges.nth(1))
        const rebuilt = yield* Fiber.join(rebuild)
        expect(rebuilt.status()).toBe(200)
        expect(yield* decodeRequest(rebuilt.request().postDataJSON()).pipe(Effect.orDie)).toMatchObject({
          acceptNeighbor: true,
          acceptProgram: true
        })
        const merged = yield* successfulBuild(yield* act(() => rebuilt.json()))
        expect(Arr.map(merged.proposals, (record) => record.accepted)).toEqual([true, true])
        expect(merged.artifact.accepted).toHaveLength(2)
        expect(merged.evidence.lineage).toHaveLength(2)
        expect(merged.evidence.lineage[0]).toEqual(opened.evidence.lineage[0])
        expect(merged.evidence.lineage[1]?.contentId).not.toBe(opened.evidence.lineage[1]?.contentId)
        expect(merged.evidence.lineage[1]?.featureCount).toBeGreaterThan(opened.evidence.lineage[1]?.featureCount ?? 0)

        yield* attribute(merges.nth(1), "aria-checked", "true")
        yield* attribute(programCard, "data-place-recorded", "true")
        yield* count(demo.locator("[data-place-proposal=\"program\"][data-place-pending]"), 0)
        yield* count(programCard.getByText("In v2"), 1)
        yield* containsText(legend, "Proposer program")
        yield* count(versions, 2)
        yield* count(current.getByText(/^\+ /u), 2)
        yield* containsText(current, merged.evidence.lineage[1]?.contentId ?? "")
        yield* containsText(current, "You signed · key")
        yield* count(demo.getByText("did not verify"), 0)
        expect(yield* failures).toEqual([])
      }))

    it.scoped("the package catalog stays complete and unscrolled across responsive widths", () =>
      Effect.gen(function*() {
        const { manifest } = yield* Site
        const { failures, page } = yield* openPage({ viewport: { width: 320, height: 800 } })

        yield* goto(page, "/")
        // The home page is the integrated demo; the package catalog lives on the docs landing page.
        yield* visible(page.getByRole("region", { name: "Imagined place demo" }))
        yield* count(page.locator("a[href^=\"/demos/\"]"), 0)

        yield* click(page.getByRole("link", { exact: true, name: "Browse the packages" }))
        yield* visible(page.getByRole("heading", { level: 1, name: "Packages" }))

        // Every documented package has a card, and each card shows the manifest's version.
        expect(Arr.sort(Arr.map(manifest.packages, (docsPackage) => docsPackage.slug), Str.Order)).toEqual(
          Arr.sort(Arr.map(cards, (card) => card.id), Str.Order)
        )
        const catalog = page.locator("main")
        const packageCards = catalog.locator("[data-docs-package]")
        yield* count(packageCards, manifest.packages.length)
        yield* Effect.forEach(manifest.packages, (docsPackage) => {
          const card = catalog.locator(`[data-docs-package="${docsPackage.slug}"]`)
          return Effect.all([
            visible(card.getByRole("link", { name: docsPackage.name })),
            attribute(card.getByRole("link", { name: docsPackage.name }), "href", docsPackage.overview.path),
            containsText(card, `v${docsPackage.version}`)
          ])
        })

        yield* Effect.forEach([320, 768, 1280], (width) =>
          Effect.gen(function*() {
            yield* setViewport(page, { width, height: 800 })
            yield* count(packageCards, manifest.packages.length)
            expect(yield* fitsViewport(page)).toBe(true)
          }))
        expect(yield* failures).toEqual([])
      }))
  }
)
