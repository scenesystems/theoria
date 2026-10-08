# sign

- Suite modules own suite-specific operations/models. `Signature` owns signature
  carriers; `KeyPair` owns common keys; `Verification` owns strict admission and
  resource policy. Keep Noble types private; hashing comes from `digest`.
- Output-determining randomness comes from `Entropy.Entropy`; provide
  `Entropy.layer` at host boundaries. Do not add entropy requirements to
  deterministic operations or remove Noble's independent scalar blinding.
  Caller-hedged ML-DSA-65 takes explicit context and 32 fresh entropy bytes.
- Preserve canonical encodings, context binding, input snapshots, and distinct
  failure channels. The strict verifier's 8,192-byte message limit is resource
  policy, not a cryptographic standard. Strict errors retain no key/message
  material; other diagnostics need an explicit disclosure policy.
- Signature carriers do not establish identity. Authenticate keys and framing at
  the protocol layer. X25519/X-Wing raw secrets require a protocol-specific KDF.
  Noble audits do not cover Theoria's custom RSA composition.
- Use independent RFC/ACVP/Wycheproof/OpenSSL vectors and boundary tests; round
  trips alone are not conformance. Load `maintaining-fixtures` for corpus changes.
- In addition to affected behavioral tests, run `bun run fixtures:check` here;
  after building, `bun run test:packed` checks public consumption in Bun/workerd.
  Breaking pre-1.0 API changes need a minor Changeset and consumer migration.
