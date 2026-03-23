import { describe, expect, it } from "@effect/vitest"
import { Effect, Schema } from "effect"

import * as SearchSpace from "../../src/SearchSpace/index.js"

const makeTypedSpace = () =>
  SearchSpace.unsafeMake({
    lr: SearchSpace.float(0.0001, 0.1),
    optimizer: SearchSpace.categorical(["adam", "sgd"])
  })

const expectTypedConfig = (config: { readonly lr: number; readonly optimizer: "adam" | "sgd" }) => config

const expectTypedEncoded = (config: { readonly lr: number; readonly optimizer: "adam" | "sgd" }) => config

describe("SearchSpace.Type", () => {
  it.effect("infers Type and Encoded from SearchSpace.make declarations", () =>
    Effect.sync(() => {
      const space = makeTypedSpace()
      const decode = Schema.decodeUnknownSync(space.schema)
      const decoded = decode({ lr: 0.01, optimizer: "adam" })
      const typedConfig: SearchSpace.Type<typeof space> = decoded
      const typedEncoded: SearchSpace.Encoded<typeof space> = {
        lr: 0.02,
        optimizer: "sgd"
      }

      const normalizedConfig = expectTypedConfig(typedConfig)
      const normalizedEncoded = expectTypedEncoded(typedEncoded)

      expect(normalizedConfig.optimizer).toBe("adam")
      expect(normalizedEncoded.optimizer).toBe("sgd")
    }))
})
