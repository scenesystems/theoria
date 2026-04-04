import { describe, expect, it } from "@effect/vitest"
import { Effect, Schema } from "effect"

import {
  PackagePublicExport,
  releaseGovernedVersion,
  ReleaseSinceSnapshot,
  ReleaseSinceSnapshotEntry,
  ReleaseSinceSnapshotJson,
  stampReleaseSinceSnapshot,
  verifyReleaseSince
} from "../src/index.js"

describe("release since governance", () => {
  it.effect("derives the governed release version from the highest pending changeset bump", () =>
    Effect.sync(() => {
      expect(
        releaseGovernedVersion({
          currentVersion: "0.1.0",
          packageName: "effect-text",
          pendingReleases: [
            ["effect-text", "patch"],
            ["effect-text", "minor"],
            ["effect-math", "major"]
          ]
        })
      ).toBe("0.2.0")

      expect(
        releaseGovernedVersion({
          currentVersion: "0.2.0",
          packageName: "effect-math",
          pendingReleases: [["effect-math", "patch"]]
        })
      ).toBe("0.2.1")

      expect(
        releaseGovernedVersion({
          currentVersion: "0.2.1",
          packageName: "effect-search",
          pendingReleases: []
        })
      ).toBe("0.2.1")
    }))

  it.effect("stamps next-release snapshots from prior truth and verifies release-accurate docstrings", () =>
    Effect.gen(function*() {
      const previousSnapshots = [
        new ReleaseSinceSnapshot({
          packageName: "fixture-package",
          releasedVersion: "0.2.0",
          exports: [
            new ReleaseSinceSnapshotEntry({
              subpath: ".",
              exportName: "existing",
              kind: "value",
              firstReleasedIn: "0.1.0"
            })
          ]
        })
      ]

      const currentExports = [
        new PackagePublicExport({
          subpath: ".",
          exportName: "existing",
          kind: "value",
          since: "0.1.0",
          category: "operations"
        }),
        new PackagePublicExport({
          subpath: ".",
          exportName: "newFeature",
          kind: "value",
          since: "0.3.0",
          category: "operations"
        })
      ]

      const stamped = stampReleaseSinceSnapshot({
        packageName: "fixture-package",
        releasedVersion: "0.3.0",
        exports: currentExports,
        previousSnapshots
      })

      expect(stamped).toEqual({
        packageName: "fixture-package",
        releasedVersion: "0.3.0",
        exports: [
          {
            subpath: ".",
            exportName: "existing",
            kind: "value",
            firstReleasedIn: "0.1.0"
          },
          {
            subpath: ".",
            exportName: "newFeature",
            kind: "value",
            firstReleasedIn: "0.3.0"
          }
        ]
      })

      const encoded = yield* Schema.encode(ReleaseSinceSnapshotJson)(stamped).pipe(Effect.orDie)
      const decoded = yield* Schema.decodeUnknown(ReleaseSinceSnapshotJson)(encoded).pipe(Effect.orDie)

      expect(decoded.releasedVersion).toBe("0.3.0")

      expect(
        verifyReleaseSince({
          currentVersion: "0.3.0",
          snapshots: previousSnapshots,
          exports: [
            new PackagePublicExport({
              subpath: ".",
              exportName: "existing",
              kind: "value",
              since: "0.2.0",
              category: "operations"
            }),
            new PackagePublicExport({
              subpath: ".",
              exportName: "newFeature",
              kind: "value",
              since: null,
              category: null
            })
          ]
        })
      ).toEqual([
        {
          subpath: ".",
          exportName: "existing",
          kind: "value",
          issue: "mismatched-since",
          expectedSince: "0.1.0",
          actualSince: "0.2.0"
        },
        {
          subpath: ".",
          exportName: "newFeature",
          kind: "value",
          issue: "missing-category",
          expectedSince: "0.3.0",
          actualSince: null
        },
        {
          subpath: ".",
          exportName: "newFeature",
          kind: "value",
          issue: "missing-since",
          expectedSince: "0.3.0",
          actualSince: null
        }
      ])
    }))
})
