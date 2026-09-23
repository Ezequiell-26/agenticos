# Legacy layout preservation

The previous `crates/interface/desktop/agenticos.db` file was a tracked SQLite artifact located inside a duplicate desktop tree. The duplicate source tree has been removed, but this binary is preserved byte-for-byte under `reference/legacy/interface-desktop/agenticos.db` so cleanup does not silently discard existing project data.

This is a preservation snapshot, not an active runtime database. New runtime state must use the canonical desktop/application storage path and must not recreate the deleted `crates/interface` tree.
