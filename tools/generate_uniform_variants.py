from __future__ import annotations

"""
Generate slab/stairs/three-step/vertical variants for uniform-texture full blocks.

What this tool does
-------------------
1. Maps full blocks in `Data/blocks/decorative/entire_blocks` that:
   - have a string texture entry in `Assets/blocks.json` (same texture on all faces), and
   - do not yet have slab and/or stairs variants.
2. Generates missing files for:
    - block definitions (`slabs` + `stairs` + `unique_stairs` + `vertical_slabs`)
   - culling definitions (`Assets/block_culling`)
   - stonecutter recipes (`Data/recipes/stonecutter`)
3. Updates:
    - `Assets/blocks.json` (sound + texture entries for new variants)
    - `Data/item_catalog/crafting_item_catalog.json` (removes accidental vanilla slab/stairs groups and syncs custom groups)
   - `Data/scripts/stairs.js` (STAIR_IDS list)
4. Writes a mapping report to:
   - `tools/generated/uniform_variant_targets.json`

Configuration arrays
--------------------
- FORCE_INCLUDE_IDS: always include these block identifiers.
- FORCE_EXCLUDE_IDS: always exclude these block identifiers.

Examples
--------
- Default (stone-only):
  python tools/generate_uniform_variants.py

- Include non-stone blocks too:
  python tools/generate_uniform_variants.py --include-non-stone

- Only map and print (no file changes):
  python tools/generate_uniform_variants.py --dry-run
"""

import argparse
import copy
import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
BP_ROOT = ROOT / "BP"
RP_ROOT = ROOT / "RP"

FORCE_INCLUDE_IDS: list[str] = []
FORCE_EXCLUDE_IDS: list[str] = []

REPORT_PATH = ROOT / "tools/generated/uniform_variant_targets.json"

ENTIRE_BLOCKS_DIR = BP_ROOT / "blocks/decorative/entire_blocks"
SLABS_DIR = BP_ROOT / "blocks/decorative/slabs"
STAIRS_DIR = BP_ROOT / "blocks/decorative/stairs"
UNIQUE_STAIRS_DIR = BP_ROOT / "blocks/decorative/unique_stairs"
CULLING_DIR = RP_ROOT / "block_culling"
STONECUTTER_DIR = BP_ROOT / "recipes/stonecutter"

ASSETS_BLOCKS_PATH = RP_ROOT / "blocks.json"
CATALOG_PATH = BP_ROOT / "item_catalog/crafting_item_catalog.json"
STAIRS_SCRIPT_PATH = BP_ROOT / "scripts/stairs.js"

SLAB_TEMPLATE_PATH = SLABS_DIR / "andesite_tiles_slab.json"
STAIRS_TEMPLATE_PATH = STAIRS_DIR / "andesite_tiles_str.json"
THREE_STEP_STAIRS_TEMPLATE_PATH = UNIQUE_STAIRS_DIR / "andesite_tiles_tss.json"
VERTICAL_SLAB_TEMPLATE_PATH = BP_ROOT / "blocks/decorative/vertical_slabs/andesite_tiles_vslab.json"
ENTIRE_BLOCK_TEMPLATE_NAME = "andesite_bricks.json"
SLAB_CULLING_TEMPLATE_PATH = CULLING_DIR / "andesite_tiles_slab.json"
STAIRS_CULLING_TEMPLATE_PATH = CULLING_DIR / "andesite_tiles_str.json"
THREE_STEP_STAIRS_CULLING_TEMPLATE_PATH = CULLING_DIR / "andesite_tiles_tss.json"

SLAB_GROUP_NAME = "minecraft:itemGroup.name.slab"
STAIRS_GROUP_NAME = "minecraft:itemGroup.name.stairs"
VERTICAL_SLABS_GROUP_NAME = "dorios_atelier:itemGroup.name.verticalSlabs"
THREE_STEP_STAIRS_GROUP_NAME = "dorios_atelier:itemGroup.name.threeStepStairs"
STONEWORK_GROUP_NAME = "dorios_atelier:itemGroup.name.stoneBricks"

LANG_NAME_MAX_CHARS = 32
LANG_FILES: dict[str, Path] = {
    "en_US": RP_ROOT / "texts/en_US.lang",
    "pt_BR": RP_ROOT / "texts/pt_BR.lang",
    "es_MX": RP_ROOT / "texts/es_MX.lang",
}

VARIANT_SUFFIXES = (
    "three_steps_stairs",
    "vertical_slab",
    "stairs",
    "slab",
)

VARIANT_FILE_SUFFIXES = {
    "three_steps_stairs": "tss",
    "vertical_slab": "vslab",
    "stairs": "str",
    "slab": "slab",
}


def variant_filename(base_name: str, variant_suffix: str) -> str:
    return f"{base_name}_{VARIANT_FILE_SUFFIXES[variant_suffix]}.json"

MATERIAL_TOKEN_PRIORITY = (
    "blackstone",
    "deepslate",
    "prismarine",
    "cobblestone",
    "netherrack",
    "dripstone",
    "obsidian",
    "andesite",
    "granite",
    "diorite",
    "calcite",
    "basalt",
    "quartz",
    "purpur",
    "stone",
    "tuff",
    "mud",
    "nether",
)

ENTIRE_BLOCK_CATEGORY_PRIORITY: tuple[tuple[str, str], ...] = (
    ("bricks", "Bricks"),
    ("tiles", "Tiles"),
    ("pillar", "Pillars"),
    ("wood", "Woods"),
)

ENGLISH_NAME_TOKENS = (
    "Chiseled",
    "Cracked",
    "Polished",
    "Smooth",
    "Bricks",
    "Tiles",
    "Stairs",
    "Slab",
    "Pillar",
    "Deepslate",
    "Blackstone",
)

PT_WORD_MAP = {
    "andesite": "Andesito",
    "basalt": "Basalto",
    "blackstone": "Pedra-Negra",
    "calcite": "Calcita",
    "cobblestone": "Pedregulho",
    "deepslate": "Ardósia Abissal",
    "diorite": "Diorito",
    "dripstone": "Espeleotema",
    "granite": "Granito",
    "mud": "Lama",
    "netherrack": "Netherrack",
    "nether": "Nether",
    "obsidian": "Obsidiana",
    "packed": "Compactada",
    "polished": "Polido",
    "prismarine": "Prismarinho",
    "purpur": "Purpur",
    "quartz": "Quartzo",
    "red": "Vermelho",
    "sandstone": "Arenito",
    "smooth": "Liso",
    "stone": "Pedra",
    "tuff": "Tufo",
}

ES_WORD_MAP = {
    "andesite": "Andesita",
    "basalt": "Basalto",
    "blackstone": "Piedra Negra",
    "calcite": "Calcita",
    "cobblestone": "Adoquín",
    "deepslate": "Pizarra Profunda",
    "diorite": "Diorita",
    "dripstone": "Espeleotema",
    "granite": "Granito",
    "mud": "Lodo",
    "netherrack": "Netherrack",
    "nether": "Nether",
    "obsidian": "Obsidiana",
    "packed": "Compactado",
    "polished": "Pulido",
    "prismarine": "Prismarina",
    "purpur": "Purpur",
    "quartz": "Cuarzo",
    "red": "Rojo",
    "sandstone": "Arenisca",
    "smooth": "Liso",
    "stone": "Piedra",
    "tuff": "Tufo",
}

