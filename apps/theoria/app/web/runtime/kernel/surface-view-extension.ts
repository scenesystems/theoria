import type { Atom as AtomType } from "@effect-atom/atom"
import { Data } from "effect"
import type { ReactNode } from "react"

import type { RunRuntimeTelemetrySection } from "../../../contracts/presentation/run-runtime-telemetry.js"

export class SurfaceViewExtension extends Data.Class<SurfaceViewExtension.Shape> {
  static make(extension: SurfaceViewExtension.Shape): SurfaceViewExtension {
    return new SurfaceViewExtension(extension)
  }
}

export namespace SurfaceViewExtension {
  export interface Shape {
    readonly interactiveWidget: ReactNode | null
    readonly diagnosticsSections: (get: AtomType.Context) => ReadonlyArray<RunRuntimeTelemetrySection>
  }
}

export type SurfaceViewExtensionContext = AtomType.Context

export const noDiagnosticsSections = (_get: AtomType.Context): ReadonlyArray<RunRuntimeTelemetrySection> => []
