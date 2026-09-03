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

const png8 = (output: string): ReadonlyArray<string> => ["-depth", "8", `PNG24:${output}`]

const margin = 80
const contentWidth = shareCardSize.width - margin * 2

/** The site card: mark, wordmark, tagline, hostname. */
export const siteCard = (mark: Mark, fonts: Fonts, tagline: string, host: string, output: string): ReadonlyArray<string> => [
  ...canvas(shareCardSize.width, shareCardSize.height, palette.stage),
  ...drawMark(mark, palette.ink, 100, 66, 180),
  ...annotate(fonts.sansSemiBold, 120, palette.ink, 350, 205, "Theoria"),
  ...paragraph(fonts.sans, 38, palette.inkMuted, margin, 330, contentWidth, 160, tagline),
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
  ...drawMark(mark, palette.ink, margin, margin, 56),
  ...annotate(fonts.sansSemiBold, 40, palette.ink, 156, 122, "Theoria"),
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