PT_BASE_OVERRIDES = {
    "cobbled_deepslate": "Pedregulho de Ardósia Abissal",
    "dark_prismarine": "Prismarinho Escuro",
    "gilded_blackstone": "Pedra-Negra Dourada",
    "packed_mud": "Lama Compactada",
}

ES_BASE_OVERRIDES = {
    "cobbled_deepslate": "Adoquín de Pizarra Profunda",
    "dark_prismarine": "Prismarina Oscura",
    "gilded_blackstone": "Piedra Negra Dorada",
    "packed_mud": "Lodo Compactado",
}


@dataclass
class TargetBlock:
    identifier: str
    base_name: str
    texture: str
    sound: str
    is_stone: bool
    has_slab: bool
    has_stairs: bool
    has_three_steps_stairs: bool
    has_vertical_slab: bool
    source_components: dict[str, Any]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate slab/stairs/three-step/vertical variants for uniform-texture blocks.")
    parser.add_argument(
        "--include-non-stone",
        action="store_true",
        help="Also generate for non-stone blocks (default maps stone-tagged blocks only).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Only map and report targets, without writing files.",
    )
    parser.add_argument(
        "--import-vanilla-compatible",
        action="store_true",
        help="Import compatible vanilla decorative blocks from a vanilla blocks.json before generating variants.",
    )
    parser.add_argument(
        "--vanilla-blocks-json",
        type=Path,
        default=None,
        help="Path to vanilla resource_pack blocks.json used for texture/sound lookup.",
    )
    parser.add_argument(
        "--vanilla-list",
        type=Path,
        default=ROOT / "tools/vanilla_blocks_list.md",
        help="Path to markdown file containing minecraft:<block_id> entries.",
    )
    return parser.parse_args()


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=4) + "\n", encoding="utf-8")


def extract_vanilla_ids_from_markdown(markdown_text: str) -> list[str]:
    matches = re.findall(r"minecraft:[a-z0-9_]+", markdown_text)
    return sorted(set(matches))


def load_vanilla_base_names(vanilla_list_path: Path) -> set[str]:
    if not vanilla_list_path.exists():
        raise FileNotFoundError(f"Vanilla block list not found: {vanilla_list_path}")
    markdown_text = vanilla_list_path.read_text(encoding="utf-8")
    return {identifier.split(":", 1)[1] for identifier in extract_vanilla_ids_from_markdown(markdown_text)}


def load_vanilla_pt_name_map(vanilla_list_path: Path) -> dict[str, str]:
    if not vanilla_list_path.exists():
        return {}

    text = vanilla_list_path.read_text(encoding="utf-8")
    mappings: dict[str, str] = {}
    for match in re.finditer(r"-\s*`minecraft:([a-z0-9_]+)`:\s*(.+)", text):
        mappings[match.group(1)] = match.group(2).strip()
    return mappings


def collect_variant_base_names() -> set[str]:
    suffixes = tuple(f"_{suffix}" for suffix in VARIANT_FILE_SUFFIXES.values())
    variant_directories = (SLABS_DIR, STAIRS_DIR, UNIQUE_STAIRS_DIR, BP_ROOT / "blocks/decorative/vertical_slabs")

    names: set[str] = set()
    for directory in variant_directories:
        for path in sorted(directory.glob("*.json")):
            stem = path.stem
            for suffix in suffixes:
                if stem.endswith(suffix):
                    names.add(stem[: -len(suffix)])
                    break
    return names


def resolve_texture_key_for_base(base_name: str, assets_data: dict[str, Any]) -> str | None:
    candidates = (
        f"dorios_atelier:{base_name}",
        f"dorios_atelier:{base_name}_slab",
        f"dorios_atelier:{base_name}_stairs",
        f"dorios_atelier:{base_name}_three_steps_stairs",
        f"dorios_atelier:{base_name}_vertical_slab",
    )

    for candidate in candidates:
        entry = assets_data.get(candidate)
        if not isinstance(entry, dict):
            continue
        texture_key = entry.get("textures")
        if isinstance(texture_key, str):
            return texture_key
    return None


def texture_key_has_local_file(texture_key: str, terrain_texture_data: dict[str, Any]) -> bool:
    entry = terrain_texture_data.get(texture_key)
    if not isinstance(entry, dict):
        return False

    textures = entry.get("textures")
    if isinstance(textures, str):
        path = textures
    elif isinstance(textures, list) and textures and isinstance(textures[0], str):
        path = textures[0]
    else:
        return False

    return (ROOT / "Assets" / f"{path}.png").exists() or (ROOT / "Assets" / f"{path}.tga").exists()


def detect_vanilla_bases_with_local_textures(vanilla_base_names: set[str]) -> set[str]:
    assets_data = read_json(ASSETS_BLOCKS_PATH)
    terrain_texture_data = read_json(RP_ROOT / "textures/terrain_texture.json").get("texture_data", {})
    variant_bases = collect_variant_base_names()

    kept: set[str] = set()
    for base_name in sorted(vanilla_base_names):
        if base_name not in variant_bases:
            continue
        texture_key = resolve_texture_key_for_base(base_name, assets_data)
        if texture_key and texture_key_has_local_file(texture_key, terrain_texture_data):
            kept.add(base_name)
    return kept


def contains_english_tokens(label: str) -> bool:
    return any(token in label for token in ENGLISH_NAME_TOKENS)


def translate_material_words(words: list[str], language: str) -> str:
    word_map = PT_WORD_MAP if language == "pt_BR" else ES_WORD_MAP if language == "es_MX" else {}
    translated = [word_map.get(word, word.capitalize()) for word in words]
    return " ".join(translated).strip()


def localize_base_name(base_name: str, language: str, vanilla_pt_name_map: dict[str, str]) -> str:
    if language == "en_US":
        return humanize_identifier(base_name)

    if language == "pt_BR" and base_name in vanilla_pt_name_map:
        return vanilla_pt_name_map[base_name]

    if language == "pt_BR" and base_name in PT_BASE_OVERRIDES:
        return PT_BASE_OVERRIDES[base_name]

    if language == "es_MX" and base_name in ES_BASE_OVERRIDES:
        return ES_BASE_OVERRIDES[base_name]

    words = base_name.split("_")
    is_plural = False

    block_form = None
    if words and words[-1] in {"bricks", "tiles", "pillar"}:
        block_form = words.pop()
        is_plural = block_form in {"bricks", "tiles"}

    modifiers: list[str] = []
    while words and words[0] in {"chiseled", "cracked", "polished", "smooth", "mossy"}:
        modifiers.append(words.pop(0))

    material_text = translate_material_words(words, language)

    if language == "pt_BR":
        if block_form == "bricks":
            label = f"Tijolos de {material_text}" if material_text else "Tijolos"
        elif block_form == "tiles":
            label = f"Ladrilhos de {material_text}" if material_text else "Ladrilhos"
        elif block_form == "pillar":
            label = f"Pilar de {material_text}" if material_text else "Pilar"
        else:
            label = material_text

        modifier_map = {
            "chiseled": "Talhados" if is_plural else "Talhado",
            "cracked": "Rachados" if is_plural else "Rachado",
            "polished": "Polidos" if is_plural else "Polido",
            "smooth": "Lisos" if is_plural else "Liso",
            "mossy": "Musgosos" if is_plural else "Musgoso",
        }
    else:
        if block_form == "bricks":
            label = f"Ladrillos de {material_text}" if material_text else "Ladrillos"
        elif block_form == "tiles":
            label = f"Losetas de {material_text}" if material_text else "Losetas"
        elif block_form == "pillar":
            label = f"Pilar de {material_text}" if material_text else "Pilar"
        else:
            label = material_text

        modifier_map = {
            "chiseled": "Cincelados" if is_plural else "Cincelado",
            "cracked": "Agrietados" if is_plural else "Agrietado",
            "polished": "Pulidos" if is_plural else "Pulido",
            "smooth": "Lisos" if is_plural else "Liso",
            "mossy": "Musgosos" if is_plural else "Musgoso",
        }

    for modifier in modifiers:
        suffix = modifier_map.get(modifier)
        if suffix:
            label = f"{label} {suffix}".strip()

    return label


