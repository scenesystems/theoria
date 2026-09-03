import * as Arr from "effect/Array"

/**
 * Card layouts for the generated share images, expressed as ImageMagick
 * arguments. Everything here is pure: `generate-social-assets.ts` supplies the
 * cube geometry (parsed from `public/favicon.svg`) and runs `magick`.
 *
 * Colors are the site's design tokens (`app/web/styles.css`): `stage-0` and
 * `ink-*` in dark mode for the cards, light mode for the structured-data logo.
 */

export type Face = {
  readonly points: ReadonlyArray<readonly [number, number]>
  readonly fillOpacity: number
}

export type Mark = {
  readonly viewBox: { readonly x: number, readonly y: number, readonly width: number, readonly height: number }
  readonly faces: ReadonlyArray<Face>
}

export type Fonts = {
  readonly sans: string
  readonly sansSemiBold: string
  readonly mono: string
}

export const palette = {
  stage: "#0b1326",
  ink: "#ffffff",
  inkMuted: "#a8b7cc",
  inkFaint: "#8494aa",
  lightInk: "#0b1326"
}

export const shareCardSize = { width: 1200, height: 630 }

const format = (value: number): string => value.toFixed(2)

/** Draws the mark so that its bounding box has `height` pixels with its top-left corner at (`x`, `y`). */
export const drawMark = (mark: Mark, color: string, x: number, y: number, height: number): ReadonlyArray<string> => {
  const scale = height / mark.viewBox.height
  const project = ([px, py]: readonly [number, number]): string =>
    `${format((px - mark.viewBox.x) * scale + x)},${format((py - mark.viewBox.y) * scale + y)}`

  return [
    "-fill",
    color,
    "-stroke",
    color,
    "-strokewidth",
    format(0.02 * scale),
    ...Arr.flatMap(mark.faces, (face) => [
      "-draw",
      `stroke-opacity 0.3 fill-opacity ${format(face.fillOpacity)} polygon ${Arr.join(Arr.map(face.points, project), " ")}`
    ]),
    "-stroke",
    "none"
  ]
}

/** Single-line text with its baseline at (`x`, `y`). */
const annotate = (font: string, size: number, color: string, x: number, y: number, text: string): ReadonlyArray<string> => [
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
const contentWidth = shareCardSize.width - margin * 2

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
  const markHeight = fontSize * lockup.markHeight
  const markWidth = markHeight * (mark.viewBox.width / mark.viewBox.height)
  const markTop = baseline - fontSize * lockup.center - markHeight / 2
  return [
    ...drawMark(mark, palette.ink, x, markTop, markHeight),
    ...annotate(fonts.sansSemiBold, fontSize, palette.ink, x + markWidth + fontSize * lockup.gap, baseline, "Theoria")
  ]
}

/** The site card: logo lockup, a one-line tagline, hostname. */
export const siteCard = (mark: Mark, fonts: Fonts, tagline: string, host: string, output: string): ReadonlyArray<string> => [
  ...canvas(shareCardSize.width, shareCardSize.height, palette.stage),
  ...logoLockup(mark, fonts, margin, 296, 128),
  ...annotate(fonts.sans, 44, palette.inkMuted, margin, 384, tagline),
  ...annotate(fonts.mono, 26, palette.inkFaint, margin, 560, host),
  ...png8(output)
]

/** A package card: small logo lockup, package name in monospace, description, docs URL. */
export const packageCard = (
  mark: Mark,
  fonts: Fonts,
  packageName: string,
  description: string,
  docsUrl: string,
  output: string
): ReadonlyArray<string> => [
  ...canvas(shareCardSize.width, shareCardSize.height, palette.stage),
  ...logoLockup(mark, fonts, margin, 122, 40),
  ...annotate(fonts.mono, 54, palette.ink, margin, 300, packageName),
  ...paragraph(fonts.sans, 36, palette.inkMuted, margin, 340, contentWidth, 150, description),
  ...annotate(fonts.mono, 26, palette.inkFaint, margin, 560, docsUrl),
  ...png8(output)
]

/** A square icon: the mark centered on a solid canvas at `coverage` of the side. */
export const solidIcon = (mark: Mark, size: number, coverage: number, output: string): ReadonlyArray<string> => {
  const height = size * coverage
  const width = height * (mark.viewBox.width / mark.viewBox.height)
  return [
    ...canvas(size, size, palette.stage),
    ...drawMark(mark, palette.ink, (size - width) / 2, (size - height) / 2, height),
    ...png8(output)
  ]
}

/** A multi-resolution ICO: dark mark on a transparent square, one frame per size. */
export const favicon = (mark: Mark, sizes: ReadonlyArray<number>, output: string): ReadonlyArray<string> => [
  ...Arr.flatMap(sizes, (size) => {
    const height = size * 0.9
    const width = height * (mark.viewBox.width / mark.viewBox.height)
    return [
      "(",
      ...canvas(size, size, "none"),
      ...drawMark(mark, palette.lightInk, (size - width) / 2, (size - height) / 2, height),
      ")"
    ]
  }),
  output
]
