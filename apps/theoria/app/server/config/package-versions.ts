import { FileSystem } from "@effect/platform"
import { Context, Effect, Layer, Schema } from "effect"
import * as Arr from "effect/Array"
import * as EffectRecord from "effect/Record"
import * as Tuple from "effect/Tuple"
import { resolve } from "node:path"

export class PackageVersionsInfo extends Context.Tag("@theoria/app/server/config/PackageVersionsInfo")<
  PackageVersionsInfo,
  {
    readonly versions: Record<string, string>
  }
>() {}

const packagesDir = resolve(new URL("../../../../../packages", import.meta.url).pathname)

const PackageJson = Schema.Struct({
  name: Schema.String,
  version: Schema.String
})

const readPackageVersion = (fs: FileSystem.FileSystem, dir: string) =>
  Effect.gen(function*() {
    const content = yield* fs.readFileString(`${packagesDir}/${dir}/package.json`)
    const parsed = yield* Schema.decode(Schema.parseJson(PackageJson))(content)
    return Tuple.make(parsed.name, parsed.version)
  }).pipe(Effect.option)

const makePackageVersions = Effect.gen(function*() {
  const fs = yield* FileSystem.FileSystem
  const entries = yield* fs.readDirectory(packagesDir)
  const pairs = yield* Effect.forEach(entries, (entry) => readPackageVersion(fs, entry), { concurrency: "unbounded" })
  const versions = EffectRecord.fromEntries(Arr.getSomes(pairs))

  yield* Effect.log("Resolved package versions").pipe(
    Effect.annotateLogs("packageCount", EffectRecord.keys(versions).length)
  )

  return PackageVersionsInfo.of({ versions })
})

export const PackageVersionsLive = Layer.effect(PackageVersionsInfo, makePackageVersions)