def localize_block_name_from_identifier(
    block_name: str,
    language: str,
    existing_names: dict[str, str],
    vanilla_pt_name_map: dict[str, str],
) -> str:
    parsed_variant = split_variant_item_name(block_name)
    if parsed_variant is None:
        return localize_base_name(block_name, language, vanilla_pt_name_map)

    base_name, variant_suffix = parsed_variant
    base_label = existing_names.get(base_name)
    if base_label is None or (language in {"pt_BR", "es_MX"} and contains_english_tokens(base_label)):
        base_label = localize_base_name(base_name, language, vanilla_pt_name_map)

    return format_variant_label(base_label, variant_suffix, language)


def iter_entire_block_files() -> list[Path]:
    return sorted(ENTIRE_BLOCKS_DIR.rglob("*.json"))


def determine_entire_block_category(base_name: str) -> str:
    for marker, category in ENTIRE_BLOCK_CATEGORY_PRIORITY:
        if marker in base_name:
            return category
    if base_name.startswith("chiseled_"):
        return "Chiseled"
    if base_name.startswith("cracked_"):
        return "Cracked"
    if base_name.startswith("polished_"):
        return "Polished"
    if base_name.startswith("smooth_"):
        return "Smooth"
    return "Base"


def build_entire_block_target_path(base_name: str) -> Path:
    category = determine_entire_block_category(base_name)
    return ENTIRE_BLOCKS_DIR / category / f"{base_name}.json"


def resolve_entire_block_template_path() -> Path:
    for candidate in iter_entire_block_files():
        if candidate.name == ENTIRE_BLOCK_TEMPLATE_NAME:
            return candidate
    raise FileNotFoundError(f"Template block not found recursively: {ENTIRE_BLOCK_TEMPLATE_NAME}")


def remove_vanilla_entire_blocks(vanilla_base_names: set[str], dry_run: bool) -> int:
    removed = 0
    for block_path in iter_entire_block_files():
        payload = read_json(block_path)
        identifier = payload.get("minecraft:block", {}).get("description", {}).get("identifier")
        if not isinstance(identifier, str) or not identifier.startswith("dorios_atelier:"):
            continue

        base_name = identifier.split(":", 1)[1]
        if base_name not in vanilla_base_names:
            continue

        if not dry_run:
            block_path.unlink()
        removed += 1
    return removed


def ensure_vanilla_entire_blocks_exist(base_names: set[str], dry_run: bool) -> int:
    if not base_names:
        return 0

    template = read_json(resolve_entire_block_template_path())
    assets_data = read_json(ASSETS_BLOCKS_PATH)
    existing_names = {path.stem for path in iter_entire_block_files()}

    created = 0
    for base_name in sorted(base_names):
        if base_name in existing_names:
            continue

        texture_key = resolve_texture_key_for_base(base_name, assets_data)
        if texture_key is None:
            continue

        payload = build_entire_block_from_template(
            template=template,
            identifier=f"dorios_atelier:{base_name}",
            texture=texture_key,
        )
        target_path = build_entire_block_target_path(base_name)
        if not dry_run:
            write_json(target_path, payload)
        existing_names.add(base_name)
        created += 1

    return created


def organize_entire_blocks_by_category(dry_run: bool) -> int:
    moved = 0
    for block_path in iter_entire_block_files():
        target_path = build_entire_block_target_path(block_path.stem)
        if block_path == target_path:
            continue

        if not dry_run:
            target_path.parent.mkdir(parents=True, exist_ok=True)
            if target_path.exists() and target_path != block_path:
                target_path.unlink()
            block_path.replace(target_path)
        moved += 1

    if not dry_run:
        for directory in sorted([path for path in ENTIRE_BLOCKS_DIR.rglob("*") if path.is_dir()], reverse=True):
            if directory == ENTIRE_BLOCKS_DIR:
                continue
            try:
                directory.rmdir()
            except OSError:
                pass

    return moved


def rewrite_stonecutter_recipes_to_vanilla_bases(
    migrate_to_vanilla_base_names: set[str],
    keep_utilitycraft_base_names: set[str],
    dry_run: bool,
) -> tuple[int, int]:
    rewritten_forward = 0
    rewritten_reverse = 0

    for recipe_path in sorted(STONECUTTER_DIR.glob("*.json")):
        payload = read_json(recipe_path)
        recipe = payload.get("minecraft:recipe_shapeless", {})

        if "stonecutter" not in recipe.get("tags", []):
            continue

        ingredients = recipe.get("ingredients", [])
        result = recipe.get("result", {})
        result_item = result.get("item") if isinstance(result, dict) else None
        first_ingredient = ingredients[0] if isinstance(ingredients, list) and ingredients and isinstance(ingredients[0], dict) else {}
        ingredient_item = first_ingredient.get("item")

        if not isinstance(result_item, str) or not isinstance(ingredient_item, str):
            continue

        changed = False

        parsed_result_variant = None
        if result_item.startswith("dorios_atelier:"):
            parsed_result_variant = split_variant_item_name(result_item.split(":", 1)[1])

        if parsed_result_variant is not None:
            base_name, _variant_suffix = parsed_result_variant
            if base_name in migrate_to_vanilla_base_names:
                vanilla_base_item = f"minecraft:{base_name}"
                if recipe.get("ingredients") != [{"item": vanilla_base_item}]:
                    recipe["ingredients"] = [{"item": vanilla_base_item}]
                    changed = True
                    rewritten_forward += 1
                if recipe.get("unlock") != [{"item": vanilla_base_item}]:
                    recipe["unlock"] = [{"item": vanilla_base_item}]
                    changed = True
            elif base_name in keep_utilitycraft_base_names:
                custom_base_item = f"dorios_atelier:{base_name}"
                if recipe.get("ingredients") != [{"item": custom_base_item}]:
                    recipe["ingredients"] = [{"item": custom_base_item}]
                    changed = True
                    rewritten_forward += 1
                if recipe.get("unlock") != [{"item": custom_base_item}]:
                    recipe["unlock"] = [{"item": custom_base_item}]
                    changed = True

        if ingredient_item.startswith("dorios_atelier:"):
            parsed_ingredient_variant = split_variant_item_name(ingredient_item.split(":", 1)[1])
            if parsed_ingredient_variant is not None:
                base_name, _variant_suffix = parsed_ingredient_variant
                if base_name in migrate_to_vanilla_base_names:
                    vanilla_base_item = f"minecraft:{base_name}"
                    if recipe.get("result", {}).get("item") != vanilla_base_item:
                        recipe.setdefault("result", {})["item"] = vanilla_base_item
                        changed = True
                        rewritten_reverse += 1
                elif base_name in keep_utilitycraft_base_names:
                    custom_base_item = f"dorios_atelier:{base_name}"
                    if recipe.get("result", {}).get("item") != custom_base_item:
                        recipe.setdefault("result", {})["item"] = custom_base_item
                        changed = True
                        rewritten_reverse += 1

        if changed and not dry_run:
            write_json(recipe_path, payload)

    return rewritten_forward, rewritten_reverse


