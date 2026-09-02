/**
 * The demo's pipeline, condensed from `server/imagined-place/*.ts` and
 * `contracts/demo/imagined-place-*.ts` for the home page. It is prose for
 * readers, kept in step with the real code by the tests in
 * `test/server/imagined-place*.test.ts`.
 */
export const placePipelineExcerpt = `// Imagine — effect-dsp, effect-inference
const composer = yield* Module.predict("theoria-place-composer", composerSignature)
const composition = yield* composer.forward({ brief })   // schema-checked output

// Identity — digest: version 1 is the BLAKE3 digest of its content
const originId = yield* digestSchemaValue(PlaceArtifact, origin, "blake3-256")

// Propose — each proposal has its own ID and its proposer's signature (sign)
const proposalId = yield* digestSchemaValue(Proposal, proposal, "blake3-256")
const signature = yield* ed25519Sign(proposer.secretKey, utf8ToBytes(proposalId))

// A private note travels sealed — sign (X25519), digest (HKDF), seal
const shared = yield* deriveSharedSecret("x25519", neighbor.secretKey, author.publicKey)
const key = yield* hkdfSha256(shared.sharedSecret, Option.none(), context, 32)
const envelope = yield* seal("xchacha20-poly1305", key, utf8ToBytes(note))

// Merge — version 2 names version 1 as its parent, so the chain is the lineage
const merged = { ...origin, parent: originId, accepted }
const mergedId = yield* digestSchemaValue(PlaceArtifact, merged, "blake3-256")

// Render — effect-text, effect-math, effect-search: never part of any ID
const prepared = yield* Text.prepareWithSegments(descriptionInput(merged))
const best = yield* Study.minimize({
  space: meanderSpace,                      // six numbers describe the layout
  sampler: Sampler.tpe({ seed: 42 }),
  objective: (meander) => Effect.succeed(arrange(prepared, stage)(meander).quality.loss),
  trials: 36
})`
