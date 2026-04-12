import { Option, Schema } from "effect"

import { DspRuntimeProjection } from "./capability/effect-dsp-runtime-projection.js"
import { FailureEnvelope, Metadata } from "./envelope.js"

const NonNegativeNumber = Schema.Number.pipe(
  Schema.finite(),
  Schema.greaterThanOrEqualTo(0)
)

export class LiveHealthRoute extends Schema.TaggedClass<LiveHealthRoute>()("live", {}) {
  static live(): LiveHealthRoute {
    return liveHealthRoute
  }

  static fromPathname(pathname: string): Option.Option<LiveHealthRoute> {
    return pathname === LiveHealthRoute.pathname()
      ? Option.some(LiveHealthRoute.live())
      : Option.none()
  }

  static matches(pathname: string): boolean {
    return Option.isSome(LiveHealthRoute.fromPathname(pathname))
  }

  static pathname(): string {
    return "/api/health/live"
  }

  path(): string {
    return LiveHealthRoute.pathname()
  }
}

export class ReadyHealthRoute extends Schema.TaggedClass<ReadyHealthRoute>()("ready", {}) {
  static ready(): ReadyHealthRoute {
    return readyHealthRoute
  }

  static fromPathname(pathname: string): Option.Option<ReadyHealthRoute> {
    return pathname === ReadyHealthRoute.pathname()
      ? Option.some(ReadyHealthRoute.ready())
      : Option.none()
  }

  static matches(pathname: string): boolean {
    return Option.isSome(ReadyHealthRoute.fromPathname(pathname))
  }

  static pathname(): string {
    return "/api/health/ready"
  }

  path(): string {
    return ReadyHealthRoute.pathname()
  }
}

export class Live extends Schema.Class<Live>("Live")({
  status: Schema.Literal("live")
}) {
  static live(): Live {
    return live
  }
}

export class LiveSuccessEnvelope extends Schema.Class<LiveSuccessEnvelope>("LiveSuccessEnvelope")({
  ok: Schema.Literal(true),
  meta: Metadata,
  data: Live
}) {
  static ok(meta: Metadata, data: Live): LiveSuccessEnvelope {
    return LiveSuccessEnvelope.make({ ok: true, meta, data })
  }
}

export const LiveEnvelope = Schema.Union(LiveSuccessEnvelope, FailureEnvelope)

export class Ready extends Schema.Class<Ready>("Ready")({
  status: Schema.Literal("ready"),
  uptimeMs: NonNegativeNumber,
  dsp: DspRuntimeProjection
}) {
  static ready({ dsp, uptimeMs }: { readonly dsp: DspRuntimeProjection; readonly uptimeMs: number }): Ready {
    return Ready.make({
      status: "ready",
      uptimeMs,
      dsp
    })
  }
}

export class ReadySuccessEnvelope extends Schema.Class<ReadySuccessEnvelope>("ReadySuccessEnvelope")({
  ok: Schema.Literal(true),
  meta: Metadata,
  data: Ready
}) {
  static ok(meta: Metadata, data: Ready): ReadySuccessEnvelope {
    return ReadySuccessEnvelope.make({ ok: true, meta, data })
  }
}

export const ReadyEnvelope = Schema.Union(ReadySuccessEnvelope, FailureEnvelope)

const liveHealthRoute = LiveHealthRoute.make({})
const readyHealthRoute = ReadyHealthRoute.make({})
const live = Live.make({ status: "live" })
