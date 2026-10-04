import { BunRuntime, BunServices } from "@effect/platform-bun"
import { Boolean as Bool, Console, Effect, Equal, FileSystem, Option, Path, Schema } from "effect"
import * as Arr from "effect/Array"
import { Url } from "effect/http"
import { ChildProcess, ChildProcessSpawner } from "effect/process"
import * as Str from "effect/String"

import { mark } from "../app/contracts/brand.js"
import { siteMetadata } from "../app/contracts/metadata.js"
import { favicon, Fonts, packageCard, siteCard, solidIcon } from "./social-assets/cards.js"

/**
 * Renders the committed share images and icons under `public/` from the mark
 * in the brand contract (`app/contracts/brand.ts`), which `gen:brand-assets`
 * also writes as `public/favicon.svg`:
 *
 *   social/theoria.png     1200×630 site card (Open Graph / Twitter)
 *   social/<slug>.png      1200×630 card per published package
 *   apple-touch-icon.png   180×180
 *   icon-192.png, icon-512.png  web-manifest icons
 *   favicon.ico            16/32/48
 *
 * Requires ImageMagick 7 (`magick`). Fonts ship with the script under
 * `social-assets/fonts` (SIL Open Font License). Geist Mono Medium comes
 * from the vercel/geist-font v1.7.2 release archive. Run from `apps/theoria`:
 *
 *   bun run gen:social-assets
 */

const PackageManifest = Schema.fromJsonString(Schema.Struct({
  name: Schema.String,
  description: Schema.String,
  private: Schema.OptionFromOptionalKey(Schema.Boolean)
}))

const magick = (args: ReadonlyArray<string>, cwd: string) =>
  Effect.gen(function*() {
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
    const exitCode = yield* spawner.exitCode(ChildProcess.make("magick", args, { cwd, stderr: "inherit" }))
    return yield* Bool.match(Equal.equals(exitCode, 0), {
      onTrue: () => Effect.void,
      onFalse: () => Effect.die(`magick exited with ${String(exitCode)} for ${Arr.join(Arr.takeRight(args, 1), "")}`)
    })
  })

const program = Effect.gen(function*() {
  const fileSystem = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const appRoot = yield* Effect.flatMap(Effect.fromResult(Url.fromString("../", import.meta.url)), path.fromFileUrl)
  const repositoryRoot = path.join(appRoot, "..", "..")
  const publicRoot = path.join(appRoot, "public")
  const fontsRoot = path.join(appRoot, "scripts", "social-assets", "fonts")
  const fonts: Fonts = Fonts.make({
    sans: path.join(fontsRoot, "Figtree-Regular.ttf"),
    sansSemiBold: path.join(fontsRoot, "Figtree-SemiBold.ttf"),
    mono: path.join(fontsRoot, "GeistMono-Medium.ttf")
  })
  const host = yield* Effect.map(Effect.fromResult(Url.fromString(siteMetadata.siteUrl)), (url) => url.host)

  const packageDirectories = yield* fileSystem.readDirectory(path.join(repositoryRoot, "packages"))
  const packages = yield* Effect.forEach(Arr.sort(packageDirectories, Str.Order), (slug) => {
    const manifestPath = path.join(repositoryRoot, "packages", slug, "package.json")
    return fileSystem.readFileString(manifestPath).pipe(
      Effect.flatMap(Schema.decodeUnknownEffect(PackageManifest)),
      Effect.map((manifest) =>
        Bool.match(Option.getOrElse(manifest.private, () => false), {
          onTrue: Option.none,
          onFalse: () => Option.some({ slug, name: manifest.name, description: manifest.description })
        })
      ),
      // Entries under packages/ that are not package directories (`.gitkeep`).
      Effect.catchTag("PlatformError", () => Effect.succeedNone)
    )
  }).pipe(Effect.map(Arr.getSomes))

  yield* fileSystem.makeDirectory(path.join(publicRoot, "social"), { recursive: true })

  const jobs: ReadonlyArray<ReadonlyArray<string>> = [
    siteCard(mark, fonts, `${siteMetadata.tagline}, built with Effect.`, host, "social/theoria.png"),
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

  yield* Console.log(`Rendered ${String(Arr.length(jobs))} images into ${publicRoot}`)
})

BunRuntime.runMain(program.pipe(Effect.provide(BunServices.layer)))
