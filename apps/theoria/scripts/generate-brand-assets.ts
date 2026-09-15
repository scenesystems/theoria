import { FileSystem, Path, Url } from "@effect/platform"
import { BunContext, BunRuntime } from "@effect/platform-bun"
import { Console, Effect } from "effect"
import * as Arr from "effect/Array"
import * as Str from "effect/String"

import { renderFaviconSvg, renderThemeColorMetas, renderWebManifest } from "../app/web/brand/brandAssets.js"

/**
 * Writes the brand artefacts the brand contract renders: `public/favicon.svg`,
 * `public/manifest.webmanifest`, and the `theme-color` metas in `index.html`.
 * The raster icons and share cards are then rendered from the same mark by
 * `gen:social-assets`. Run from `apps/theoria`:
 *
 *   bun run gen:brand-assets
 */

/** The consecutive `theme-color` metas in the document head, whatever their content, with their indentation. */
const themeColorBlock = /^([ \t]*)<meta name="theme-color"[^\n]*(?:\n[ \t]*<meta name="theme-color"[^\n]*)*/mu

/** The block replaced by the rendered metas, each on its own line at the block's indentation (`$1`). */
const withThemeColorMetas = (html: string): string =>
  Str.replace(themeColorBlock, Arr.join(Arr.map(renderThemeColorMetas(), (meta) => `$1${meta}`), "\n"))(html)

const program = Effect.gen(function*() {
  const fileSystem = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const appRoot = yield* Effect.flatMap(Url.fromString("../", import.meta.url), path.fromFileUrl)
  const publicRoot = path.join(appRoot, "public")
  const indexPath = path.join(appRoot, "index.html")

  yield* fileSystem.writeFileString(path.join(publicRoot, "favicon.svg"), renderFaviconSvg())
  yield* fileSystem.writeFileString(path.join(publicRoot, "manifest.webmanifest"), yield* renderWebManifest())
  yield* fileSystem.writeFileString(indexPath, withThemeColorMetas(yield* fileSystem.readFileString(indexPath)))

  yield* Console.log(`Rendered favicon.svg, manifest.webmanifest and the theme-color metas under ${appRoot}`)
})

BunRuntime.runMain(program.pipe(Effect.provide(BunContext.layer)))
