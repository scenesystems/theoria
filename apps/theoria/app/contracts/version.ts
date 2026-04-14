import { Option, Schema } from "effect"

import { FailureEnvelope, Metadata } from "./envelope.js"

const NonNegativeNumber = Schema.Number.pipe(
  Schema.finite(),
  Schema.greaterThanOrEqualTo(0)
)

export class VersionRoute extends Schema.TaggedClass<VersionRoute>()("version", {}) {
  static current(): VersionRoute {
    return versionRoute
  }

  static fromPathname(pathname: string): Option.Option<VersionRoute> {
    return pathname === VersionRoute.pathname()
      ? Option.some(VersionRoute.current())
      : Option.none()
  }

  static matches(pathname: string): boolean {
    return Option.isSome(VersionRoute.fromPathname(pathname))
  }

  static pathname(): string {
    return "/api/version"
  }

  path(): string {
    return VersionRoute.pathname()
  }
}

export class Version extends Schema.Class<Version>("Version")({
  service: Schema.Literal("theoria"),
  buildSha: Schema.String,
  startedAtMs: NonNegativeNumber
}) {
  static current({ buildSha, startedAtMs }: { readonly buildSha: string; readonly startedAtMs: number }): Version {
    return Version.make({
      service: "theoria",
      buildSha,
      startedAtMs
    })
  }
}

export class VersionSuccessEnvelope extends Schema.Class<VersionSuccessEnvelope>("VersionSuccessEnvelope")({
  ok: Schema.Literal(true),
  meta: Metadata,
  data: Version
}) {
  static ok(meta: Metadata, data: Version): VersionSuccessEnvelope {
    return VersionSuccessEnvelope.make({ ok: true, meta, data })
  }
}

export const VersionEnvelope = Schema.Union(VersionSuccessEnvelope, FailureEnvelope)

const versionRoute = VersionRoute.make({})
