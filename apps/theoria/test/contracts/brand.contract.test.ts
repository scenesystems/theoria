import { FileSystem, Path, Url } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import * as Numeric from "@scenesystems/effect-math/Numeric"
import { Effect, Number as Num, Option, Order, Schema } from "effect"
import * as Arr from "effect/Array"
import * as Str from "effect/String"

import { brandColor, BrandRole, mark, markStroke } from "../../app/contracts/brand.js"
import { ColorMode, contrast, inSrgbGamut, neutralColor } from "../../app/contracts/palette.js"
import {
  markPointsAttribute,
  markViewBoxAttribute,
  renderFaviconSvg,
  renderThemeColorMetas,
  renderWebManifest,
  WebManifest
} from "../../app/web/brand/brandAssets.js"
import { drawMark, favicon, palette, siteCard, solidIcon } from "../../scripts/social-assets/cards.js"

/** The app's root, from this file rather than the working directory: the root test run starts elsewhere. */
const appRoot: Effect.Effect<string, never, Path.Path> = Effect.gen(function*() {
  const path = yield* Path.Path
  return yield* path.fromFileUrl(yield* Url.fromString("../../", import.meta.url))
}).pipe(Effect.orDie)

const descends = (values: ReadonlyArray<number>): boolean =>
  Arr.every(Arr.zip(values, Arr.drop(values, 1)), ([above, below]) => Order.greaterThan(Num.Order)(above, below))

/** A face's mean depth stands in for its light here: the face turned to the light is the nearest. */
const opacities = Arr.map(mark.faces, (face) => face.fillOpacity)

