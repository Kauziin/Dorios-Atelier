# BlocksWithTraits compatibility snapshot

These files are a byte-for-byte snapshot of the reference block, geometry, and culling definitions used by BlocksWithTraits. The Atelier generator changes only the block identifier, menu placement, texture identifiers, namespace-owned culling identifiers, and material-specific destruction/light metadata.

Structural traits, permutation conditions, geometry bones, cube UVs, collision/selection behavior, support rules, liquid handling, item visuals, and partial-block redstone behavior remain inherited from this snapshot.

Run `npm run content:traits:apply` after deliberately updating this snapshot, then run `npm run content:generated:check` and `npm test`.