def apply_vanilla_base_policy(vanilla_list_path: Path, dry_run: bool) -> dict[str, int]:
    vanilla_base_names = load_vanilla_base_names(vanilla_list_path)
    keep_utilitycraft_bases = detect_vanilla_bases_with_local_textures(vanilla_base_names)
    migrate_to_vanilla_bases = vanilla_base_names - keep_utilitycraft_bases

    removed_vanilla_entire_blocks = remove_vanilla_entire_blocks(migrate_to_vanilla_bases, dry_run)
    restored_local_vanilla_entire_blocks = ensure_vanilla_entire_blocks_exist(keep_utilitycraft_bases, dry_run)
    moved_entire_blocks = organize_entire_blocks_by_category(dry_run)
    rewritten_forward_recipes, rewritten_reverse_recipes = rewrite_stonecutter_recipes_to_vanilla_bases(
        migrate_to_vanilla_bases,
        keep_utilitycraft_bases,
        dry_run,
    )

    return {
        "removed_vanilla_entire_blocks": removed_vanilla_entire_blocks,
        "restored_local_vanilla_entire_blocks": restored_local_vanilla_entire_blocks,
        "kept_utilitycraft_vanilla_bases": len(keep_utilitycraft_bases),
        "moved_entire_blocks_to_categories": moved_entire_blocks,
        "rewritten_forward_stonecutter_recipes": rewritten_forward_recipes,
        "rewritten_reverse_stonecutter_recipes": rewritten_reverse_recipes,
    }


def build_entire_block_from_template(
    template: dict[str, Any],
    identifier: str,
    texture: str,
) -> dict[str, Any]:
    data = copy.deepcopy(template)
    block = data["minecraft:block"]
    block["description"]["identifier"] = identifier

    components = block.get("components", {})
    material_instances = components.get("minecraft:material_instances")
    if isinstance(material_instances, dict) and "*" in material_instances:
        material_instances["*"]["texture"] = texture

    return data


def import_vanilla_compatible_blocks(
    vanilla_blocks_json_path: Path,
    vanilla_list_path: Path,
    dry_run: bool,
) -> dict[str, int]:
    if not vanilla_blocks_json_path.exists():
        raise FileNotFoundError(f"Vanilla blocks.json not found: {vanilla_blocks_json_path}")
    if not vanilla_list_path.exists():
        raise FileNotFoundError(f"Vanilla block list not found: {vanilla_list_path}")

    vanilla_blocks = read_json(vanilla_blocks_json_path)
    vanilla_ids = extract_vanilla_ids_from_markdown(vanilla_list_path.read_text(encoding="utf-8"))
    entire_template = read_json(resolve_entire_block_template_path())
    assets_data = read_json(ASSETS_BLOCKS_PATH)
    existing_entire_names = {path.stem for path in iter_entire_block_files()}

    imported_entire_blocks = 0
    imported_assets_entries = 0
    skipped_missing_vanilla_entry = 0
    skipped_non_uniform_texture = 0
    skipped_already_existing = 0

    for vanilla_id in vanilla_ids:
        vanilla_name = vanilla_id.split(":", 1)[1]
        custom_id = f"dorios_atelier:{vanilla_name}"
        custom_path = build_entire_block_target_path(vanilla_name)

        vanilla_entry = vanilla_blocks.get(vanilla_name)
        if not isinstance(vanilla_entry, dict):
            skipped_missing_vanilla_entry += 1
            continue

        texture = vanilla_entry.get("textures")
        if not isinstance(texture, str):
            skipped_non_uniform_texture += 1
            continue

        if vanilla_name in existing_entire_names or custom_id in FORCE_EXCLUDE_IDS:
            skipped_already_existing += 1
        else:
            payload = build_entire_block_from_template(entire_template, custom_id, texture)
            if not dry_run:
                write_json(custom_path, payload)
            imported_entire_blocks += 1
            existing_entire_names.add(vanilla_name)

        if custom_id not in assets_data:
            assets_data[custom_id] = {
                "sound": str(vanilla_entry.get("sound", "stone")),
                "textures": texture,
            }
            imported_assets_entries += 1

    if not dry_run and imported_assets_entries:
        write_json(ASSETS_BLOCKS_PATH, assets_data)

    return {
        "vanilla_ids_in_list": len(vanilla_ids),
        "imported_entire_blocks": imported_entire_blocks,
        "imported_assets_entries": imported_assets_entries,
        "skipped_missing_vanilla_entry": skipped_missing_vanilla_entry,
        "skipped_non_uniform_texture": skipped_non_uniform_texture,
        "skipped_already_existing": skipped_already_existing,
    }


def find_targets(include_non_stone: bool) -> list[TargetBlock]:
    blocks_assets = read_json(ASSETS_BLOCKS_PATH)
    targets: list[TargetBlock] = []

    for source_path in iter_entire_block_files():
        source = read_json(source_path)
        source_block = source.get("minecraft:block", {})
        source_description = source_block.get("description", {})
        source_components = source_block.get("components", {})

        identifier = source_description.get("identifier")
        if not identifier or identifier in FORCE_EXCLUDE_IDS:
            continue

        asset_entry = blocks_assets.get(identifier)
        if not isinstance(asset_entry, dict):
            continue

        texture_value = asset_entry.get("textures")
        if isinstance(texture_value, dict):
            # Multi-face texture block: out of this tool's scope.
            continue
        if not isinstance(texture_value, str):
            continue

        is_stone = "tag:stone" in source_components
        if not is_stone and not include_non_stone and identifier not in FORCE_INCLUDE_IDS:
            continue

        base_name = identifier.split(":", 1)[1]
        slab_path = SLABS_DIR / variant_filename(base_name, "slab")
        stairs_path = STAIRS_DIR / variant_filename(base_name, "stairs")
        has_slab = slab_path.exists()
        has_stairs = stairs_path.exists()
        has_three_steps_stairs = (UNIQUE_STAIRS_DIR / variant_filename(base_name, "three_steps_stairs")).exists()
        has_vertical_slab = (BP_ROOT / "blocks/decorative/vertical_slabs" / variant_filename(base_name, "vertical_slab")).exists()

        if has_slab and has_stairs and has_three_steps_stairs and has_vertical_slab and identifier not in FORCE_INCLUDE_IDS:
            continue

        targets.append(
            TargetBlock(
                identifier=identifier,
                base_name=base_name,
                texture=texture_value,
                sound=str(asset_entry.get("sound", "stone")),
                is_stone=is_stone,
                has_slab=has_slab,
                has_stairs=has_stairs,
                has_three_steps_stairs=has_three_steps_stairs,
                has_vertical_slab=has_vertical_slab,
                source_components=source_components,
            )
        )

    return targets


