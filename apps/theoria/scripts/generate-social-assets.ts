import { Command, FileSystem, Path } from "@effect/platform"
import { BunContext, BunRuntime } from "@effect/platform-bun"
import { Console, Effect, Option, Schema } from "effect"
import * as Arr from "effect/Array"
import * as Str from "effect/String"

import { siteMetadata } from "../app/contracts/metadata.js"
import { type Face, favicon, type Fonts, type Mark, packageCard, palette, siteCard, solidIcon } from "./social-assets/cards.js"

/**
 * Renders the committed share images and icons under `public/` from the
 * canonical mark in `public/favicon.svg`:
 *
 *   social/theoria.png     1200×630 site card (Open Graph / Twitter)
 *   social/<slug>.png      1200×630 card per published package
 *   apple-touch-icon.png   180×180
 *   icon-192.png, icon-512.png  web-manifest icons
 *   favicon.ico            16/32/48
 *
 * Requires ImageMagick 7 (`magick`). Fonts ship with the script under
 * `social-assets/fonts` (SIL Open Font License). Run from `apps/theoria`:
 *
 *   bun run gen:social-assets
 */

const PackageManifest = Schema.parseJson(Schema.Struct({
  name: Schema.String,
  description: Schema.String,
  private: Schema.optional(Schema.Boolean)
}))

const polygonPattern = /<polygon fill-opacity="([0-9.]+)" points="([^"]+)"/gu
const viewBoxPattern = /viewBox="([^"]+)"/u

const numbers = (text: string): ReadonlyArray<number> => Arr.map(text.trim().split(/[\s,]+/u), Number)

const parseFace = (match: RegExpMatchArray): Face => {
  const coordinates = numbers(match[2] ?? "")
  return {
    fillOpacity: Number(match[1]),
    points: Arr.map(Arr.chunksOf(coordinates, 2), ([x = 0, y = 0]) => [x, y])
  }
}

const parseMark = (svg: string): Effect.Effect<Mark> =>
  Option.match(Option.fromNullable(svg.match(viewBoxPattern)?.[1]), {
    onNone: () => Effect.dieMessage("favicon.svg has no viewBox"),
    onSome: (viewBox) => {
      const [x = 0, y = 0, width = 1, height = 1] = numbers(viewBox)
      return Effect.succeed({
        viewBox: { x, y, width, height },
        faces: Arr.map(Array.from(svg.matchAll(polygonPattern)), parseFace)
      })
    }
  })

const magick = (args: ReadonlyArray<string>, cwd: string) =>
  Effect.gen(function*() {
    const exitCode = yield* Command.make("magick", ...args).pipe(
      Command.workingDirectory(cwd),
      Command.stderr("inherit"),
      Command.exitCode
    )
    return yield* Number(exitCode) === 0
      ? Effect.void
      : Effect.dieMessage(`magick exited with ${String(exitCode)} for ${Arr.join(Arr.takeRight(args, 1), "")}`)
  })

const WebManifest = Schema.parseJson(
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

const webManifest = (description: string) =>
  Schema.encode(WebManifest)({
    name: siteMetadata.siteName,
    short_name: siteMetadata.siteName,
    description,
    start_url: "/",
    display: "browser",
    background_color: palette.stage,
    theme_color: palette.stage,
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }
    ]
  }).pipe(Effect.map((json) => `${json}\n`))

const program = Effect.gen(function*() {
  const fileSystem = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const appRoot = yield* path.fromFileUrl(new URL("../", import.meta.url))
  const repositoryRoot = path.join(appRoot, "..", "..")
  const publicRoot = path.join(appRoot, "public")
  const fontsRoot = path.join(appRoot, "scripts", "social-assets", "fonts")
  const fonts: Fonts = {
    sans: path.join(fontsRoot, "Figtree-Regular.ttf"),
    sansSemiBold: path.join(fontsRoot, "Figtree-SemiBold.ttf"),
    mono: path.join(fontsRoot, "JetBrainsMono-Medium.ttf")
  }
  const host = new URL(siteMetadata.siteUrl).host

  const mark = yield* fileSystem.readFileString(path.join(publicRoot, "favicon.svg")).pipe(Effect.flatMap(parseMark))

  const packageDirectories = yield* fileSystem.readDirectory(path.join(repositoryRoot, "packages"))
  const packages = yield* Effect.forEach(Arr.sort(packageDirectories, Str.Order), (slug) => {
    const manifestPath = path.join(repositoryRoot, "packages", slug, "package.json")
    return fileSystem.readFileString(manifestPath).pipe(
      Effect.flatMap(Schema.decode(PackageManifest)),
      Effect.map((manifest) => manifest.private === true ? Option.none() : Option.some({ slug, ...manifest })),
      // Entries under packages/ that are not package directories (`.gitkeep`).
      Effect.catchTag("SystemError", () => Effect.succeedNone)
    )
  }).pipe(Effect.map(Arr.getSomes))

  yield* fileSystem.makeDirectory(path.join(publicRoot, "social"), { recursive: true })

  const jobs: ReadonlyArray<ReadonlyArray<string>> = [
    siteCard(mark, fonts, siteMetadata.defaultDescription, host, "social/theoria.png"),
    ...Arr.map(packages, (published) =>
      packageCard(
        mark,
        fonts,
        published.name,
        published.description,
        `${host}/docs/${published.slug}`,
        `social/${published.slug}.png`
      )),
    solidIcon(mark, 180, 0.6, "apple-touch-icon.png"),
    solidIcon(mark, 192, 0.6, "icon-192.png"),
    solidIcon(mark, 512, 0.6, "icon-512.png"),
    favicon(mark, [16, 32, 48], "favicon.ico")
  ]

  yield* Effect.forEach(jobs, (args) => magick(args, publicRoot), { concurrency: 4 })
  yield* fileSystem.writeFileString(
    path.join(publicRoot, "manifest.webmanifest"),
    yield* webManifest(siteMetadata.defaultDescription)
  )

  yield* Console.log(`Rendered ${String(jobs.length)} images and manifest.webmanifest into ${publicRoot}`)
})

BunRuntime.runMain(program.pipe(Effect.provide(BunContext.layer)))
