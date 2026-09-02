import { Schema } from "effect"

import { runtimeDataPrefix } from "./static-store.js"

/**
 * Data the server needs at runtime but that only exists in the repository at
 * build time (workspace package versions, demo program sources).
 *
 * `apps/theoria/scripts/generate-runtime-data.ts` writes these files into
 * `public/runtime-data/` before `vite build` copies them into `dist/`; the
 * server reads them back through `StaticStore`. The public router refuses to
 * serve anything under `runtimeDataPrefix`.
 */
export const runtimeDataPathnames = {
  packageVersions: `${runtimeDataPrefix}package-versions.json`,
  programSources: `${runtimeDataPrefix}program-sources.json`
}

/** Workspace package name → published version. */
export const PackageVersionsJson = Schema.parseJson(Schema.Record({ key: Schema.String, value: Schema.String }))

/** App-relative source path (`server/demos/digest/run.ts`) → file contents. */
export const ProgramSourcesJson = Schema.parseJson(Schema.Record({ key: Schema.String, value: Schema.String }))