def apply_source_behavior(target_components: dict[str, Any], source_components: dict[str, Any]) -> None:
    # Remove tag keys from template and re-apply tags from source.
    for key in [k for k in target_components.keys() if k.startswith("tag:")]:
        del target_components[key]

    if "minecraft:destructible_by_mining" in source_components:
        target_components["minecraft:destructible_by_mining"] = copy.deepcopy(
            source_components["minecraft:destructible_by_mining"]
        )

    for optional_key in (
        "minecraft:destructible_by_explosion",
        "minecraft:light_dampening",
        "minecraft:light_emission",
    ):
        if optional_key in source_components:
            target_components[optional_key] = copy.deepcopy(source_components[optional_key])
        elif optional_key in target_components:
            del target_components[optional_key]

    for key, value in source_components.items():
        if key.startswith("tag:"):
            target_components[key] = copy.deepcopy(value)


def generate_slab_block(template: dict[str, Any], target: TargetBlock) -> dict[str, Any]:
    data = copy.deepcopy(template)
    block = data["minecraft:block"]
    components = block["components"]

    block["description"]["identifier"] = f"dorios_atelier:{target.base_name}_slab"
    components["minecraft:geometry"]["culling"] = f"dorios_atelier:culling.{target.base_name}_slab"
    components["minecraft:material_instances"]["*"]["texture"] = target.texture

    apply_source_behavior(components, target.source_components)
    return data


def generate_stairs_block(template: dict[str, Any], target: TargetBlock) -> dict[str, Any]:
    data = copy.deepcopy(template)
    block = data["minecraft:block"]
    components = block["components"]

    block["description"]["identifier"] = f"dorios_atelier:{target.base_name}_stairs"
    components["minecraft:geometry"]["culling"] = f"dorios_atelier:culling.{target.base_name}_stairs"
    components["minecraft:material_instances"]["*"]["texture"] = target.texture

    apply_source_behavior(components, target.source_components)
    return data


def generate_three_steps_stairs_block(template: dict[str, Any], target: TargetBlock) -> dict[str, Any]:
    data = copy.deepcopy(template)
    block = data["minecraft:block"]
    components = block["components"]

    block["description"]["identifier"] = f"dorios_atelier:{target.base_name}_three_steps_stairs"
    components["minecraft:geometry"]["culling"] = f"dorios_atelier:culling.{target.base_name}_three_steps_stairs"
    components["minecraft:material_instances"]["*"]["texture"] = target.texture

    apply_source_behavior(components, target.source_components)
    return data


def generate_vertical_slab_block(template: dict[str, Any], target: TargetBlock) -> dict[str, Any]:
    data = copy.deepcopy(template)
    block = data["minecraft:block"]
    components = block["components"]

    block["description"]["identifier"] = f"dorios_atelier:{target.base_name}_vertical_slab"
    components["minecraft:material_instances"]["*"]["texture"] = target.texture

    apply_source_behavior(components, target.source_components)
    return data


def generate_slab_culling(template: dict[str, Any], base_name: str) -> dict[str, Any]:
    data = copy.deepcopy(template)
    data["minecraft:block_culling_rules"]["description"]["identifier"] = f"dorios_atelier:culling.{base_name}_slab"
    return data


def generate_stairs_culling(template: dict[str, Any], base_name: str) -> dict[str, Any]:
    data = copy.deepcopy(template)
    data["minecraft:block_culling_rules"]["description"]["identifier"] = f"dorios_atelier:culling.{base_name}_stairs"
    return data


def generate_three_steps_stairs_culling(template: dict[str, Any], base_name: str) -> dict[str, Any]:
    data = copy.deepcopy(template)
    data["minecraft:block_culling_rules"]["description"]["identifier"] = f"dorios_atelier:culling.{base_name}_three_steps_stairs"
    return data


def make_stonecutter_recipe(base_name: str, variant_suffix: str, result_count: int) -> dict[str, Any]:
    source_id = f"dorios_atelier:{base_name}"
    result_id = f"dorios_atelier:{base_name}_{variant_suffix}"
    return {
        "format_version": "1.21.100",
        "minecraft:recipe_shapeless": {
            "description": {
                "identifier": f"dorios_atelier:sc_{base_name}_{variant_suffix}_from_{base_name}"
            },
            "tags": ["stonecutter"],
            "ingredients": [{"item": source_id}],
            "result": {"item": result_id, "count": result_count},
            "unlock": [{"item": source_id}],
        },
    }


def split_variant_item_name(item_name: str) -> tuple[str, str] | None:
    for suffix in VARIANT_SUFFIXES:
        marker = f"_{suffix}"
        if item_name.endswith(marker):
            return item_name[: -len(marker)], suffix
    return None


def wrap_label_lines(label: str, max_chars: int = LANG_NAME_MAX_CHARS) -> str:
    words = [word for word in label.split() if word]
    if not words:
        return label

    lines: list[str] = []
    current_line = ""

    for word in words:
        if not current_line:
            current_line = word
            continue

        candidate = f"{current_line} {word}"
        if len(candidate) <= max_chars:
            current_line = candidate
        else:
            lines.append(current_line)
            current_line = word

    if current_line:
        lines.append(current_line)

    return "\\n".join(lines)


def humanize_identifier(identifier: str) -> str:
    words = identifier.split("_")
    return " ".join(word.capitalize() for word in words)


def format_variant_label(base_label: str, variant_suffix: str, language: str) -> str:
    if language == "pt_BR":
        templates = {
            "slab": "Laje de {base}",
            "stairs": "Escada de {base}",
            "vertical_slab": "Laje Vertical de {base}",
            "three_steps_stairs": "Escada de Três Degraus de {base}",
        }
    elif language == "es_MX":
        templates = {
            "slab": "Losa de {base}",
            "stairs": "Escalera de {base}",
            "vertical_slab": "Losa Vertical de {base}",
            "three_steps_stairs": "Escalera de Tres Peldaños de {base}",
        }
    else:
        templates = {
            "slab": "{base} Slab",
            "stairs": "{base} Stairs",
            "vertical_slab": "{base} Vertical Slab",
            "three_steps_stairs": "{base} Three-Step Stairs",
        }

    template = templates.get(variant_suffix, "{base}")
    return template.format(base=base_label)


def collect_decorative_block_identifiers() -> list[str]:
    directories = (
        ENTIRE_BLOCKS_DIR,
        SLABS_DIR,
        STAIRS_DIR,
        UNIQUE_STAIRS_DIR,
        BP_ROOT / "blocks/decorative/vertical_slabs",
    )

    identifiers: set[str] = set()
    for directory in directories:
        if directory == ENTIRE_BLOCKS_DIR:
            json_paths = iter_entire_block_files()
        else:
            json_paths = sorted(directory.glob("*.json"))
        for path in json_paths:
            payload = read_json(path)
            identifier = payload.get("minecraft:block", {}).get("description", {}).get("identifier")
            if isinstance(identifier, str) and identifier.startswith("dorios_atelier:"):
                identifiers.add(identifier)

    return sorted(identifiers)


