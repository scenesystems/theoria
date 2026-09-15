/**
 * Producer-supplied ancestry and integrity metadata for artifact envelopes.
 *
 * @since 0.1.0
 */
import * as Artifacts from "@scenesystems/effect-study/Artifacts"
import { Schema } from "effect"

import { SourceRef } from "./identity.js"

const SearchArtifactLineage = Artifacts.makeLineageSchema(SourceRef)

/**
 * Records an artifact's declared source, identity, emission time, and optional parents.
 *
 * @remarks
 * `derivedFrom` preserves parent order and may contain duplicates. `integrity` records
 * an algorithm-tagged digest. Decoding does not verify that digest, authenticate the
 * producer, or validate ancestry as an acyclic graph.
 *
 * @since 0.1.0
 * @category models
 */
export class ArtifactLineage extends Schema.Class<ArtifactLineage>("ArtifactLineage")(
  SearchArtifactLineage.fields
) {}
