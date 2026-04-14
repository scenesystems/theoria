import {
  buildPackageDocsSearchIndex,
  loadPackageDocsCorpus,
  type PackageDocsCorpus,
  type PackageDocsSearchIndex
} from "@theoria/source-proof"
import { Context, Effect, Layer } from "effect"

export class PackageDocsInfo extends Context.Tag("@theoria/app/server/config/PackageDocsInfo")<
  PackageDocsInfo,
  {
    readonly corpus: PackageDocsCorpus
    readonly searchIndex: PackageDocsSearchIndex
  }
>() {}

export const PackageDocsLive = Layer.effect(
  PackageDocsInfo,
  Effect.gen(function*() {
    const corpus = yield* loadPackageDocsCorpus()
    const searchIndex = buildPackageDocsSearchIndex(corpus)

    yield* Effect.log("Loaded package docs corpus").pipe(
      Effect.annotateLogs("packageCount", corpus.catalog.length)
    )

    return PackageDocsInfo.of({ corpus, searchIndex })
  })
)