def update_block_localization_names(dry_run: bool) -> tuple[int, int]:
    tile_line_pattern = re.compile(r"^(tile\.dorios_atelier:([a-z0-9_]+)\.name)=(.*)$")
    block_identifiers = collect_decorative_block_identifiers()
    vanilla_pt_name_map = load_vanilla_pt_name_map(ROOT / "tools/vanilla_blocks_list.md")

    updated_existing_entries = 0
    created_missing_entries = 0

    for language, lang_path in LANG_FILES.items():
        if not lang_path.exists():
            continue

        original_lines = lang_path.read_text(encoding="utf-8").splitlines()
        updated_lines: list[str] = []
        existing_names: dict[str, str] = {}

        for line in original_lines:
            match = tile_line_pattern.match(line)
            if not match:
                updated_lines.append(line)
                continue

            full_key = match.group(1)
            block_name = match.group(2)
            value = match.group(3).strip()

            normalized_value = value.replace("\\n", " ").strip()
            if language in {"pt_BR", "es_MX"} and contains_english_tokens(normalized_value):
                normalized_value = localize_block_name_from_identifier(
                    block_name=block_name,
                    language=language,
                    existing_names=existing_names,
                    vanilla_pt_name_map=vanilla_pt_name_map,
                )
            wrapped_value = wrap_label_lines(normalized_value)

            if wrapped_value != value:
                updated_existing_entries += 1

            existing_names[block_name] = normalized_value
            updated_lines.append(f"{full_key}={wrapped_value}")

        for identifier in block_identifiers:
            block_name = identifier.split(":", 1)[1]
            if block_name in existing_names:
                continue

            generated_name = localize_block_name_from_identifier(
                block_name=block_name,
                language=language,
                existing_names=existing_names,
                vanilla_pt_name_map=vanilla_pt_name_map,
            )

            wrapped_name = wrap_label_lines(generated_name)
            updated_lines.append(f"tile.dorios_atelier:{block_name}.name={wrapped_name}")
            existing_names[block_name] = generated_name
            created_missing_entries += 1

        updated_content = "\n".join(updated_lines) + "\n"
        original_content = "\n".join(original_lines) + "\n"

        if not dry_run and updated_content != original_content:
            lang_path.write_text(updated_content, encoding="utf-8")

    return updated_existing_entries, created_missing_entries


def make_reverse_stonecutter_recipe(base_item_id: str, variant_item_id: str, variant_suffix: str) -> dict[str, Any]:
    ingredient_count = 2 if variant_suffix in {"slab", "vertical_slab"} else 1
    ingredients = [{"item": variant_item_id} for _ in range(ingredient_count)]

    base_name = base_item_id.split(":", 1)[1]
    variant_name = variant_item_id.split(":", 1)[1]

    return {
        "format_version": "1.21.100",
        "minecraft:recipe_shapeless": {
            "description": {
                "identifier": f"dorios_atelier:sc_{base_name}_from_{variant_name}"
            },
            "tags": ["stonecutter"],
            "ingredients": ingredients,
            "result": {"item": base_item_id, "count": 1},
            "unlock": [{"item": variant_item_id}],
        },
    }


def create_reverse_variant_recipes(dry_run: bool) -> tuple[int, int]:
    created_reverse_recipes = 0
    skipped_non_variant_recipes = 0

    for recipe_path in sorted(STONECUTTER_DIR.glob("*.json")):
        payload = read_json(recipe_path)
        recipe = payload.get("minecraft:recipe_shapeless", {})

        tags = recipe.get("tags", [])
        if "stonecutter" not in tags:
            continue

        ingredients = recipe.get("ingredients", [])
        result = recipe.get("result", {})
        result_item = result.get("item")
        if not isinstance(result_item, str):
            continue

        if not isinstance(ingredients, list) or not ingredients:
            continue

        first_ingredient = ingredients[0] if isinstance(ingredients[0], dict) else {}
        ingredient_item = first_ingredient.get("item")
        if not isinstance(ingredient_item, str):
            continue

        if not result_item.startswith("dorios_atelier:"):
            continue

        result_name = result_item.split(":", 1)[1]
        parsed_variant = split_variant_item_name(result_name)
        if parsed_variant is None:
            skipped_non_variant_recipes += 1
            continue

        base_name, variant_suffix = parsed_variant
        if ingredient_item == f"minecraft:{base_name}":
            base_item_id = f"minecraft:{base_name}"
        else:
            base_item_id = f"dorios_atelier:{base_name}"
        variant_item_id = result_item

        reverse_file_name = f"{base_name}_from_{result_name}.json"
        reverse_path = STONECUTTER_DIR / reverse_file_name

        if reverse_path.exists():
            continue

        reverse_payload = make_reverse_stonecutter_recipe(base_item_id, variant_item_id, variant_suffix)
        if not dry_run:
            write_json(reverse_path, reverse_payload)
        created_reverse_recipes += 1

    return created_reverse_recipes, skipped_non_variant_recipes


def update_assets_blocks(targets: list[TargetBlock], dry_run: bool) -> tuple[int, int, int, int]:
    data = read_json(ASSETS_BLOCKS_PATH)
    created_slab_entries = 0
    created_stairs_entries = 0
    created_three_step_stairs_entries = 0
    created_vertical_slab_entries = 0

    for target in targets:
        slab_id = f"dorios_atelier:{target.base_name}_slab"
        stairs_id = f"dorios_atelier:{target.base_name}_stairs"
        three_steps_stairs_id = f"dorios_atelier:{target.base_name}_three_steps_stairs"
        vertical_slab_id = f"dorios_atelier:{target.base_name}_vertical_slab"

        if slab_id not in data:
            data[slab_id] = {"sound": target.sound, "textures": target.texture}
            created_slab_entries += 1
        if stairs_id not in data:
            data[stairs_id] = {"sound": target.sound, "textures": target.texture}
            created_stairs_entries += 1
        if three_steps_stairs_id not in data:
            data[three_steps_stairs_id] = {"sound": target.sound, "textures": target.texture}
            created_three_step_stairs_entries += 1
        if vertical_slab_id not in data:
            data[vertical_slab_id] = {"sound": target.sound, "textures": target.texture}
            created_vertical_slab_entries += 1

    if not dry_run and (
        created_slab_entries
        or created_stairs_entries
        or created_three_step_stairs_entries
        or created_vertical_slab_entries
    ):
        write_json(ASSETS_BLOCKS_PATH, data)

    return (
        created_slab_entries,
        created_stairs_entries,
        created_three_step_stairs_entries,
        created_vertical_slab_entries,
    )


def sync_or_create_group_items(
    groups: list[dict[str, Any]],
    group_name: str,
    icon: str,
    items: list[str],
) -> int:
    seen: set[str] = set()
    desired_items: list[str] = []
    for item in items:
        if item in seen:
            continue
        seen.add(item)
        desired_items.append(item)

    for group in groups:
        current_name = group.get("group_identifier", {}).get("name")
        if current_name == group_name:
            current_items = group.get("items", [])
            if current_items != desired_items:
                group["items"] = desired_items
                return 1
            return 0

    groups.append(
        {
            "group_identifier": {
                "icon": icon,
                "name": group_name,
            },
            "items": desired_items,
        }
    )
    return 1


