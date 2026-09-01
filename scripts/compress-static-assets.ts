import { FileSystem, Path } from "@effect/platform"
import { BunContext, BunRuntime } from "@effect/platform-bun"
import { Array as Arr, Console, Effect } from "effect"

const applicationRootUrl = new URL("../apps/theoria/", import.meta.url)
const compressibleAsset = /\.(?:css|html|js|json|svg)$/u
const minimumCompressionSize = 1_024

const compressFile = (filePath: string) =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const bytes = yield* fileSystem.readFile(filePath)

    if (bytes.byteLength < minimumCompressionSize) return false

    const input = new Uint8Array(bytes.byteLength)
    input.set(bytes)
    const compressed = yield* Effect.sync(() => Bun.gzipSync(input, { level: 9 }))

    if (compressed.byteLength >= bytes.byteLength) return false

    yield* fileSystem.writeFile(`${filePath}.gz`, compressed)
    return true
  })

const program = Effect.gen(function*() {
  const fileSystem = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const applicationRoot = yield* path.fromFileUrl(applicationRootUrl).pipe(Effect.orDie)
  const distRoot = path.join(applicationRoot, "dist")
  const entries = yield* fileSystem.readDirectory(distRoot, { recursive: true })
  const files = Arr.map(
    Arr.filter(entries, (entry) => compressibleAsset.test(entry)),
    (entry) => path.join(distRoot, entry)
  )
  const compressed = yield* Effect.forEach(files, compressFile, { concurrency: 16 })
  const count = Arr.filter(compressed, (written) => written).length

  yield* Console.log(`Precompressed ${String(count)} production assets.`)
})

BunRuntime.runMain(program.pipe(Effect.provide(BunContext.layer)))
