import { type Path } from "@effect/platform"
import { Schema } from "effect"

import { PackagePublicExport } from "./public-exports.js"
import { ApiSourceModule, ApiSourcePackage, PackagePublicEntrypoint } from "./source.js"

// Every package is converted by its own process: one TypeDoc program is a
// multi-gigabyte heap, and a single process holding all of them at once
// fragments its memory into more kernel mappings than Linux allows. The
// parent only ever handles what the processes hand back through these
// schemas, plus the serialized reflections they write next to the summary.

/** What the generator asks one conversion process to do. */
export class ConversionRequest extends Schema.Class<ConversionRequest>("ConversionRequest")({
  repositoryRoot: Schema.String,
  revision: Schema.String,
  packageDirectory: Schema.String,
  /** Directory the process writes its serialized reflections and summary into; shared by every process. */
  outputDirectory: Schema.String
}) {}

const conversionRequestVariable = "THEORIA_API_REFERENCE_CONVERSION"

export const conversionRequestConfig = Schema.Config(conversionRequestVariable, Schema.parseJson(ConversionRequest))

export const encodeConversionRequest = Schema.encode(Schema.parseJson(ConversionRequest))

export const conversionEnvironment = (encodedRequest: string): Record<string, string> => ({
  [conversionRequestVariable]: encodedRequest
})

export const ConvertedRoute = Schema.Struct({
  entrypoint: PackagePublicEntrypoint,
  publicExports: Schema.Array(PackagePublicExport)
})
export type ConvertedRoute = typeof ConvertedRoute.Type

/** A source file with its own documentation page, converted as an entrypoint of its own. */
export const ConvertedSourceProject = Schema.Struct({
  source: Schema.String,
  /** Serialized project, relative to the output directory. */
  project: Schema.String
})
export type ConvertedSourceProject = typeof ConvertedSourceProject.Type

export const ConvertedModule = Schema.Struct({
  source: ApiSourceModule,
  /** Serialized project, relative to the output directory. */
  project: Schema.String,
  routes: Schema.Array(ConvertedRoute),
  sourceProjects: Schema.Array(ConvertedSourceProject)
})
export type ConvertedModule = typeof ConvertedModule.Type

/** Summary one conversion process writes; the generator needs nothing else from it. */
export const ConvertedPackage = Schema.Struct({
  sourcePackage: ApiSourcePackage,
  modules: Schema.Array(ConvertedModule)
})
export type ConvertedPackage = typeof ConvertedPackage.Type

export const ConvertedPackageText = Schema.parseJson(ConvertedPackage)

/** Where a conversion process leaves its summary, relative to the output directory every process shares. */
export const convertedPackagePath = (path: Path.Path, packageSlug: string): string =>
  path.join("packages", packageSlug, "converted.json")