def infer_material_token(base_name: str) -> str:
    words = base_name.split("_")
    for token in MATERIAL_TOKEN_PRIORITY:
        if token in words:
            return token
    return words[0] if words else base_name


def extract_base_name(identifier: str) -> str:
    name = identifier.split(":", 1)[1] if ":" in identifier else identifier
    parsed = split_variant_item_name(name)
    if parsed is None:
        return name
    return parsed[0]


def build_material_order(stonework_items: list[str]) -> list[str]:
    ordered_tokens: list[str] = []
    seen: set[str] = set()

    for identifier in stonework_items:
        base_name = extract_base_name(identifier)
        token = infer_material_token(base_name)
        if token in seen:
            continue
        seen.add(token)
        ordered_tokens.append(token)

    for token in MATERIAL_TOKEN_PRIORITY:
        if token in seen:
            continue
        seen.add(token)
        ordered_tokens.append(token)

    return ordered_tokens


def sort_variant_items_by_material(items: list[str], material_order: list[str]) -> list[str]:
    order_index = {token: index for index, token in enumerate(material_order)}

    def key(identifier: str) -> tuple[int, str, str]:
        base_name = extract_base_name(identifier)
        token = infer_material_token(base_name)
        return (order_index.get(token, len(order_index) + 1), base_name, identifier)

    return sorted(set(items), key=key)


def collect_identifiers_from_dir(directory: Path) -> list[str]:
    identifiers: list[str] = []
    for path in sorted(directory.glob("*.json")):
        payload = read_json(path)
        identifier = payload.get("minecraft:block", {}).get("description", {}).get("identifier")
        if isinstance(identifier, str):
            identifiers.append(identifier)
    return identifiers


def update_crafting_catalog(dry_run: bool) -> tuple[int, int, int, int, int, int]:
    data = read_json(CATALOG_PATH)
    categories = data["minecraft:crafting_items_catalog"]["categories"]
    construction = next(category for category in categories if category["category_name"] == "construction")
    groups = construction["groups"]
    valid_stonework_names = {STONEWORK_GROUP_NAME, "dorios_atelier:itemGroup.name.stoneBricks"}
    stonework_group = next(
        (
            group
            for group in groups
            if group.get("group_identifier", {}).get("name") in valid_stonework_names
        ),
        None,
    )
    stonework_items = stonework_group.get("items", []) if isinstance(stonework_group, dict) else []
    material_order = build_material_order(stonework_items)

    removed_slab_groups = 0
    removed_stairs_groups = 0

    slab_ids = collect_identifiers_from_dir(SLABS_DIR)
    stairs_ids = collect_identifiers_from_dir(STAIRS_DIR)
    vertical_slab_ids = collect_identifiers_from_dir(BP_ROOT / "blocks/decorative/vertical_slabs")
    three_step_stairs_ids = collect_identifiers_from_dir(UNIQUE_STAIRS_DIR)
    ordered_slab_ids = sort_variant_items_by_material(slab_ids, material_order)
    ordered_stairs_ids = sort_variant_items_by_material(stairs_ids, material_order)
    ordered_vertical_slab_ids = sort_variant_items_by_material(vertical_slab_ids, material_order)
    ordered_three_step_stairs_ids = sort_variant_items_by_material(three_step_stairs_ids, material_order)

    catalog_updates = 0
    catalog_updates += sync_or_create_group_items(
        construction["groups"],
        SLAB_GROUP_NAME,
        "dorios_atelier:andesite_tiles_slab",
        ordered_slab_ids,
    )
    catalog_updates += sync_or_create_group_items(
        construction["groups"],
        STAIRS_GROUP_NAME,
        "dorios_atelier:andesite_tiles_stairs",
        ordered_stairs_ids,
    )
    catalog_updates += sync_or_create_group_items(
        construction["groups"],
        VERTICAL_SLABS_GROUP_NAME,
        "dorios_atelier:andesite_tiles_vertical_slab",
        ordered_vertical_slab_ids,
    )
    catalog_updates += sync_or_create_group_items(
        construction["groups"],
        THREE_STEP_STAIRS_GROUP_NAME,
        "dorios_atelier:andesite_tiles_three_steps_stairs",
        ordered_three_step_stairs_ids,
    )

    if not dry_run and (removed_slab_groups or removed_stairs_groups or catalog_updates):
        write_json(CATALOG_PATH, data)

    return (
        removed_slab_groups,
        removed_stairs_groups,
        len(slab_ids),
        len(stairs_ids),
        len(vertical_slab_ids),
        len(three_step_stairs_ids),
    )


def update_stairs_script(dry_run: bool) -> int:
    stairs_ids = collect_identifiers_from_dir(STAIRS_DIR) + collect_identifiers_from_dir(UNIQUE_STAIRS_DIR)
    stairs_ids = sorted(set(stairs_ids))

    script = STAIRS_SCRIPT_PATH.read_text(encoding="utf-8")
    replacement_lines = ["const STAIR_IDS = new Set(["]
    for identifier in stairs_ids:
        replacement_lines.append(f'    "{identifier}",')
    replacement_lines.append("]);")
    replacement_block = "\n".join(replacement_lines)

    pattern = r"const STAIR_IDS = new Set\(\[(?:.|\n)*?\]\);"
    updated = re.sub(pattern, replacement_block, script, count=1)

    if updated != script and not dry_run:
        STAIRS_SCRIPT_PATH.write_text(updated, encoding="utf-8")

    return len(stairs_ids)


def build_report(targets: list[TargetBlock]) -> dict[str, Any]:
    return {
        "target_count": len(targets),
        "targets": [
            {
                "identifier": target.identifier,
                "base_name": target.base_name,
                "is_stone": target.is_stone,
                "has_slab": target.has_slab,
                "has_stairs": target.has_stairs,
                "has_three_steps_stairs": target.has_three_steps_stairs,
                "has_vertical_slab": target.has_vertical_slab,
                "texture": target.texture,
            }
            for target in targets
        ],
    }


