/**
 * Governance contract tests.
 *
 * Verifies:
 * - Export map blocks internal/* from consumers
 * - Package exports match declared entrypoints (. and ./schema)
 * - No @noble/hashes types leak through public surface
 * - Core entrypoint has zero Effect imports
 * - Schema entrypoint requires Effect peer dependency
 */
