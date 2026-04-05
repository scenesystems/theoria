import { FileSystem, Path } from "@effect/platform"
import { Array as Arr, Console, Data, Effect, Option, Record as Rec, Schema } from "effect"

import { packageNameFromString, packageNameOption, PackageNameSchema, ReleaseVersionSchema } from "./identifiers.js"
import type { PackageName } from "./identifiers.js"

const RepositoryMetadataSchema = Schema.Struct({
  type: Schema.optional(Schema.Unknown),
  url: Schema.optional(Schema.Unknown),
  directory: Schema.optional(Schema.Unknown)
})

const UnknownRecordSchema = Schema.Record({ key: Schema.String, value: Schema.Unknown })

/**
 * Package-manifest surface consumed by root publish-readiness checks.
 *
 * @since 0.0.0
 * @category schemas
 */
export const PublishReadinessManifestSchema = Schema.Struct({
  name: PackageNameSchema,
  version: ReleaseVersionSchema,
  exports: Schema.optional(UnknownRecordSchema),
  scripts: Schema.optional(UnknownRecordSchema),
  keywords: Schema.optional(Schema.Array(Schema.String)),
  repository: Schema.optional(RepositoryMetadataSchema),
  homepage: Schema.optional(Schema.String)
})

/**
 * JSON decoder for package manifests used by the root release framework.
 *
 * @since 0.0.0
 * @category schemas
 */
export const PublishReadinessManifestJson = Schema.parseJson(PublishReadinessManifestSchema)

/**
 * Issue emitted by the root publish-readiness engine.
 *
 * @since 0.0.0
 * @category models
 */
export class PublishReadinessIssue extends Data.Class<{
  readonly code: string
  readonly message: string
}> {}

/**
 * Package-specific variance consumed by the root publish-readiness engine.
 *
 * @since 0.0.0
 * @category models
 */
export class PublishReadinessProfile extends Data.Class<{
  readonly packageName: PackageName
  readonly packageDirectory: string
  readonly requiredKeywords: ReadonlyArray<string>
  readonly requiredReleaseReadmePhrases: ReadonlyArray<string>
  readonly requiredScriptNames: ReadonlyArray<string>
  readonly requiredScriptCommandFragments: Readonly<Record<string, ReadonlyArray<string>>>
  readonly requiresChangesetPublishContract: boolean
}> {}

/**
 * Canonical repository-owned release-framework authority.
 *
 * @since 0.0.0
 * @category models
 */
export class ReleaseFrameworkAuthority extends Data.Class<{
  readonly name: string
  readonly packageAlignmentSeam: string
  readonly rootGates: ReadonlyArray<string>
  readonly packedArtifactContract: string
  readonly docsContract: ReadonlyArray<string>
  readonly releaseSnapshotContract: ReadonlyArray<string>
  readonly changesetWorkflow: ReadonlyArray<string>
  readonly publishReadinessCli: string
  readonly releaseSnapshotCli: string
  readonly governedPackages: ReadonlyArray<PublishReadinessProfile>
}> {}

/**
 * Aggregated report from one publish-readiness evaluation.
 *
 * @since 0.0.0
 * @category models
 */
export class PublishReadinessReport extends Data.Class<{
  readonly profile: PublishReadinessProfile
  readonly errors: ReadonlyArray<PublishReadinessIssue>
  readonly todos: ReadonlyArray<PublishReadinessIssue>
}> {}

/**
 * CLI-level failure for root publish-readiness execution.
 *
 * @since 0.0.0
 * @category errors
 */
export class PublishReadinessCliError extends Data.TaggedError("PublishReadinessCliError")<{
  readonly message: string
}> {}

/**
 * CLI flags for the root publish-readiness adapter.
 *
 * @since 0.0.0
 * @category models
 */
export class PublishReadinessCliFlags extends Data.Class<{
  readonly packageName: Option.Option<string>
  readonly packageRoot: Option.Option<string>
  readonly rootManifestPath: Option.Option<string>
  readonly packedManifestPath: Option.Option<string>
  readonly readmePath: Option.Option<string>
  readonly requirePackedManifest: boolean
  readonly enforceMonorepoTopology: boolean
}> {}

const THEORIA_REPOSITORY_URL = "https://github.com/scenesystems/theoria.git"
const FORBIDDEN_REPOSITORY_URL_FRAGMENTS: ReadonlyArray<string> = [
  "github.com/scenesystems/eva",
  "github.com/scenesystems/eva.git"
]

type SupportedRootExports = Readonly<Record<string, string | null>>

