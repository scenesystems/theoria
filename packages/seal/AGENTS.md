# seal

- `Cipher` owns algorithms, keys, failures, the backend service, and operations.
  `Envelope` owns transport encoding; `Cipher.Encrypted` keeps nonce and ciphertext
  separate. Codec validation does not establish authenticity.
- Preserve the `Cipher.Cipher` requirement through library operations. Provide
  `Cipher.layer` at host boundaries, not as a hidden default backend.
- Keep backend types private. Check nonce and tag lengths before authentication.
- All supported algorithms use 32-byte keys. Rejecting all-zero keys is Theoria
  policy, not an AEAD standard. Do not add caller-supplied production nonces.
- Schema does not copy byte buffers. Keep inputs stable and preserve exclusive
  ownership of fresh entropy buffers, including in test providers.
- Test against independent vectors and failure boundaries, not round trips alone.
  Deterministic entropy providers are test-only; production uses the host CSPRNG.
