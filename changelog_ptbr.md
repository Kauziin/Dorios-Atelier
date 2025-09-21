# Notas de Atualização

## [Unreleased]

Este changelog documenta as principais adições visíveis no workspace e como elas aparecem in‑game. As entradas abaixo descrevem os blocos (nomes amigáveis) e, ao final, a lista consolidada dos identificadores técnicos incluídos.

### Visão Geral
- Novas variantes de blocos foram adicionadas para várias matérias‑primas, com versões “Bricks”, “Tiles”, “Chiseled”, “Cracked” e “Smooth” quando aplicável.
- Novos itens e receitas de desfabricação também foram incluídos.

### Blocos
Cada bloco listado é apresentado com as variantes disponibilizadas in‑game:

    - Andesito
        - Bricks, Tiles, Chiseled, Chiseled Bricks, Cracked Bricks, Cracked Tiles, Smooth

    - Basalto
        - Bricks, Tiles, Chiseled, Chiseled Bricks, Cracked Bricks, Cracked Tiles, Smooth

    - Basalto (Polido)
        - Bricks, Tiles, Chiseled, Chiseled Bricks, Cracked Bricks, Cracked Tiles

    - Blackstone (Polido)
        - Tiles, Chiseled Bricks, Cracked Tiles, Smooth

    - Calcita
        - Bricks, Tiles, Chiseled, Chiseled Bricks, Cracked Bricks, Cracked Tiles

    - Diorito
        - Bricks, Tiles, Chiseled, Chiseled Bricks, Cracked Bricks, Cracked Tiles, Smooth
    
    - Bloco de Espeleotema
        - Chiseled, Chiseled Bricks, Cracked Bricks, Cracked Tiles

    - Granito
        - Bricks, Tiles, Chiseled, Chiseled Bricks, Cracked Bricks, Cracked Tiles, Smooth

    - Tufo
        - Cracked Bricks, Cracked Tiles, Smooth

- Adicionado Bloco de Carvão Vegetal

### Adicionado — Receitas de Desfabricação
- Carrinho de Mina com Baú
- Carrinho de Mina com Funil
- Carrinho de Mina com TNT
- Conversão: Pistão Grudento → Normal

---

### Alterações Técnicas
Lista consolidada de arquivos/identificadores adicionados ao workspace, agrupados por matéria‑prima.

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

- Itens:
    - `charcoal_block.json`

- Receitas de Desfabricação:
    - `minecart_w_chest.json`, `minecart_w_hopper.json`, `minecart_w_tnt.json`, `sticky_to_normal.json`

---

Este changelog será atualizado conforme novas alterações; a seção "Alterações Técnicas" reúne os identificadores técnicos para facilitar auditoria e revisão do workspace.
