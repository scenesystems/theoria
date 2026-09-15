import { Effect, Number as Num, type ParseResult, Schema } from "effect"
import * as Arr from "effect/Array"

import { brandColor, mark, type MarkFace, type MarkPoint, markStroke, type MarkViewBox } from "../../contracts/brand.js"
import { siteMetadata } from "../../contracts/metadata.js"
import { ColorMode } from "../../contracts/palette.js"
import { colorCss } from "../palette/paletteTokens.js"

/**
 * The brand artefacts derived from the brand contract, as the palette
 * stylesheet is derived from the palette: `favicon.svg`, the `theme-color`
 * metas in `index.html`, and `manifest.webmanifest`. Written by
 * `gen:brand-assets`; a contract test holds each file to its rendering here.
 * The raster icons and share cards follow from the same mark through
 * `gen:social-assets`.
 *
 * `theme-color` tracks the canvas in each mode, so the browser's chrome is
 * the page's own ground rather than a separate brand colour.
 */

/** A coordinate as the artefacts carry it: four decimals, no trailing noise. */
const decimal = (value: number): string => String(Num.round(value, 4))

/** A face's outline as an SVG `points` attribute. */
export const markPointsAttribute = (face: MarkFace): string =>
  Arr.join(Arr.map(face.points, ([x, y]: MarkPoint) => `${decimal(x)},${decimal(y)}`), " ")

/** The mark's frame as an SVG `viewBox` attribute. */
export const markViewBoxAttribute = (viewBox: MarkViewBox): string =>
  Arr.join(Arr.map([viewBox.x, viewBox.y, viewBox.width, viewBox.height], decimal), " ")

const polygonRule = (mode: ColorMode): string => {
  const ink = colorCss(brandColor("ink", mode))
  return `polygon { fill: ${ink}; stroke: ${ink} }`
}

const faviconPolygon = (face: MarkFace): string =>
  `  <polygon fill-opacity="${decimal(face.fillOpacity)}" points="${
    markPointsAttribute(face)
  }" stroke-linejoin="round" stroke-opacity="${decimal(markStroke.opacity)}" stroke-width="${
    decimal(markStroke.width)
  }"/>`

/** The mark in ink on nothing, following the reader's colour scheme. */
export const renderFaviconSvg = (): string =>
  Arr.join(
    Arr.flatten([
      [
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${markViewBoxAttribute(mark.viewBox)}" fill="none">`,
        "  <style>",
        `    ${polygonRule("light")}`,
        "    @media (prefers-color-scheme: dark) {",
        `      ${polygonRule("dark")}`,
        "    }",
        "  </style>"
      ],
      Arr.map(mark.faces, faviconPolygon),
      ["</svg>", ""]
    ]),
    "\n"
  )

/** One `theme-color` meta per mode, each the canvas of that mode. */
export const themeColorMeta = (mode: ColorMode): string =>
  `<meta name="theme-color" content="${
    colorCss(brandColor("canvas", mode))
  }" media="(prefers-color-scheme: ${mode})" />`

/** The `theme-color` metas as `index.html` carries them, dark first as the file always has. */
export const renderThemeColorMetas = (): ReadonlyArray<string> =>
  Arr.map(Arr.reverse(ColorMode.literals), themeColorMeta)

export const WebManifest = Schema.parseJson(
  Schema.Struct({
    name: Schema.String,
    short_name: Schema.String,
    description: Schema.String,
    start_url: Schema.String,
    display: Schema.String,
    background_color: Schema.String,
    theme_color: Schema.String,
    icons: Schema.Array(Schema.Struct({
      src: Schema.String,
      sizes: Schema.String,
      type: Schema.String,
      purpose: Schema.String
    }))
  }),
  { space: 2 }
)

/**
 * The installed app's manifest. Its icons are the mark on the dark canvas, so
 * the splash behind them and the chrome around them are that canvas too.
 */
export const renderWebManifest = (): Effect.Effect<string, ParseResult.ParseError> => {
  const canvas = colorCss(brandColor("canvas", "dark"))
  return Schema.encode(WebManifest)({
    name: siteMetadata.siteName,
    short_name: siteMetadata.siteName,
    description: siteMetadata.defaultDescription,
    start_url: "/",
    display: "browser",
    background_color: canvas,
    theme_color: canvas,
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }
    ]
  }).pipe(Effect.map((json) => `${json}\n`))
}
