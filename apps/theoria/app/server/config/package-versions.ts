import { Context, Effect, Layer, Schema } from "effect"
import * as EffectRecord from "effect/Record"

import { PackageVersionsJson, runtimeDataPathnames } from "./runtime-data.js"
import { StaticStore } from "./static-store.js"

export class PackageVersionsInfo extends Context.Tag("@theoria/app/server/config/PackageVersionsInfo")<
  PackageVersionsInfo,
  {
    readonly versions: Record<string, string>
  }
>() {}

const makePackageVersions = Effect.gen(function*() {
  const store = yield* StaticStore
  const versions = yield* store.text(runtimeDataPathnames.packageVersions).pipe(
    Effect.flatMap(Schema.decode(PackageVersionsJson))
  )

  yield* Effect.log("Resolved package versions").pipe(
    Effect.annotateLogs("packageCount", EffectRecord.keys(versions).length)
  )

  return PackageVersionsInfo.of({ versions })
})

export const PackageVersionsLive = Layer.effect(PackageVersionsInfo, makePackageVersions)
