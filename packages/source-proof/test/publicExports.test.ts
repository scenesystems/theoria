import { describe, expect, it } from "@effect/vitest"
import { Effect, Option } from "effect"

import { docTagValues, parseTypeScript, publicExportDocs, releaseSinceSnapshotKey } from "../src/index.js"

describe("public export docs", () => {
  it.effect("collects documentation metadata for direct exported declarations", () =>
    Effect.sync(() => {
      const sourceFile = parseTypeScript(
        "fixture.ts",
        `
        /**
         * @since 0.3.0
         * @category constructors
         */
        export const make = () => 1

        /**
         * @since 0.2.0
         * @category models
         */
        export interface Model {
          readonly value: number
        }

        /**
         * @since 0.1.0
         * @category constructors
         */
        export default function create() {
          return 2
        }
        `
      )

      expect(publicExportDocs(sourceFile)).toEqual([
        {
          exportName: "make",
          kind: "value",
          since: "0.3.0",
          category: "constructors"
        },
        {
          exportName: "Model",
          kind: "type",
          since: "0.2.0",
          category: "models"
        },
        {
          exportName: "default",
          kind: "default",
          since: "0.1.0",
          category: "constructors"
        }
      ])
    }))

  it.effect("collects documentation metadata for namespace and named re-export barrels", () =>
    Effect.sync(() => {
      const sourceFile = parseTypeScript(
        "barrel.ts",
        `
        /**
         * @since 0.2.0
         * @category domains
         */
        export * as Text from "./Text/index.js"

        /**
         * @since 0.3.0
         * @category layout
         */
        export { layoutLinesWith } from "./Text/layout.js"

        /**
         * @since 0.3.0
         * @category models
         */
        export type { LayoutCursor } from "./Text/schema.js"
        `
      )

      expect(publicExportDocs(sourceFile)).toEqual([
        {
          exportName: "Text",
          kind: "namespace",
          since: "0.2.0",
          category: "domains"
        },
        {
          exportName: "layoutLinesWith",
          kind: "value",
          since: "0.3.0",
          category: "layout"
        },
        {
          exportName: "LayoutCursor",
          kind: "type",
          since: "0.3.0",
          category: "models"
        }
      ])
    }))

  it.effect("prefers specifier-level tags while falling back to barrel-level tags", () =>
    Effect.sync(() => {
      const sourceFile = parseTypeScript(
        "specifier-barrel.ts",
        `
        /**
         * @category re-exports
         */
        export {
          /**
           * @since 0.1.0
           */
          make,
          /**
           * @since 0.2.0
           * @category models
           */
          type Model
        } from "./surface.js"
        `
      )

      expect(publicExportDocs(sourceFile)).toEqual([
        {
          exportName: "make",
          kind: "value",
          since: "0.1.0",
          category: "re-exports"
        },
        {
          exportName: "Model",
          kind: "type",
          since: "0.2.0",
          category: "models"
        }
      ])
    }))

  it.effect("collects destructured export metadata from binding elements", () =>
    Effect.sync(() => {
      const sourceFile = parseTypeScript(
        "destructured.ts",
        `
        /**
         * @category constructors
         */
        export const {
          /**
           * @since 0.1.0
           */
          Continue: ContinueValue,
          /**
           * @since 0.1.0
           * @category pattern-matching
           */
          $match: matchValue
        } = Decisions
        `
      )

      expect(publicExportDocs(sourceFile)).toEqual([
        {
          exportName: "ContinueValue",
          kind: "value",
          since: "0.1.0",
          category: "constructors"
        },
        {
          exportName: "matchValue",
          kind: "value",
          since: "0.1.0",
          category: "pattern-matching"
        }
      ])
    }))

  it.effect("provides reusable doc-tag and release-key helpers for package governance", () =>
    Effect.gen(function*() {
      const sourceFile = parseTypeScript(
        "helpers.ts",
        `
        /**
         * @since 0.3.0
         * @category proofs
         */
        export const verify = () => true
        `
      )
      const statement = yield* Option.match(Option.fromNullable(sourceFile.statements[0]), {
        onNone: () => Effect.fail("expected one statement in helper fixture"),
        onSome: Effect.succeed
      }).pipe(Effect.orDie)

      expect(docTagValues(statement, "since")).toEqual(["0.3.0"])
      expect(docTagValues(statement, "category")).toEqual(["proofs"])
      expect(
        releaseSinceSnapshotKey({
          subpath: "./Contracts",
          exportName: "verify",
          kind: "value"
        })
      ).toBe("./Contracts::verify::value")
    }))
})
