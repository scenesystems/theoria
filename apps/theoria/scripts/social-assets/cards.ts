import * as Numeric from "@scenesystems/effect-math/Numeric"
import { Number as Num, Schema } from "effect"
import * as Arr from "effect/Array"

import { brandColor, type Mark, type MarkPoint, markStroke } from "../../app/contracts/brand.js"
import { neutralColor, type Oklch, toSrgb } from "../../app/contracts/palette.js"

/**
 * Card layouts for the generated share images, expressed as ImageMagick
 * arguments. Everything here is pure: `generate-social-assets.ts` runs
 * `magick` over them.
 *
 * The mark is the brand contract's; the colours are the palette's neutral
 * roles in dark mode for the cards and icons, and the light-mode ink for the
 * `.ico`, which sits on the reader's own tab.
 */

export const Fonts = Schema.Struct({
  sans: Schema.String,
  sansSemiBold: Schema.String,
  mono: Schema.String
})
export type Fonts = typeof Fonts.Type

/** A colour as ImageMagick reads it. */
const magickColor = (color: Oklch): string => {
  const painted = toSrgb(color)
  return `rgb(${String(painted.r)},${String(painted.g)},${String(painted.b)})`
}

export const palette = {
  canvas: magickColor(brandColor("canvas", "dark")),
  ink: magickColor(neutralColor("ink-strong", "dark")),
  inkMuted: magickColor(neutralColor("ink-secondary", "dark")),
  inkFaint: magickColor(neutralColor("ink-tertiary", "dark")),
  lightInk: magickColor(brandColor("ink", "light"))
}

export const shareCardSize = { width: 1200, height: 630 }

const format = (value: number): string => String(Num.round(value, 2))

/** The mark's width for a given height: its frame's aspect. */
const markWidth = (mark: Mark, height: number): number =>
  Num.multiply(height, Numeric.unsafeDivide(mark.viewBox.width, mark.viewBox.height))

/** Draws the mark so that its bounding box has `height` pixels with its top-left corner at (`x`, `y`). */
export const drawMark = (mark: Mark, color: string, x: number, y: number, height: number): ReadonlyArray<string> => {
  const scale = Numeric.unsafeDivide(height, mark.viewBox.height)
  const project = ([px, py]: MarkPoint): string =>
    `${format(Num.sum(Num.multiply(Num.subtract(px, mark.viewBox.x), scale), x))},${
      format(Num.sum(Num.multiply(Num.subtract(py, mark.viewBox.y), scale), y))
    }`

  return Arr.flatten([
    ["-fill", color, "-stroke", color, "-strokewidth", format(Num.multiply(markStroke.width, scale))],
    Arr.flatMap(mark.faces, (face) => [
      "-draw",
      `stroke-opacity ${format(markStroke.opacity)} fill-opacity ${format(face.fillOpacity)} polygon ${
        Arr.join(Arr.map(face.points, project), " ")
      }`
    ]),
    ["-stroke", "none"]
  ])
}

/** Single-line text with its baseline at (`x`, `y`). */
const annotate = (
  font: string,
  size: number,
  color: string,
  x: number,
  y: number,
  text: string
): ReadonlyArray<string> => [
  "-font",
  font,
  "-pointsize",
  String(size),
  "-fill",
  color,
  "-annotate",
  `+${String(x)}+${String(y)}`,
  text
]

/** Word-wrapped paragraph inside a `width` × `height` box whose top-left corner is (`x`, `y`). */
const paragraph = (
  font: string,
  size: number,
  color: string,
  x: number,
  y: number,
  width: number,
  height: number,
  text: string
): ReadonlyArray<string> => [
  "(",
  "-size",
  `${String(width)}x${String(height)}`,
  "-background",
  "none",
  "-fill",
  color,
  "-font",
  font,
  "-pointsize",
  String(size),
  "-gravity",
  "NorthWest",
  `caption:${text}`,
  ")",
  "-gravity",
  "NorthWest",
  "-geometry",
  `+${String(x)}+${String(y)}`,
  "-composite"
]

const canvas = (width: number, height: number, color: string): ReadonlyArray<string> => [
  "-size",
  `${String(width)}x${String(height)}`,
  `xc:${color}`
]