const ROOT_PUBLISH_READINESS_SCRIPT = "../../scripts/publish-readiness.ts"
const ROOT_RELEASE_SNAPSHOT_SCRIPT = "../../scripts/stamp-release-snapshot.ts"

const publishReadinessCommandFragments = (packageName: string): ReadonlyArray<string> => [
  ROOT_PUBLISH_READINESS_SCRIPT,
  `--package=${packageName}`
]

const releaseSnapshotCommandFragments = (): ReadonlyArray<string> => [ROOT_RELEASE_SNAPSHOT_SCRIPT]

const makePublishReadinessProfile = (input: {
  readonly packageName: string
  readonly packageDirectory: string
  readonly requiredKeywords: ReadonlyArray<string>
  readonly requiredReleaseReadmePhrases?: ReadonlyArray<string>
  readonly requiredScriptNames: ReadonlyArray<string>
  readonly requiredScriptCommandFragments?: Readonly<Record<string, ReadonlyArray<string>>>
  readonly requiresChangesetPublishContract?: boolean
}): PublishReadinessProfile =>
  new PublishReadinessProfile({
    packageName: packageNameFromString(input.packageName),
    packageDirectory: input.packageDirectory,
    requiredKeywords: input.requiredKeywords,
    requiredReleaseReadmePhrases: input.requiredReleaseReadmePhrases ?? [],
    requiredScriptNames: input.requiredScriptNames,
    requiredScriptCommandFragments: input.requiredScriptCommandFragments ?? {},
    requiresChangesetPublishContract: input.requiresChangesetPublishContract ?? false
  })

const effectMathProfile = makePublishReadinessProfile({
  packageName: "effect-math",
  packageDirectory: "packages/effect-math",
  requiredKeywords: ["effect", "numerics", "linear-algebra", "statistics", "probability", "mathematics"],
  requiredScriptNames: ["publish:check", "release-snapshots:stamp", "docgen"],
  requiredScriptCommandFragments: {
    "publish:check": publishReadinessCommandFragments("effect-math"),
    "release-snapshots:stamp": releaseSnapshotCommandFragments()
  }
})

const effectSearchProfile = makePublishReadinessProfile({
  packageName: "effect-search",
  packageDirectory: "packages/effect-search",
  requiredKeywords: [
    "effect",
    "optimization",
    "bayesian-optimization",
    "black-box-optimization",
    "hyperparameter-optimization",
    "tpe",
    "motpe",
    "hyperband",
    "bohb",
    "pareto"
  ],
  requiredReleaseReadmePhrases: ["publish:check", "changeset-publish --dry-run"],
  requiredScriptNames: ["publish:check", "release-snapshots:stamp", "changeset-publish", "docgen"],
  requiredScriptCommandFragments: {
    "publish:check": publishReadinessCommandFragments("effect-search"),
    "release-snapshots:stamp": releaseSnapshotCommandFragments(),
    "changeset-publish": [
      "publish:check",
      "--require-packed-manifest",
      "--enforce-monorepo-topology",
      "changeset publish"
    ]
  },
  requiresChangesetPublishContract: true
})

const effectDspProfile = makePublishReadinessProfile({
  packageName: "effect-dsp",
  packageDirectory: "packages/effect-dsp",
  requiredKeywords: ["effect", "dspy", "prompt-optimization", "llm"],
  requiredScriptNames: ["release-snapshots:stamp", "docgen"],
  requiredScriptCommandFragments: {
    "release-snapshots:stamp": releaseSnapshotCommandFragments()
  }
})

const effectTextProfile = makePublishReadinessProfile({
  packageName: "effect-text",
  packageDirectory: "packages/effect-text",
  requiredKeywords: ["effect", "text-layout", "text-measurement", "line-breaking", "typography"],
  requiredScriptNames: ["release-snapshots:stamp", "docgen"],
  requiredScriptCommandFragments: {
    "release-snapshots:stamp": releaseSnapshotCommandFragments()
  }
})

const effectInferenceProfile = makePublishReadinessProfile({
  packageName: "effect-inference",
  packageDirectory: "packages/effect-inference",
  requiredKeywords: ["effect", "inference", "llm", "runtime-resolution"],
  requiredScriptNames: ["release-snapshots:stamp", "docgen"],
  requiredScriptCommandFragments: {
    "release-snapshots:stamp": releaseSnapshotCommandFragments()
  }
})

const digestProfile = makePublishReadinessProfile({
  packageName: "@scenesystems/digest",
  packageDirectory: "packages/digest",
  requiredKeywords: ["effect", "digest", "content-addressing", "canonicalization"],
  requiredScriptNames: ["release-snapshots:stamp", "docgen"],
  requiredScriptCommandFragments: {
    "release-snapshots:stamp": releaseSnapshotCommandFragments()
  }
})