def run_generation(targets: list[TargetBlock], dry_run: bool) -> dict[str, int]:
    slab_template = read_json(SLAB_TEMPLATE_PATH)
    stairs_template = read_json(STAIRS_TEMPLATE_PATH)
    three_step_stairs_template = read_json(THREE_STEP_STAIRS_TEMPLATE_PATH)
    vertical_slab_template = read_json(VERTICAL_SLAB_TEMPLATE_PATH)
    slab_culling_template = read_json(SLAB_CULLING_TEMPLATE_PATH)
    stairs_culling_template = read_json(STAIRS_CULLING_TEMPLATE_PATH)
    three_step_stairs_culling_template = read_json(THREE_STEP_STAIRS_CULLING_TEMPLATE_PATH)

    created_slab_blocks = 0
    created_stairs_blocks = 0
    created_three_steps_stairs_blocks = 0
    created_vertical_slabs = 0
    created_slab_culling = 0
    created_stairs_culling = 0
    created_three_steps_stairs_culling = 0
    created_slab_recipes = 0
    created_stairs_recipes = 0
    created_three_steps_stairs_recipes = 0
    created_vertical_slab_recipes = 0

    for target in targets:
        slab_block_path = SLABS_DIR / variant_filename(target.base_name, "slab")
        stairs_block_path = STAIRS_DIR / variant_filename(target.base_name, "stairs")
        three_step_stairs_block_path = UNIQUE_STAIRS_DIR / variant_filename(target.base_name, "three_steps_stairs")
        vertical_slab_block_path = BP_ROOT / "blocks/decorative/vertical_slabs" / variant_filename(target.base_name, "vertical_slab")
        slab_culling_path = CULLING_DIR / variant_filename(target.base_name, "slab")
        stairs_culling_path = CULLING_DIR / variant_filename(target.base_name, "stairs")
        three_step_stairs_culling_path = CULLING_DIR / variant_filename(target.base_name, "three_steps_stairs")
        slab_recipe_path = STONECUTTER_DIR / f"{target.base_name}_slab_from_{target.base_name}.json"
        stairs_recipe_path = STONECUTTER_DIR / f"{target.base_name}_str_from_{target.base_name}.json"
        three_step_stairs_recipe_path = STONECUTTER_DIR / f"{target.base_name}_tss_from_{target.base_name}.json"
        vertical_slab_recipe_path = STONECUTTER_DIR / f"{target.base_name}_vslab_from_{target.base_name}.json"

        if not slab_block_path.exists():
            if not dry_run:
                write_json(slab_block_path, generate_slab_block(slab_template, target))
            created_slab_blocks += 1

        if not stairs_block_path.exists():
            if not dry_run:
                write_json(stairs_block_path, generate_stairs_block(stairs_template, target))
            created_stairs_blocks += 1

        if not three_step_stairs_block_path.exists():
            if not dry_run:
                write_json(three_step_stairs_block_path, generate_three_steps_stairs_block(three_step_stairs_template, target))
            created_three_steps_stairs_blocks += 1

        if not vertical_slab_block_path.exists():
            if not dry_run:
                write_json(vertical_slab_block_path, generate_vertical_slab_block(vertical_slab_template, target))
            created_vertical_slabs += 1

        if not slab_culling_path.exists():
            if not dry_run:
                write_json(slab_culling_path, generate_slab_culling(slab_culling_template, target.base_name))
            created_slab_culling += 1

        if not stairs_culling_path.exists():
            if not dry_run:
                write_json(stairs_culling_path, generate_stairs_culling(stairs_culling_template, target.base_name))
            created_stairs_culling += 1

        if not three_step_stairs_culling_path.exists():
            if not dry_run:
                write_json(
                    three_step_stairs_culling_path,
                    generate_three_steps_stairs_culling(three_step_stairs_culling_template, target.base_name),
                )
            created_three_steps_stairs_culling += 1

        if not slab_recipe_path.exists():
            if not dry_run:
                write_json(slab_recipe_path, make_stonecutter_recipe(target.base_name, "slab", 2))
            created_slab_recipes += 1

        if not stairs_recipe_path.exists():
            if not dry_run:
                write_json(stairs_recipe_path, make_stonecutter_recipe(target.base_name, "stairs", 1))
            created_stairs_recipes += 1

        if not three_step_stairs_recipe_path.exists():
            if not dry_run:
                write_json(three_step_stairs_recipe_path, make_stonecutter_recipe(target.base_name, "three_steps_stairs", 1))
            created_three_steps_stairs_recipes += 1

        if not vertical_slab_recipe_path.exists():
            if not dry_run:
                write_json(vertical_slab_recipe_path, make_stonecutter_recipe(target.base_name, "vertical_slab", 2))
            created_vertical_slab_recipes += 1

    created_reverse_recipes, skipped_non_variant_recipes = create_reverse_variant_recipes(dry_run)

    (
        assets_slab_entries,
        assets_stairs_entries,
        assets_three_step_stairs_entries,
        assets_vertical_slab_entries,
    ) = update_assets_blocks(targets, dry_run)
    (
        removed_vanilla_slab_groups,
        removed_vanilla_stairs_groups,
        catalog_slab_items,
        catalog_stairs_items,
        catalog_vertical_slab_items,
        catalog_three_step_stairs_items,
    ) = update_crafting_catalog(dry_run)
    tracked_stairs_ids = update_stairs_script(dry_run)
    updated_localization_entries, created_localization_entries = update_block_localization_names(dry_run)

    return {
        "created_slab_blocks": created_slab_blocks,
        "created_stairs_blocks": created_stairs_blocks,
        "created_three_steps_stairs_blocks": created_three_steps_stairs_blocks,
        "created_vertical_slabs": created_vertical_slabs,
        "created_slab_culling": created_slab_culling,
        "created_stairs_culling": created_stairs_culling,
        "created_three_steps_stairs_culling": created_three_steps_stairs_culling,
        "created_slab_recipes": created_slab_recipes,
        "created_stairs_recipes": created_stairs_recipes,
        "created_three_steps_stairs_recipes": created_three_steps_stairs_recipes,
        "created_vertical_slab_recipes": created_vertical_slab_recipes,
        "created_reverse_variant_recipes": created_reverse_recipes,
        "skipped_non_variant_stonecutter_recipes": skipped_non_variant_recipes,
        "assets_slab_entries": assets_slab_entries,
        "assets_stairs_entries": assets_stairs_entries,
        "assets_three_step_stairs_entries": assets_three_step_stairs_entries,
        "assets_vertical_slab_entries": assets_vertical_slab_entries,
        "removed_vanilla_slab_groups": removed_vanilla_slab_groups,
        "removed_vanilla_stairs_groups": removed_vanilla_stairs_groups,
        "catalog_slab_items": catalog_slab_items,
        "catalog_stairs_items": catalog_stairs_items,
        "catalog_vertical_slab_items": catalog_vertical_slab_items,
        "catalog_three_step_stairs_items": catalog_three_step_stairs_items,
        "tracked_stairs_ids": tracked_stairs_ids,
        "updated_localization_entries": updated_localization_entries,
        "created_localization_entries": created_localization_entries,
    }


def main() -> None:
    args = parse_args()

    if not args.import_vanilla_compatible:
        policy_stats = apply_vanilla_base_policy(
            vanilla_list_path=args.vanilla_list,
            dry_run=args.dry_run,
        )
        print("Vanilla base policy summary:")
        for key, value in policy_stats.items():
            print(f"- {key}: {value}")

    if args.import_vanilla_compatible:
        if args.vanilla_blocks_json is None:
            raise ValueError("--vanilla-blocks-json is required when --import-vanilla-compatible is used.")

        import_stats = import_vanilla_compatible_blocks(
            vanilla_blocks_json_path=args.vanilla_blocks_json,
            vanilla_list_path=args.vanilla_list,
            dry_run=args.dry_run,
        )

        print("Vanilla import summary:")
        for key, value in import_stats.items():
            print(f"- {key}: {value}")

    targets = find_targets(include_non_stone=args.include_non_stone)

    report = build_report(targets)
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    write_json(REPORT_PATH, report)

    print(f"Mapped targets: {len(targets)}")
    print(f"Report: {REPORT_PATH.relative_to(ROOT)}")

    if args.dry_run:
        print("Dry run enabled. No files were changed.")
        return

    stats = run_generation(targets, dry_run=False)
    print("Generation summary:")
    for key, value in stats.items():
        print(f"- {key}: {value}")


if __name__ == "__main__":
    main()
