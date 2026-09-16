import { expect, it } from "@effect/vitest"
import { durableFingerprint } from "@scenesystems/digest"
import { Chunk, Effect, Number as Num, Ref, Schema } from "effect"

import * as Cache from "../../src/Cache.js"
import * as ObjectiveCache from "../../src/ObjectiveCache.js"

const Configuration = Schema.Struct({ x: Schema.Number })

it.effect("resolves, observes, invalidates, and recomputes objective values", () =>
  Effect.gen(function*() {
    const cache = yield* Cache.Cache
    const events = yield* Ref.make(Chunk.empty<Cache.Event>())
    const computes = yield* Ref.make(0)
    const options = new ObjectiveCache.Options({ scope: "behavior" })
    const objectiveCache = yield* ObjectiveCache.make(options).pipe(
      Effect.provideService(Cache.Cache, cache),
      Effect.provideService(Cache.Observer, {
        record: (event) => Ref.update(events, Chunk.append(event))
      })
    )
    const config = { x: 1 }
    const request = new ObjectiveCache.Request({
      schema: Configuration,
      config,
      compute: Ref.updateAndGet(computes, Num.increment)
    })
    const fingerprint = yield* durableFingerprint(config)

    expect(yield* objectiveCache.resolve(request)).toEqual(new Cache.Result({ value: 1, resolution: "miss" }))
    expect(yield* objectiveCache.resolve(request)).toEqual(new Cache.Result({ value: 1, resolution: "hit" }))
    yield* objectiveCache.invalidate(Configuration, config)
    expect(yield* objectiveCache.resolve(request)).toEqual(new Cache.Result({ value: 2, resolution: "miss" }))
    expect(yield* Ref.get(events)).toEqual(
      Chunk.make(
        new Cache.Miss({ fingerprint, scope: options.scope }),
        new Cache.Hit({ fingerprint, scope: options.scope }),
        new Cache.Invalidation({ fingerprint, scope: options.scope }),
        new Cache.Miss({ fingerprint, scope: options.scope })
      )
    )
  }).pipe(Effect.provide(Cache.layerMemory)))