describe("brand contract", () => {
  it.effect("the mark is one voxel seen from the isometric angle: three faces, the lit one nearest, in a tight frame", () =>
    Effect.sync(() => {
      expect(Arr.length(mark.faces)).toBe(3)
      // Every face is a quadrilateral whose corners lie inside the frame.
      Arr.forEach(mark.faces, (face) => {
        expect(Arr.length(face.points)).toBe(4)
        Arr.forEach(face.points, ([x, y]) => {
          expect(Num.between(x, { minimum: mark.viewBox.x, maximum: Num.sum(mark.viewBox.x, mark.viewBox.width) }))
            .toBe(true)
          expect(Num.between(y, { minimum: mark.viewBox.y, maximum: Num.sum(mark.viewBox.y, mark.viewBox.height) }))
            .toBe(true)
        })
      })
      // A unit cube seen isometrically is a hexagon 1.6927 wide and 1.3938 tall, as the mark was first measured; the frame pads each side by 0.06.
      expect(mark.viewBox.width).toBeCloseTo(Num.sum(1.6927, 0.12), 4)
      expect(mark.viewBox.height).toBeCloseTo(Num.sum(1.3938, 0.12), 4)
      // The frame is centred on the origin.
      expect(mark.viewBox.x).toBeCloseTo(Num.negate(Numeric.unsafeDivide(mark.viewBox.width, 2)), 4)
      expect(mark.viewBox.y).toBeCloseTo(Num.negate(Numeric.unsafeDivide(mark.viewBox.height, 2)), 4)
      // Faces are drawn back to front and take less light the further they turn from it: the first is the brightest.
      expect(descends(opacities)).toBe(true)
      expect(Option.getOrElse(Arr.head(opacities), () => 0)).toBeCloseTo(0.8758, 3)
      expect(Option.getOrElse(Arr.last(opacities), () => 0)).toBeCloseTo(0.829, 3)
      // Every face takes at least the floor of light, never darker.
      Arr.forEach(opacities, (opacity) => expect(Num.between(opacity, { minimum: 0.675, maximum: 0.9 })).toBe(true))
    }))

  it.effect("the brand colours are the palette's canvas and ink, in gamut, with ink readable on canvas in both modes", () =>
    Effect.sync(() => {
      Arr.forEach(ColorMode.literals, (mode) => {
        Arr.forEach(BrandRole.literals, (role) => {
          expect(brandColor(role, mode)).toStrictEqual(neutralColor(role, mode))
          expect(inSrgbGamut(brandColor(role, mode))).toBe(true)
        })
        expect(contrast(brandColor("ink", mode), brandColor("canvas", mode))).toBeGreaterThanOrEqual(7)
      })
    }))

  it.effect("the SVG attributes carry the mark to four decimals and nothing else", () =>
    Effect.sync(() => {
      expect(markViewBoxAttribute(mark.viewBox)).toBe("-0.9064 -0.7569 1.8127 1.5138")
      expect(Arr.map(mark.faces, markPointsAttribute)).toEqual([
        "-0.4381,0.6969 0.269,0.6969 0.8464,0.1196 0.1392,0.1196",
        "-0.269,-0.6969 0.1392,0.1196 0.8464,0.1196 0.4381,-0.6969",
        "-0.4381,0.6969 -0.8464,-0.1196 -0.269,-0.6969 0.1392,0.1196"
      ])
    }))

  it.effect("the favicon is the mark in ink, following the reader's colour scheme, with no colour of its own", () =>
    Effect.sync(() => {
      const svg = renderFaviconSvg()
      expect(svg).toContain(`viewBox="${markViewBoxAttribute(mark.viewBox)}"`)
      expect(Arr.length(Arr.filter(Str.split(svg, "\n"), Str.startsWith("  <polygon ")))).toBe(3)
      expect(svg).toContain("polygon { fill: rgb(22 35 57); stroke: rgb(22 35 57) }")
      expect(svg).toContain("@media (prefers-color-scheme: dark)")
      expect(svg).toContain("polygon { fill: rgb(237 241 247); stroke: rgb(237 241 247) }")
      expect(svg).toContain(`stroke-opacity="${String(markStroke.opacity)}" stroke-width="${String(markStroke.width)}"`)
      expect(svg).not.toMatch(/#[0-9a-f]{3,8}\b/iu)
    }))

  it.effect("theme-color tracks the canvas of each scheme, dark then light as the head lists them", () =>
    Effect.sync(() => {
      expect(renderThemeColorMetas()).toEqual([
        "<meta name=\"theme-color\" content=\"rgb(13 26 48)\" media=\"(prefers-color-scheme: dark)\" />",
        "<meta name=\"theme-color\" content=\"rgb(245 247 251)\" media=\"(prefers-color-scheme: light)\" />"
      ])
    }))

  it.effect("the manifest paints its splash and chrome in the dark canvas its icons stand on", () =>
    Effect.gen(function*() {
      const manifest = yield* Schema.decode(WebManifest)(yield* renderWebManifest())
      expect(manifest.background_color).toBe("rgb(13 26 48)")
      expect(manifest.theme_color).toBe(manifest.background_color)
      expect(manifest.name).toBe("Theoria")
      expect(Arr.map(manifest.icons, (icon) => icon.src)).toEqual(["/icon-192.png", "/icon-512.png"])
    }))

  it.effect("the share cards and icons paint the same canvas and inks, and the .ico the light ink", () =>
    Effect.sync(() => {
      expect(palette.canvas).toBe("rgb(13,26,48)")
      expect(palette.ink).toBe("rgb(255,255,255)")
      expect(palette.lightInk).toBe("rgb(22,35,57)")
      // A card's ground is the canvas; an icon's mark is the strong ink; the .ico's mark is the light ink.
      expect(Arr.take(siteCard(mark, { sans: "a", sansSemiBold: "b", mono: "c" }, "tag", "host", "out.png"), 3))
        .toEqual(["-size", "1200x630", "xc:rgb(13,26,48)"])
      expect(solidIcon(mark, 192, 0.6, "icon.png")).toContain("xc:rgb(13,26,48)")
      expect(favicon(mark, [16], "favicon.ico")).toContain(palette.lightInk)
      // The mark drawn at 100px from (0, 0) spans its frame's aspect: the far right corner lands at width/height · 100.
      const drawn = drawMark(mark, palette.ink, 0, 0, 100)
      expect(drawn).toContain("-strokewidth")
      // Its corners, worked from the projection by hand: (−0.4381, 0.6969) lands at (30.93, 96.04) and the far right
      // corner (0.8464, 0.1196) at (115.78, 57.90).
      expect(Arr.join(drawn, " ")).toContain("polygon 30.93,96.04 77.64,96.04 115.78,57.9 ")
      expect(Arr.join(drawn, " ")).toContain(`stroke-opacity ${String(markStroke.opacity)} fill-opacity 0.88 polygon`)
    }))

  it.effect("the committed artefacts equal their renderings", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const root = yield* appRoot
      const svg = yield* fileSystem.readFileString(path.join(root, "public", "favicon.svg"))
      const manifest = yield* fileSystem.readFileString(path.join(root, "public", "manifest.webmanifest"))
      const html = yield* fileSystem.readFileString(path.join(root, "index.html"))

      expect(svg).toBe(renderFaviconSvg())
      expect(manifest).toBe(yield* renderWebManifest())
      Arr.forEach(renderThemeColorMetas(), (meta) => expect(html).toContain(meta))
      // The head carries exactly the rendered metas: none with a colour of its own.
      expect(Arr.length(Arr.filter(Str.split(html, "\n"), Str.includes("<meta name=\"theme-color\"")))).toBe(2)
      expect(Str.includes("#")(manifest)).toBe(false)
    }).pipe(Effect.provide(BunContext.layer)))
})
