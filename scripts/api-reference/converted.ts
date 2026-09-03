import type { Application, DeclarationReflection, ProjectReflection } from "typedoc"

import { type PackagePublicExport } from "./public-exports.js"
import { type ApiSourceModule, type ApiSourcePackage, type PackagePublicEntrypoint } from "./source.js"

// Output of the conversion phase. Every package is converted before any page
// is emitted because cross-package `{@link}` resolution needs the public
// exports of every module first.

export type ApiConvertedRoute = {
  readonly entrypoint: PackagePublicEntrypoint
  readonly publicExports: ReadonlyArray<PackagePublicExport>
}

export type ApiConvertedModule = {
  readonly source: ApiSourceModule
  readonly project: ProjectReflection
  readonly reflection: DeclarationReflection
  readonly routes: ReadonlyArray<ApiConvertedRoute>
}

export type ApiConvertedPackage = {
  readonly app: Application
  readonly sourcePackage: ApiSourcePackage
  readonly modules: ReadonlyArray<ApiConvertedModule>
}