const sealProfile = makePublishReadinessProfile({
  packageName: "@scenesystems/seal",
  packageDirectory: "packages/seal",
  requiredKeywords: ["effect", "aead", "encryption", "authenticated-encryption"],
  requiredScriptNames: ["release-snapshots:stamp", "docgen"],
  requiredScriptCommandFragments: {
    "release-snapshots:stamp": releaseSnapshotCommandFragments()
  }
})

const signProfile = makePublishReadinessProfile({
  packageName: "@scenesystems/sign",
  packageDirectory: "packages/sign",
  requiredKeywords: ["effect", "digital-signature", "key-agreement", "key-encapsulation"],
  requiredScriptNames: ["release-snapshots:stamp", "docgen"],
  requiredScriptCommandFragments: {
    "release-snapshots:stamp": releaseSnapshotCommandFragments()
  }
})

/**
 * Root release-framework authority for the current convergence wave.
 *
 * @since 0.0.0
 * @category constants
 */
export const TheoriaReleaseFrameworkAuthority = new ReleaseFrameworkAuthority({
  name: "root-release-framework",
  packageAlignmentSeam: "publishReadinessProfiles",
  rootGates: ["check", "check:tests", "lint", "test", "build", "docgen"],
  packedArtifactContract: "build-utils pack-v3",
  docsContract: ["README release checklist", "root docgen", "package proof commands"],
  releaseSnapshotContract: [
    "checked-in test/package/release-snapshots/*.json",
    "version-stamped @since/@category governance",
    "root snapshot-stamping CLI"
  ],
  changesetWorkflow: [
    "changeset",
    "changeset:version",
    "changeset:publish",
    "scripts/changeset-version-with-release-snapshots.mjs"
  ],
  publishReadinessCli: "scripts/publish-readiness.ts",
  releaseSnapshotCli: "scripts/stamp-release-snapshot.ts",
  governedPackages: [
    effectMathProfile,
    effectSearchProfile,
    effectDspProfile,
    effectTextProfile,
    effectInferenceProfile,
    digestProfile,
    sealProfile,
    signProfile
  ]
})

