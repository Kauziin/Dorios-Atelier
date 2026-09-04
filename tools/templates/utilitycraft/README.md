# UtilityCraft compatibility snapshot

`glass_culling.json` and `glass.geo.json` reproduce the coupled culling rule and geometry from the supplied UtilityCraft 1.26.45 development pack. The generator changes only their identifiers to the Atelier namespace.

The culling rule addresses cube `0` in bone `block`, so the custom geometry is required; using the rule with `minecraft:geometry.full_block` does not expose the referenced geometry part reliably.