/** 8-bit PNG without timestamp chunks, so re-running the generator is byte-for-byte reproducible. */
const png8 = (output: string): ReadonlyArray<string> => [
  "-depth",
  "8",
  "-define",
  "png:exclude-chunks=date,time",
  `PNG24:${output}`
]

const margin = 80
const contentWidth = Num.subtract(shareCardSize.width, Num.multiply(margin, 2))

/**
 * The same proportions as `TheoriaLogo`: a mark `0.85em` tall, a `0.25em` gap,
 * and the mark centered on the wordmark's line box. Figtree's ascender (950)
 * and descender (-250) put that center 0.35em above the baseline, which is also
 * the midpoint of its 700-unit cap height.
 */
const lockup = {
  markHeight: 0.85,
  gap: 0.25,
  center: 0.35
}

/** The mark-and-wordmark lockup at `fontSize`, with the wordmark baseline at (`x`, `baseline`). */
const logoLockup = (mark: Mark, fonts: Fonts, x: number, baseline: number, fontSize: number): ReadonlyArray<string> => {
  const markHeight = Num.multiply(fontSize, lockup.markHeight)
  const markTop = Num.subtract(
    Num.subtract(baseline, Num.multiply(fontSize, lockup.center)),
    Numeric.unsafeDivide(markHeight, 2)
  )
  return Arr.appendAll(
    drawMark(mark, palette.ink, x, markTop, markHeight),
    annotate(
      fonts.sansSemiBold,
      fontSize,
      palette.ink,
      Num.sum(Num.sum(x, markWidth(mark, markHeight)), Num.multiply(fontSize, lockup.gap)),
      baseline,
      "Theoria"
    )
  )
}

/** The site card: logo lockup, one tagline line, hostname. */
export const siteCard = (
  mark: Mark,
  fonts: Fonts,
  tagline: string,
  host: string,
  output: string
): ReadonlyArray<string> =>
  Arr.flatten([
    canvas(shareCardSize.width, shareCardSize.height, palette.canvas),
    logoLockup(mark, fonts, margin, 296, 128),
    annotate(fonts.sans, 40, palette.inkMuted, margin, 382, tagline),
    annotate(fonts.mono, 26, palette.inkFaint, margin, 560, host),
    png8(output)
  ])

/** A package card: small logo lockup, package name in monospace, description, docs URL. */
export const packageCard = (
  mark: Mark,
  fonts: Fonts,
  packageName: string,
  description: string,
  docsUrl: string,
  output: string
): ReadonlyArray<string> =>
  Arr.flatten([
    canvas(shareCardSize.width, shareCardSize.height, palette.canvas),
    logoLockup(mark, fonts, margin, 122, 40),
    annotate(fonts.mono, 54, palette.ink, margin, 300, packageName),
    paragraph(fonts.sans, 36, palette.inkMuted, margin, 340, contentWidth, 150, description),
    annotate(fonts.mono, 26, palette.inkFaint, margin, 560, docsUrl),
    png8(output)
  ])

/** The mark centred in a `size` square at `coverage` of its side: the offset of its top-left corner. */
const centred = (mark: Mark, size: number, coverage: number): { height: number; x: number; y: number } => {
  const height = Num.multiply(size, coverage)
  return {
    height,
    x: Numeric.unsafeDivide(Num.subtract(size, markWidth(mark, height)), 2),
    y: Numeric.unsafeDivide(Num.subtract(size, height), 2)
  }
}

/** A square icon: the mark centered on a solid canvas at `coverage` of the side. */
export const solidIcon = (mark: Mark, size: number, coverage: number, output: string): ReadonlyArray<string> => {
  const placed = centred(mark, size, coverage)
  return Arr.flatten([
    canvas(size, size, palette.canvas),
    drawMark(mark, palette.ink, placed.x, placed.y, placed.height),
    png8(output)
  ])
}

/** A multi-resolution ICO: dark mark on a transparent square, one frame per size. */
export const favicon = (mark: Mark, sizes: ReadonlyArray<number>, output: string): ReadonlyArray<string> =>
  Arr.append(
    Arr.flatMap(sizes, (size) => {
      const placed = centred(mark, size, 0.9)
      return Arr.flatten([
        ["("],
        canvas(size, size, "none"),
        drawMark(mark, palette.lightInk, placed.x, placed.y, placed.height),
        [")"]
      ])
    }),
    output
  )