const hasOwn = (record: Readonly<Record<string, unknown>>, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(record, key)

const isUnknownRecord = (input: unknown): input is Readonly<Record<string, unknown>> =>
  typeof input === "object" && input !== null && !Arr.isArray(input)

const asString = (input: unknown): Option.Option<string> =>
  typeof input === "string"
    ? Option.some(input)
    : Option.none()

const emptyUnknownRecord = (): Record<string, unknown> => ({})

const manifestHomepage = (profile: PublishReadinessProfile): string =>
  `https://github.com/scenesystems/theoria/tree/main/${profile.packageDirectory}`

const dedupeIssues = (issues: ReadonlyArray<PublishReadinessIssue>): ReadonlyArray<PublishReadinessIssue> =>
  Arr.reduce(
    issues,
    new Array<PublishReadinessIssue>(),
    (accumulator, issue) =>
      accumulator.some((existing) => existing.code === issue.code && existing.message === issue.message)
        ? accumulator
        : [...accumulator, issue]
  )

const packageProfile = (packageName: PackageName): Option.Option<PublishReadinessProfile> =>
  Arr.findFirst(TheoriaReleaseFrameworkAuthority.governedPackages, (profile) => profile.packageName === packageName)

const issue = (code: string, message: string): PublishReadinessIssue => new PublishReadinessIssue({ code, message })

const emptySupportedRootExports = (): Record<string, string | null> => ({})

const supportedRootExports = (
  exportMap: Readonly<Record<string, unknown>>
): {
  readonly rootExports: SupportedRootExports
  readonly unsupportedSubpaths: ReadonlyArray<string>
} =>
  Arr.reduce(
    Rec.toEntries(exportMap),
    {
      rootExports: emptySupportedRootExports(),
      unsupportedSubpaths: new Array<string>()
    },
    (accumulator, [subpath, target]) => {
      if (typeof target === "string" || target === null) {
        return {
          rootExports: {
            ...accumulator.rootExports,
            [subpath]: target
          },
          unsupportedSubpaths: accumulator.unsupportedSubpaths
        }
      }

      return {
        rootExports: accumulator.rootExports,
        unsupportedSubpaths: [...accumulator.unsupportedSubpaths, subpath]
      }
    }
  )

const sourcePathToPackedModule = (sourcePath: string): Option.Option<string> => {
  if (!sourcePath.startsWith("./src/")) {
    return Option.none()
  }

  if (!sourcePath.endsWith(".ts") && !sourcePath.endsWith(".mts")) {
    return Option.none()
  }

  return Option.some(
    sourcePath
      .slice("./src/".length)
      .replace(/\.mts$/u, "")
      .replace(/\.ts$/u, "")
  )
}

const expectedPackedTarget = (
  subpath: string,
  rootTarget: string | null
): string | null | Readonly<Record<string, string>> => {
  if (subpath === "./package.json") {
    return "./package.json"
  }

  if (rootTarget === null) {
    return null
  }

  return Option.match(sourcePathToPackedModule(rootTarget), {
    onNone: () => null,
    onSome: (modulePath) => ({
      types: `./dist/dts/${modulePath}.d.ts`,
      import: `./dist/esm/${modulePath}.js`,
      default: `./dist/cjs/${modulePath}.js`
    })
  })
}

const matchesPackedTarget = (
  subpath: string,
  actual: unknown,
  rootTarget: string | null
): boolean => {
  const expected = expectedPackedTarget(subpath, rootTarget)

  if (expected === null || typeof expected === "string") {
    return actual === expected
  }

  if (typeof actual !== "object" || actual === null || Arr.isArray(actual)) {
    return false
  }

  if (!isUnknownRecord(actual)) {
    return false
  }

  const actualRecord = actual

  return actualRecord.types === expected.types
    && actualRecord.import === expected.import
    && actualRecord.default === expected.default
}

const missingRequiredExports = (
  requiredRootExports: SupportedRootExports,
  exportMap: Readonly<Record<string, unknown>>
): ReadonlyArray<string> =>
  Arr.filterMap(Rec.toEntries(requiredRootExports), ([subpath]) =>
    hasOwn(exportMap, subpath)
      ? Option.none<string>()
      : Option.some(subpath))

const malformedPackedTargets = (
  requiredRootExports: SupportedRootExports,
  exportMap: Readonly<Record<string, unknown>>
): ReadonlyArray<string> =>
  Arr.filterMap(
    Rec.toEntries(requiredRootExports),
    ([subpath, rootTarget]) =>
      hasOwn(exportMap, subpath) && !matchesPackedTarget(subpath, exportMap[subpath], rootTarget)
        ? Option.some(subpath)
        : Option.none<string>()
  )

const checkRepositoryMetadata = (
  profile: PublishReadinessProfile,
  rootManifest: typeof PublishReadinessManifestSchema.Type,
  enforceMonorepoTopology: boolean
): PublishReadinessReport => {
  const repositoryOption = Option.fromNullable(rootManifest.repository)
  const repositoryUrl = Option.flatMap(repositoryOption, (repository) => asString(repository.url))
  const repositoryDirectory = Option.flatMap(repositoryOption, (repository) => asString(repository.directory))
  const repositoryType = Option.flatMap(repositoryOption, (repository) => asString(repository.type))
  const homepageOption = Option.fromNullable(rootManifest.homepage)
  const topologyMatches = Option.all([repositoryUrl, repositoryDirectory, homepageOption]).pipe(
    Option.map(([url, directory, homepage]) =>
      url === THEORIA_REPOSITORY_URL
      && directory === profile.packageDirectory
      && homepage === manifestHomepage(profile)
    ),
    Option.getOrElse(() => false)
  )

  const errors = dedupeIssues(
    Arr.filterMap(
      [
        Option.isNone(repositoryOption)
          ? Option.some(
            issue(
              "metadata.repository.object-missing",
              "package.json.repository must be an object with type/url metadata"
            )
          )
          : Option.none<PublishReadinessIssue>(),
        Option.isSome(repositoryOption) && Option.getOrElse(repositoryType, () => "") !== "git"
          ? Option.some(issue("metadata.repository.type-invalid", "package.json.repository.type must be \"git\""))
          : Option.none<PublishReadinessIssue>(),
        Option.isSome(repositoryOption) && Option.isNone(repositoryUrl)
          ? Option.some(issue("metadata.repository.url-missing", "package.json.repository.url must be a string"))
          : Option.none<PublishReadinessIssue>(),
        Option.isSome(repositoryUrl) &&
          FORBIDDEN_REPOSITORY_URL_FRAGMENTS.some((fragment) => repositoryUrl.value.includes(fragment))
          ? Option.some(
            issue("metadata.repository.url-forbidden", "package.json.repository.url cannot point at scenesystems/eva")
          )
          : Option.none<PublishReadinessIssue>(),
        Option.isNone(homepageOption)
          ? Option.some(issue("metadata.homepage.missing", "package.json.homepage must be a string"))
          : Option.none<PublishReadinessIssue>(),
        enforceMonorepoTopology && !topologyMatches
          ? Option.some(issue(
            "metadata.monorepo.target-mismatch",
            `repository.url/repository.directory/homepage must match ${THEORIA_REPOSITORY_URL} + ${profile.packageDirectory}`
          ))
          : Option.none<PublishReadinessIssue>()
      ],
      (candidate) => candidate
    )
  )

  const todos = !enforceMonorepoTopology && !topologyMatches
    ? [
      issue(
        "metadata.monorepo.topology-todo",
        "repository.url + repository.directory + homepage should match scenesystems/theoria monorepo layout"
      )
    ]
    : []

  return new PublishReadinessReport({ profile, errors, todos })
}

const checkRootExportContract = (
  profile: PublishReadinessProfile,
  rootManifest: typeof PublishReadinessManifestSchema.Type
): PublishReadinessReport => {
  return Option.match(Option.fromNullable(rootManifest.exports), {
    onNone: () =>
      new PublishReadinessReport({
        profile,
        errors: [issue("exports.root.map-missing", "package.json.exports must be an object")],
        todos: []
      }),
    onSome: (exportMap) => {
      const normalized = supportedRootExports(exportMap)

      return new PublishReadinessReport({
        profile,
        errors: dedupeIssues(
          Arr.filterMap(
            [
              !hasOwn(exportMap, ".")
                ? Option.some(
                  issue(
                    "exports.root.entrypoint-missing",
                    "package.json.exports must define '.' as the public entrypoint"
                  )
                )
                : Option.none<PublishReadinessIssue>(),
              hasOwn(exportMap, "./*")
                ? Option.some(
                  issue("exports.root.wildcard-forbidden", "package.json.exports cannot include wildcard subpath './*'")
                )
                : Option.none<PublishReadinessIssue>(),
              normalized.unsupportedSubpaths.length > 0
                ? Option.some(issue(
                  "exports.root.target-unsupported",
                  `package.json.exports contains non-string or non-null targets for: ${
                    normalized.unsupportedSubpaths.join(", ")
                  }`
                ))
                : Option.none<PublishReadinessIssue>()
            ],
            (candidate) => candidate
          )
        ),
        todos: []
      })
    }
  })
}

const checkPackedExportContract = (
  profile: PublishReadinessProfile,
  rootManifest: typeof PublishReadinessManifestSchema.Type,
  packedManifest: Option.Option<typeof PublishReadinessManifestSchema.Type>,
  requirePackedManifest: boolean
): PublishReadinessReport => {
  return Option.match(packedManifest, {
    onNone: () =>
      new PublishReadinessReport({
        profile,
        errors: requirePackedManifest
          ? [
            issue("exports.packed.manifest-missing", "dist/package.json is required for packed export contract checks")
          ]
          : [],
        todos: []
      }),
    onSome: (currentPackedManifest) =>
      Option.match(Option.fromNullable(currentPackedManifest.exports), {
        onNone: () =>
          new PublishReadinessReport({
            profile,
            errors: [issue("exports.packed.map-missing", "dist/package.json.exports must be an object")],
            todos: []
          }),
        onSome: (exportMap) => {
          const requiredRootExports = Option.fromNullable(rootManifest.exports).pipe(
            Option.map((rootExports) => supportedRootExports(rootExports).rootExports),
            Option.getOrElse(() => ({}))
          )
          const missingSubpaths = missingRequiredExports(requiredRootExports, exportMap)
          const malformedTargets = malformedPackedTargets(requiredRootExports, exportMap)

          return new PublishReadinessReport({
            profile,
            errors: dedupeIssues(
              Arr.filterMap(
                [
                  hasOwn(exportMap, "./*")
                    ? Option.some(issue(
                      "exports.packed.wildcard-forbidden",
                      "dist/package.json.exports cannot include wildcard subpath './*'"
                    ))
                    : Option.none<PublishReadinessIssue>(),
                  missingSubpaths.length > 0
                    ? Option.some(issue(
                      "exports.packed.missing-subpaths",
                      `dist/package.json.exports is missing required subpaths: ${missingSubpaths.join(", ")}`
                    ))
                    : Option.none<PublishReadinessIssue>(),
                  malformedTargets.length > 0
                    ? Option.some(issue(
                      "exports.packed.target-malformed",
                      `dist/package.json.exports has malformed target entries for: ${malformedTargets.join(", ")}`
                    ))
                    : Option.none<PublishReadinessIssue>()
                ],
                (candidate) => candidate
              )
            ),
            todos: []
          })
        }
      })
  })
}

const checkKeywordCoverage = (
  profile: PublishReadinessProfile,
  rootManifest: typeof PublishReadinessManifestSchema.Type
): PublishReadinessReport => {
  return Option.match(Option.fromNullable(rootManifest.keywords), {
    onNone: () =>
      new PublishReadinessReport({
        profile,
        errors: [issue("keywords.array-missing", "package.json.keywords must be an array of strings")],
        todos: []
      }),
    onSome: (keywords) => {
      const normalized = Arr.map(keywords, (keyword) => keyword.toLowerCase())
      const missing = Arr.filter(profile.requiredKeywords, (keyword) => !normalized.includes(keyword))

      return new PublishReadinessReport({
        profile,
        errors: missing.length > 0
          ? [issue("keywords.required-missing", `package.json.keywords is missing: ${missing.join(", ")}`)]
          : [],
        todos: []
      })
    }
  })
}

const checkScriptWiring = (
  profile: PublishReadinessProfile,
  rootManifest: typeof PublishReadinessManifestSchema.Type
): PublishReadinessReport => {
  const scriptCode = (scriptName: string): string => scriptName.replace(/:/gu, "-")

  return Option.match(Option.fromNullable(rootManifest.scripts), {
    onNone: () =>
      new PublishReadinessReport({
        profile,
        errors: [issue("scripts.map-missing", "package.json.scripts must be an object")],
        todos: []
      }),
    onSome: (scripts) => {
      const missingScripts = Arr.filter(
        profile.requiredScriptNames,
        (scriptName) => Option.isNone(asString(scripts[scriptName]))
      )
      const changesetPublish = asString(scripts["changeset-publish"])
      const delegateDrift = Arr.filterMap(
        Rec.toEntries(profile.requiredScriptCommandFragments),
        ([scriptName, fragments]) => {
          const command = asString(scripts[scriptName])

          if (Option.isNone(command)) {
            return Option.none<PublishReadinessIssue>()
          }

          const missingFragments = Arr.filter(fragments, (fragment) => !command.value.includes(fragment))

          return missingFragments.length > 0
            ? Option.some(
              issue(
                `scripts.${scriptCode(scriptName)}.delegate-mismatch`,
                `${scriptName} must delegate through ${missingFragments.join(", ")}`
              )
            )
            : Option.none<PublishReadinessIssue>()
        }
      )

      return new PublishReadinessReport({
        profile,
        errors: dedupeIssues([
          ...Arr.map(
            missingScripts,
            (scriptName) =>
              issue(`scripts.${scriptCode(scriptName)}.missing`, `package.json.scripts must define ${scriptName}`)
          ),
          ...Arr.filterMap(
            [
              ...delegateDrift.map(Option.some),
              profile.requiresChangesetPublishContract && Option.isSome(changesetPublish) &&
                !changesetPublish.value.includes("publish:check")
                ? Option.some(issue(
                  "scripts.changeset-publish.missing-contract-check",
                  "changeset-publish must execute publish:check before publish"
                ))
                : Option.none<PublishReadinessIssue>()
            ],
            (candidate) => candidate
          )
        ]),
        todos: []
      })
    }
  })
}

const checkReleaseDocs = (
  profile: PublishReadinessProfile,
  readmeText: Option.Option<string>
): PublishReadinessReport => {
  if (profile.requiredReleaseReadmePhrases.length === 0) {
    return new PublishReadinessReport({ profile, errors: [], todos: [] })
  }

  if (Option.isNone(readmeText)) {
    return new PublishReadinessReport({
      profile,
      errors: [
        issue("docs.release-checklist.readme-missing", "README.md is required for release-checklist governance")
      ],
      todos: []
    })
  }

  const missingPhrases = Arr.filter(
    profile.requiredReleaseReadmePhrases,
    (phrase) => !readmeText.value.includes(phrase)
  )

  return new PublishReadinessReport({
    profile,
    errors: missingPhrases.length > 0
      ? [issue("docs.release-checklist.missing", `README release checklist must include: ${missingPhrases.join(", ")}`)]
      : [],
    todos: []
  })
}

/**
 * Returns the root publish-readiness profile for one governed package.
 *
 * @since 0.0.0
 * @category queries
 */
export const publishReadinessProfile = (packageName: PackageName): Option.Option<PublishReadinessProfile> =>
  packageProfile(packageName)

/**
 * Loads one package manifest for root release-framework checks.
 *
 * @since 0.0.0
 * @category queries
 */
export const loadPublishReadinessManifest = (
  filePath: string
): Effect.Effect<typeof PublishReadinessManifestSchema.Type, never, FileSystem.FileSystem> =>
  FileSystem.FileSystem.pipe(
    Effect.flatMap((fileSystem) =>
      fileSystem.readFileString(filePath).pipe(
        Effect.orDie,
        Effect.flatMap((content) => Schema.decodeUnknown(PublishReadinessManifestJson)(content).pipe(Effect.orDie))
      )
    )
  )

/**
 * Loads one optional package manifest for root release-framework checks.
 *
 * @since 0.0.0
 * @category queries
 */
export const loadOptionalPublishReadinessManifest = (
  filePath: string
): Effect.Effect<Option.Option<typeof PublishReadinessManifestSchema.Type>, never, FileSystem.FileSystem> =>
  FileSystem.FileSystem.pipe(
    Effect.flatMap((fileSystem) =>
      fileSystem.exists(filePath).pipe(
        Effect.orDie,
        Effect.flatMap((exists) =>
          exists ? loadPublishReadinessManifest(filePath).pipe(Effect.map(Option.some)) : Effect.succeed(Option.none())
        )
      )
    )
  )

/**
 * Reads one optional text file for root release-framework checks.
 *
 * @since 0.0.0
 * @category queries
 */
export const readOptionalTextFile = (
  filePath: string
): Effect.Effect<Option.Option<string>, never, FileSystem.FileSystem> =>
  FileSystem.FileSystem.pipe(
    Effect.flatMap((fileSystem) =>
      fileSystem.exists(filePath).pipe(
        Effect.orDie,
        Effect.flatMap((exists) =>
          exists
            ? fileSystem.readFileString(filePath).pipe(Effect.orDie, Effect.map(Option.some))
            : Effect.succeed(Option.none())
        )
      )
    )
  )

/**
 * Builds one packed-manifest fixture from a source package manifest.
 *
 * @since 0.0.0
 * @category constructors
 */
export const buildPackedManifestFixture = (
  rootManifest: typeof PublishReadinessManifestSchema.Type
): typeof PublishReadinessManifestSchema.Type => {
  const rootExports = Option.fromNullable(rootManifest.exports).pipe(
    Option.map((exports) => supportedRootExports(exports).rootExports),
    Option.getOrElse(() => ({}))
  )
  const packedExports = Arr.reduce(
    Rec.toEntries(rootExports),
    emptyUnknownRecord(),
    (accumulator, [subpath, target]) => ({
      ...accumulator,
      [subpath]: typeof target === "string" || target === null
        ? expectedPackedTarget(subpath, typeof target === "string" || target === null ? target : null)
        : null
    })
  )

  return {
    name: rootManifest.name,
    version: rootManifest.version,
    exports: packedExports,
    scripts: rootManifest.scripts,
    keywords: rootManifest.keywords,
    repository: rootManifest.repository,
    homepage: rootManifest.homepage
  }
}

/**
 * Evaluates root publish-readiness from one governed package profile.
 *
 * @since 0.0.0
 * @category queries
 */
export const publishReadinessReport = (input: {
  readonly profile: PublishReadinessProfile
  readonly rootManifest: typeof PublishReadinessManifestSchema.Type
  readonly packedManifest?: typeof PublishReadinessManifestSchema.Type
  readonly readmeText?: string
  readonly requirePackedManifest?: boolean
  readonly enforceMonorepoTopology?: boolean
}): PublishReadinessReport => {
  const repositoryReport = checkRepositoryMetadata(
    input.profile,
    input.rootManifest,
    input.enforceMonorepoTopology === true
  )
  const rootExportReport = checkRootExportContract(input.profile, input.rootManifest)
  const packedExportReport = checkPackedExportContract(
    input.profile,
    input.rootManifest,
    Option.fromNullable(input.packedManifest),
    input.requirePackedManifest === true
  )
  const keywordReport = checkKeywordCoverage(input.profile, input.rootManifest)
  const scriptReport = checkScriptWiring(input.profile, input.rootManifest)
  const docsReport = checkReleaseDocs(input.profile, Option.fromNullable(input.readmeText))

  return new PublishReadinessReport({
    profile: input.profile,
    errors: dedupeIssues([
      ...repositoryReport.errors,
      ...rootExportReport.errors,
      ...packedExportReport.errors,
      ...keywordReport.errors,
      ...scriptReport.errors,
      ...docsReport.errors
    ]),
    todos: dedupeIssues([
      ...repositoryReport.todos,
      ...rootExportReport.todos,
      ...packedExportReport.todos,
      ...keywordReport.todos,
      ...scriptReport.todos,
      ...docsReport.todos
    ])
  })
}

const readFlagValue = (argv: ReadonlyArray<string>, flag: string): Option.Option<string> =>
  Arr.findFirst(argv, (argument) => argument.startsWith(`${flag}=`)).pipe(
    Option.map((argument) => argument.slice(flag.length + 1))
  )

/**
 * Parses root publish-readiness CLI flags.
 *
 * @since 0.0.0
 * @category constructors
 */
export const parsePublishReadinessCliFlags = (
  argv: ReadonlyArray<string>
): PublishReadinessCliFlags =>
  new PublishReadinessCliFlags({
    packageName: readFlagValue(argv, "--package"),
    packageRoot: readFlagValue(argv, "--package-root"),
    rootManifestPath: readFlagValue(argv, "--root-manifest"),
    packedManifestPath: readFlagValue(argv, "--packed-manifest"),
    readmePath: readFlagValue(argv, "--readme"),
    requirePackedManifest: argv.includes("--require-packed-manifest"),
    enforceMonorepoTopology: argv.includes("--enforce-monorepo-topology")
  })

const printIssues = (
  label: string,
  issues: ReadonlyArray<PublishReadinessIssue>
): Effect.Effect<void> =>
  issues.length === 0
    ? Effect.void
    : Effect.gen(function*() {
      yield* Console.error(`[publish:check] ${label}`)
      yield* Effect.forEach(
        issues,
        (currentIssue) => Console.error(`- [${currentIssue.code}] ${currentIssue.message}`),
        {
          discard: true
        }
      )
    })

/**
 * Runs the root publish-readiness CLI from repository-owned authority.
 *
 * @since 0.0.0
 * @category constructors
 */
export const runPublishReadinessCli = (
  argv: ReadonlyArray<string>
): Effect.Effect<void, PublishReadinessCliError, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function*() {
    const path = yield* Path.Path
    const cwd = yield* Effect.sync(() => process.cwd())
    const flags = parsePublishReadinessCliFlags(argv)
    const packageRoot = Option.match(flags.packageRoot, {
      onNone: () => path.resolve(cwd, "."),
      onSome: (packageRootValue) => path.resolve(cwd, packageRootValue)
    })
    const rootManifestPath = Option.match(flags.rootManifestPath, {
      onNone: () => path.join(packageRoot, "package.json"),
      onSome: (rootManifestValue) => path.resolve(cwd, rootManifestValue)
    })
    const rootManifest = yield* loadPublishReadinessManifest(rootManifestPath)
    const profileName = yield* Option.match(flags.packageName, {
      onNone: () => Effect.succeed(rootManifest.name),
      onSome: (value) =>
        Option.match(packageNameOption(value), {
          onNone: () =>
            Effect.fail(
              new PublishReadinessCliError({
                message: `invalid package identifier: ${value}`
              })
            ),
          onSome: Effect.succeed
        })
    })
    const profile = yield* Option.match(packageProfile(profileName), {
      onNone: () =>
        Effect.fail(
          new PublishReadinessCliError({
            message: `no root publish-readiness profile exists for ${profileName}; governed packages: ${
              TheoriaReleaseFrameworkAuthority.governedPackages.map((currentProfile) => currentProfile.packageName)
                .join(", ")
            }`
          })
        ),
      onSome: Effect.succeed
    })

    const packedManifestPath = Option.match(flags.packedManifestPath, {
      onNone: () => path.join(packageRoot, "dist/package.json"),
      onSome: (packedManifestValue) => path.resolve(cwd, packedManifestValue)
    })
    const readmePath = Option.match(flags.readmePath, {
      onNone: () => path.join(packageRoot, "README.md"),
      onSome: (readmeValue) => path.resolve(cwd, readmeValue)
    })
    const packedManifest = flags.requirePackedManifest || Option.isSome(flags.packedManifestPath)
      ? yield* loadOptionalPublishReadinessManifest(packedManifestPath)
      : Option.none<typeof PublishReadinessManifestSchema.Type>()
    const readmeText = yield* readOptionalTextFile(readmePath)
    const report = publishReadinessReport({
      profile,
      rootManifest,
      ...(Option.isSome(packedManifest) ? { packedManifest: packedManifest.value } : {}),
      ...(Option.isSome(readmeText) ? { readmeText: readmeText.value } : {}),
      requirePackedManifest: flags.requirePackedManifest,
      enforceMonorepoTopology: flags.enforceMonorepoTopology
    })

    yield* printIssues("contract failures", report.errors)

    if (report.todos.length > 0) {
      yield* printIssues("deferred TODOs", report.todos)
    }

    if (report.errors.length > 0) {
      return yield* Effect.fail(
        new PublishReadinessCliError({
          message: `publish-readiness contracts failed for ${profile.packageName}`
        })
      )
    }

    yield* Console.log(`[publish:check] ${profile.packageName} passed root release-framework publish-readiness checks`)
  })
