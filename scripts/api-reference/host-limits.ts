import { FileSystem } from "@effect/platform"
import { Effect, Schema } from "effect"

// Bun 1.3.9's JavaScriptCore marks every 16 KB heap block it decommits with
// MADV_DONTDUMP and clears the mark on commit. Each toggle splits a kernel
// memory mapping, so TypeDoc's multi-gigabyte heap fragments into 65-85k
// mappings. Linux caps mappings per process at vm.max_map_count (65,530 by
// default); at the cap the kernel refuses the split and WebKit's allocator
// retries madvise forever with no JavaScript running. Fail up front instead.
export const requiredMemoryMappings = 262_144

const maxMapCountPath = "/proc/sys/vm/max_map_count"

export class HostLimitError extends Schema.TaggedError<HostLimitError>()("HostLimitError", {
  message: Schema.String
}) {}

/** Fails when the host's per-process memory-mapping limit is below what the generator needs. Not Linux: no limit. */
export const checkHostLimits: Effect.Effect<void, HostLimitError, FileSystem.FileSystem> = Effect.gen(function*() {
  const fileSystem = yield* FileSystem.FileSystem
  const isLinux = yield* fileSystem.exists(maxMapCountPath).pipe(Effect.orElseSucceed(() => false))
  if (!isLinux) return
  const limit = yield* fileSystem.readFileString(maxMapCountPath).pipe(
    Effect.flatMap((text) => Schema.decode(Schema.NumberFromString)(text.trim())),
    Effect.orDie
  )
  if (limit < requiredMemoryMappings) {
    return yield* new HostLimitError({
      message: `vm.max_map_count is ${String(limit)}; the API reference generator needs at least ${
        String(requiredMemoryMappings)
      } (see scripts/api-reference/host-limits.ts). Raise it with: sudo sysctl -w vm.max_map_count=${
        String(requiredMemoryMappings)
      }`
    })
  }
})
