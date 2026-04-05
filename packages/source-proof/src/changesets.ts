import { FileSystem, Path } from "@effect/platform"
import { Array as Arr, Effect, Match, Option } from "effect"
import * as Tuple from "effect/Tuple"

import { packageNameOption, releaseVersionFromString } from "./identifiers.js"
import type { PackageName, ReleaseVersion } from "./identifiers.js"

export type ReleaseBump = "patch" | "minor" | "major"

const BUMP_RANK: Readonly<Record<ReleaseBump, number>> = {
  patch: 1,
  minor: 2,
  major: 3
}

const decodeReleaseBump = (value: string): Option.Option<ReleaseBump> =>
  Match.value(value).pipe(
    Match.when("patch", () => Option.some<ReleaseBump>("patch")),
    Match.when("minor", () => Option.some<ReleaseBump>("minor")),
    Match.when("major", () => Option.some<ReleaseBump>("major")),
    Match.orElse(() => Option.none<ReleaseBump>())
  )

const parseChangesetFrontmatter = (content: string): ReadonlyArray<readonly [PackageName, ReleaseBump]> => {
  return Option.fromNullable(content.match(/^---\n([\s\S]*?)\n---/)).pipe(
    Option.flatMap((match) => Option.fromNullable(match[1])),
    Option.match({
      onNone: () => [],
      onSome: (frontmatter) =>
        frontmatter.split("\n").flatMap((line) =>
          Option.fromNullable(line.match(/^\s*"([^"]+)"\s*:\s*(patch|minor|major)\s*$/)).pipe(
            Option.flatMap((entry) =>
              Option.all({
                packageName: Option.fromNullable(entry[1]).pipe(Option.flatMap(packageNameOption)),
                releaseBump: Option.fromNullable(entry[2]).pipe(Option.flatMap(decodeReleaseBump))
              })
            ),
            Option.match({
              onNone: () => [],
              onSome: ({ packageName, releaseBump }) => [Tuple.make(packageName, releaseBump)]
            })
          )
        )
    })
  )
}

const highestBump = (
  current: Option.Option<ReleaseBump>,
  next: ReleaseBump
): Option.Option<ReleaseBump> =>
  Option.match(current, {
    onNone: () => Option.some(next),
    onSome: (value) => Option.some(BUMP_RANK[next] > BUMP_RANK[value] ? next : value)
  })

const applyReleaseBump = (version: ReleaseVersion, bump: ReleaseBump): ReleaseVersion => {
  const [majorRaw = "0", minorRaw = "0", patchRaw = "0"] = version.split(".")
  const major = Number.parseInt(majorRaw, 10)
  const minor = Number.parseInt(minorRaw, 10)
  const patch = Number.parseInt(patchRaw, 10)

  return Match.value(bump).pipe(
    Match.when("patch", () => releaseVersionFromString(`${major}.${minor}.${patch + 1}`)),
    Match.when("minor", () => releaseVersionFromString(`${major}.${minor + 1}.0`)),
    Match.when("major", () => releaseVersionFromString(`${major + 1}.0.0`)),
    Match.exhaustive
  )
}

/**
 * Resolves the release-governed version for one package from pending changesets.
 *
 * When a package has pending changesets, governance should validate the public
 * surface against the version that `changeset version` will produce, not the
 * still-unreleased version currently stored in `package.json`.
 *
 * @since 0.0.0
 * @category queries
 */
export const resolveReleaseGovernedVersion = (input: {
  readonly currentVersion: ReleaseVersion
  readonly packageName: PackageName
  readonly workspaceRoot: string
}): Effect.Effect<ReleaseVersion, never, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const changesetDirectory = path.join(input.workspaceRoot, ".changeset")
    const changesetConfig = path.join(changesetDirectory, "config.json")
    const hasChangesets = yield* fileSystem.exists(changesetConfig).pipe(Effect.orDie)

    if (!hasChangesets) {
      return input.currentVersion
    }

    const files = Arr.fromIterable(
      yield* fileSystem.readDirectory(changesetDirectory).pipe(Effect.orDie)
    )

    const markdownFiles = Arr.filter(files, (file) => file.endsWith(".md"))
    const contents = yield* Effect.forEach(markdownFiles, (file) =>
      fileSystem.readFileString(path.join(changesetDirectory, file)).pipe(Effect.orDie))

    const bump = Arr.reduce(
      contents
        .flatMap(parseChangesetFrontmatter)
        .filter(([packageName]) =>
          packageName === input.packageName
        ),
      Option.none<ReleaseBump>(),
      (current, [, next]) => highestBump(current, next)
    )

    return Option.match(bump, {
      onNone: () => input.currentVersion,
      onSome: (value) => applyReleaseBump(input.currentVersion, value)
    })
  })

/**
 * Applies the highest pending changeset bump to a package version.
 *
 * @since 0.0.0
 * @category constructors
 */
export const releaseGovernedVersion = (input: {
  readonly currentVersion: ReleaseVersion
  readonly packageName: PackageName
  readonly pendingReleases: ReadonlyArray<readonly [PackageName, ReleaseBump]>
}): ReleaseVersion => {
  const bump = Arr.reduce(
    Arr.filter(input.pendingReleases, ([packageName]) => packageName === input.packageName),
    Option.none<ReleaseBump>(),
    (current, [, next]) => highestBump(current, next)
  )

  return Option.match(bump, {
    onNone: () => input.currentVersion,
    onSome: (value) => applyReleaseBump(input.currentVersion, value)
  })
}
