import { FileSystem, Path } from "@effect/platform"
import { Context, Effect, Layer, Schema } from "effect"
import * as Arr from "effect/Array"
import * as EffectRecord from "effect/Record"
import * as Tuple from "effect/Tuple"

export class PackageVersionsInfo extends Context.Tag("@theoria/app/server/config/PackageVersionsInfo")<
  PackageVersionsInfo,
  {
    readonly versions: Record<string, string>
  }
>() {}

const packagesDirUrl = new URL("../../../../../packages/", import.meta.url)

const PackageJson = Schema.Struct({
  name: Schema.String,
  version: Schema.String
})

const readPackageVersion = (fs: FileSystem.FileSystem, packagesDir: string, dir: string) =>
  Effect.gen(function*() {
    const content = yield* fs.readFileString(`${packagesDir}/${dir}/package.json`)
    const parsed = yield* Schema.decode(Schema.parseJson(PackageJson))(content)
    return Tuple.make(parsed.name, parsed.version)
  }).pipe(Effect.option)

export const PackageVersionsLive = Layer.effect(
  PackageVersionsInfo,
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const packagesDir = yield* path.fromFileUrl(packagesDirUrl).pipe(Effect.orDie)
    const entries = yield* fs.readDirectory(packagesDir)
    const pairs = yield* Effect.forEach(entries, (entry) => readPackageVersion(fs, packagesDir, entry), {
      concurrency: "unbounded"
    })
    const versions = EffectRecord.fromEntries(Arr.getSomes(pairs))

    yield* Effect.log("Resolved package versions").pipe(
      Effect.annotateLogs("packageCount", EffectRecord.keys(versions).length)
    )

    return PackageVersionsInfo.of({ versions })
  })
)
