import type { PackageName } from "@theoria/source-proof/contracts"
import { Option, Schema } from "effect"

import { FailureEnvelope, Metadata } from "../envelope.js"

const PackageVersionRecord = Schema.Record({ key: Schema.String, value: Schema.String })

/**
 * Package version map served by the `/api/versions/packages` endpoint.
 *
 * Keys are npm package names (e.g. `"effect-text"`, `"@scenesystems/digest"`).
 * Values are semver version strings read from the workspace `package.json` files.
 *
 * @since 0.1.0
 */
export class PackageVersions extends Schema.Class<PackageVersions>("PackageVersions")({
  versions: PackageVersionRecord
}) {
  static fromRecord(versions: Record<string, string>): PackageVersions {
    return PackageVersions.make({ versions })
  }

  versionFor(packageName: PackageName): string | null {
    return this.versions[packageName] ?? null
  }
}

export class PackageVersionsRoute extends Schema.TaggedClass<PackageVersionsRoute>()("packages", {}) {
  static packages(): PackageVersionsRoute {
    return packageVersionsRoute
  }

  static fromPathname(pathname: string): Option.Option<PackageVersionsRoute> {
    return pathname === PackageVersionsRoute.pathname()
      ? Option.some(PackageVersionsRoute.packages())
      : Option.none()
  }

  static matches(pathname: string): boolean {
    return Option.isSome(PackageVersionsRoute.fromPathname(pathname))
  }

  static pathname(): string {
    return "/api/versions/packages"
  }

  path(): string {
    return PackageVersionsRoute.pathname()
  }
}

export class PackageVersionsSuccessEnvelope extends Schema.Class<PackageVersionsSuccessEnvelope>(
  "PackageVersionsSuccessEnvelope"
)({
  ok: Schema.Literal(true),
  meta: Metadata,
  data: PackageVersions
}) {
  static ok(meta: Metadata, data: PackageVersions): PackageVersionsSuccessEnvelope {
    return PackageVersionsSuccessEnvelope.make({ ok: true, meta, data })
  }
}

export const PackageVersionsEnvelope = Schema.Union(PackageVersionsSuccessEnvelope, FailureEnvelope)

const packageVersionsRoute = PackageVersionsRoute.make({})
