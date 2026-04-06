import { loadPackageDocsCorpus, type PackageDocsCorpus } from "@theoria/source-proof"
import { Context, Effect, Layer } from "effect"

export class PackageDocsInfo extends Context.Tag("@theoria/app/server/config/PackageDocsInfo")<
  PackageDocsInfo,
  {
    readonly corpus: PackageDocsCorpus
  }
>() {}

const makePackageDocsInfo = Effect.gen(function*() {
  const corpus = yield* loadPackageDocsCorpus()

  yield* Effect.log("Loaded package docs corpus").pipe(
    Effect.annotateLogs("packageCount", corpus.catalog.length)
  )

  return PackageDocsInfo.of({ corpus })
})

export const PackageDocsLive = Layer.effect(PackageDocsInfo, makePackageDocsInfo)
