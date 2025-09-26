# Changelog

Releases:\
none

Planned:\
[Chiselling Update 1.0](#)

# Chiselling Update
v1.0

This changelog documents the main additions visible in the game.
### Overview
- New block variants were added for several types of stones.
- New items and uncrafting recipes were added.

### Blocks
- Each block in this list received the following variants:

    - Andesite
        - Bricks, Tiles, Chiseled, Chiseled Bricks, Cracked Bricks, Cracked Tiles, Smooth

    - Basalt
        - Bricks, Tiles, Chiseled, Chiseled Bricks, Cracked Bricks, Cracked Tiles, Smooth

    - Basalt (Polished)
        - Bricks, Tiles, Chiseled, Chiseled Bricks, Cracked Bricks, Cracked Tiles

    - Blackstone (Polished)
        - Tiles, Chiseled Bricks, Cracked Tiles, Smooth

    - Calcite
        - Bricks, Tiles, Chiseled, Chiseled Bricks, Cracked Bricks, Cracked Tiles

    - Diorite
        - Bricks, Tiles, Chiseled, Chiseled Bricks, Cracked Bricks, Cracked Tiles, Smooth

    - Dripstone Block
        - Chiseled, Chiseled Bricks, Cracked Bricks, Cracked Tiles

    - Granite
        - Bricks, Tiles, Chiseled, Chiseled Bricks, Cracked Bricks, Cracked Tiles, Smooth

    - Tuff
        - Cracked Bricks, Cracked Tiles, Smooth

- Added Charcoal Block

### Recipes
- Uncrafting:
 - Minecart with Chest
 - Minecart with Hopper
 - Minecart with TNT
 - Sticky Piston
> [!NOTE] 
> _The slime ball is lost in the process_.

---

### Technical Changes
Consolidated list of files/identifiers added to the workspace, grouped by base material.

- Andesite:
    - `andesite_bricks.json`, `andesite_tiles.json`, `chiseled_andesite.json`, `chiseled_andesite_bricks.json`, `cracked_andesite_bricks.json`, `cracked_andesite_tiles.json`, `smooth_andesite.json`

- Basalt / Polished Basalt:
    - `basalt_bricks.json`, `basalt_tiles.json`, `chiseled_basalt.json`, `chiseled_basalt_bricks.json`, `cracked_basalt_bricks.json`, `cracked_basalt_tiles.json`, `smooth_basalt.json`
    - `polished_basalt_bricks.json`, `polished_basalt_tiles.json`, `chiseled_polished_basalt.json`, `chiseled_polished_basalt_bricks.json`, `chiseled_polished_basalt_tiles.json`, `cracked_polished_basalt_bricks.json`, `cracked_polished_basalt_tiles.json`, `smooth_polished_basalt.json`

- Blackstone:
    - `blackstone_bricks.json`, `blackstone_tiles.json`, `chiseled_blackstone.json`, `chiseled_blackstone_bricks.json`, `cracked_blackstone_bricks.json`, `cracked_blackstone_tiles.json`, `smooth_blackstone.json`

- Calcite:
    - `calcite_bricks.json`, `calcite_tiles.json`, `chiseled_calcite.json`, `chiseled_calcite_bricks.json`, `cracked_calcite_bricks.json`, `cracked_calcite_tiles.json`, `smooth_calcite.json`

- Diorite:
    - `diorite_bricks.json`, `diorite_tiles.json`, `chiseled_diorite.json`, `chiseled_diorite_bricks.json`, `cracked_diorite_bricks.json`, `cracked_diorite_tiles.json`, `smooth_diorite.json`

- Dripstone Block:
    - `dripstone_block_bricks.json`, `dripstone_block_tiles.json`, `chiseled_dripstone_block.json`, `chiseled_dripstone_block_bricks.json`, `cracked_dripstone_block_bricks.json`, `cracked_dripstone_block_tiles.json`, `smooth_dripstone_block.json`

- Granite:
    - `granite_bricks.json`, `granite_tiles.json`, `chiseled_granite.json`, `chiseled_granite_bricks.json`, `cracked_granite_bricks.json`, `cracked_granite_tiles.json`, `smooth_granite.json`

- Tuff:
    - `tuff_bricks.json`, `tuff_tiles.json`, `chiseled_tuff.json`, `chiseled_tuff_bricks.json`, `cracked_tuff_bricks.json`, `cracked_tuff_tiles.json`, `smooth_tuff.json`

- Items:
    - `charcoal_block.json`

- Uncrafting Recipes:
    - `minecart_w_chest.json`, `minecart_w_hopper.json`, `minecart_w_tnt.json`, `sticky_to_normal.json`

---

This changelog will be updated as new changes are made; the "Technical Changes" section collects the technical identifiers to facilitate auditing and reviewing the workspace.
