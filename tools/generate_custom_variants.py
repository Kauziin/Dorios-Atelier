from __future__ import annotations

import copy
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BP_ROOT = ROOT / "BP"
RP_ROOT = ROOT / "RP"

NAMESPACE = "dorios_atelier"
LEGACY_NAMESPACE = "utilitycraft"
GROUP_NAMESPACE = "dorios_atelier"
LEGACY_GROUP_NAMESPACE = "dorios"

MATERIALS_NEW = ["blackstone", "calcite", "diorite", "dripstone", "granite", "obsidian", "tuff"]
MATERIALS_ALL = ["andesite", "basalt", *MATERIALS_NEW]


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=4) + "\n", encoding="utf-8")


def configure_obsidian_common_components(components: dict) -> None:
    components["minecraft:destructible_by_mining"] = {"seconds_to_destroy": 40}
    components["minecraft:destructible_by_explosion"] = False
    if "tag:minecraft:stone_tier_destructible" in components:
        del components["tag:minecraft:stone_tier_destructible"]
    components["tag:minecraft:diamond_tier_destructible"] = {}


def generate_vertical_slabs() -> None:
    template_path = BP_ROOT / "blocks/decorative/vertical_slabs/andesite_tiles_vslab.json"
    template = read_json(template_path)

    for material in MATERIALS_NEW:
        data = copy.deepcopy(template)
        block = data["minecraft:block"]
        block["description"]["identifier"] = f"{NAMESPACE}:{material}_tiles_vertical_slab"
        block["components"]["minecraft:material_instances"]["*"]["texture"] = f"utilitycraft_{material}_tiles"

        if material == "obsidian":
            configure_obsidian_common_components(block["components"])

        out_path = BP_ROOT / f"blocks/decorative/vertical_slabs/{material}_tiles_vslab.json"
        write_json(out_path, data)


def generate_three_step_stairs() -> None:
    template_path = BP_ROOT / "blocks/decorative/unique_stairs/andesite_tiles_tss.json"
    template = read_json(template_path)

    for material in MATERIALS_ALL:
        data = copy.deepcopy(template)
        block = data["minecraft:block"]
        block["description"]["identifier"] = f"{NAMESPACE}:{material}_tiles_three_steps_stairs"
        block["description"]["menu_category"] = {"category": "construction"}
        block["components"]["minecraft:geometry"]["culling"] = f"{NAMESPACE}:culling.{material}_tiles_three_steps_stairs"
        block["components"]["minecraft:material_instances"]["*"]["texture"] = f"utilitycraft_{material}_tiles"

        if material == "obsidian":
            configure_obsidian_common_components(block["components"])

        out_path = BP_ROOT / f"blocks/decorative/unique_stairs/{material}_tiles_tss.json"
        write_json(out_path, data)


def generate_three_step_culling() -> None:
    template_path = RP_ROOT / "block_culling/andesite_tiles_tss.json"
    template = read_json(template_path)

    for material in MATERIALS_NEW:
        data = copy.deepcopy(template)
        data["minecraft:block_culling_rules"]["description"]["identifier"] = (
            f"{NAMESPACE}:culling.{material}_tiles_three_steps_stairs"
        )
        out_path = RP_ROOT / f"block_culling/{material}_tiles_tss.json"
        write_json(out_path, data)


def make_stonecutter_recipe(material: str, variant: str, count: int) -> dict:
    # variant: "three_steps_stairs" | "vertical_slab"
    return {
        "format_version": "1.21.100",
        "minecraft:recipe_shapeless": {
            "description": {
                "identifier": f"{NAMESPACE}:sc_{material}_tiles_{variant}_from_{material}_tiles"
            },
            "tags": ["stonecutter"],
            "ingredients": [{"item": f"{NAMESPACE}:{material}_tiles"}],
            "result": {"item": f"{NAMESPACE}:{material}_tiles_{variant}", "count": count},
            "unlock": [{"item": f"{NAMESPACE}:{material}_tiles"}],
        },
    }


def generate_custom_recipes() -> None:
    base_dir = BP_ROOT / "recipes/stonecutter"
    base_dir.mkdir(parents=True, exist_ok=True)

    for material in MATERIALS_NEW:
        three_steps = make_stonecutter_recipe(material, "three_steps_stairs", 1)
        vertical = make_stonecutter_recipe(material, "vertical_slab", 2)

        write_json(base_dir / f"{material}_tiles_tss_from_{material}_tiles.json", three_steps)
        write_json(base_dir / f"{material}_tiles_vslab_from_{material}_tiles.json", vertical)


def update_catalog() -> None:
    path = BP_ROOT / "item_catalog/crafting_item_catalog.json"
    data = read_json(path)

    construction = next(
        c for c in data["minecraft:crafting_items_catalog"]["categories"] if c["category_name"] == "construction"
    )
    groups = construction["groups"]

    valid_stone_groups = {
        f"{GROUP_NAMESPACE}:itemGroup.name.stoneBricks",
        f"{LEGACY_GROUP_NAMESPACE}:itemGroup.name.stoneBricks",
    }
    stone_group = next(g for g in groups if g["group_identifier"]["name"] in valid_stone_groups)
    stone_group["items"] = [
        item
        for item in stone_group["items"]
        if not item.endswith("_tiles_vertical_slab") and not item.endswith("_tiles_three_steps_stairs")
    ]

    def merge_or_create_group(
        primary_name: str,
        legacy_name: str,
        icon: str,
        required_items: list[str],
    ) -> None:
        group = next(
            (
                g
                for g in groups
                if g.get("group_identifier", {}).get("name") in {primary_name, legacy_name}
            ),
            None,
        )

        if group is None:
            group = {
                "group_identifier": {
                    "icon": icon,
                    "name": primary_name,
                },
                "items": [],
            }
            groups.append(group)

        group_identifier = group.setdefault("group_identifier", {})
        group_identifier["icon"] = icon
        group_identifier["name"] = primary_name

        existing_items = list(group.get("items", []))
        existing_set = set(existing_items)
        for item in required_items:
            if item not in existing_set:
                existing_items.append(item)
                existing_set.add(item)
        group["items"] = existing_items

    merge_or_create_group(
        primary_name=f"{GROUP_NAMESPACE}:itemGroup.name.verticalSlabs",
        legacy_name=f"{LEGACY_GROUP_NAMESPACE}:itemGroup.name.verticalSlabs",
        icon=f"{NAMESPACE}:andesite_tiles_vertical_slab",
        required_items=[f"{NAMESPACE}:{m}_tiles_vertical_slab" for m in MATERIALS_ALL],
    )

    merge_or_create_group(
        primary_name=f"{GROUP_NAMESPACE}:itemGroup.name.threeStepStairs",
        legacy_name=f"{LEGACY_GROUP_NAMESPACE}:itemGroup.name.threeStepStairs",
        icon=f"{NAMESPACE}:andesite_tiles_three_steps_stairs",
        required_items=[f"{NAMESPACE}:{m}_tiles_three_steps_stairs" for m in MATERIALS_ALL],
    )

    construction["groups"] = groups
    write_json(path, data)


def ensure_lang_entries(path: Path, entries: dict[str, str]) -> None:
    text = path.read_text(encoding="utf-8")
    lines = text.splitlines()
    existing = {line.split("=", 1)[0] for line in lines if "=" in line and not line.startswith("##")}

    additions = [f"{k}={v}" for k, v in entries.items() if k not in existing]
    if not additions:
        return

    if text and not text.endswith("\n"):
        text += "\n"
    if text and not text.endswith("\n\n"):
        text += "\n"
    text += "\n".join(additions) + "\n"
    path.write_text(text, encoding="utf-8")


def update_lang_files() -> None:
    en_material = {
        "blackstone": "Blackstone",
        "calcite": "Calcite",
        "diorite": "Diorite",
        "dripstone": "Dripstone",
        "granite": "Granite",
        "obsidian": "Obsidian",
        "tuff": "Tuff",
    }
    pt_material = {
        "blackstone": "Pedra-Negra",
        "calcite": "Calcita",
        "diorite": "Diorito",
        "dripstone": "Espeleotema",
        "granite": "Granito",
        "obsidian": "Obsidiana",
        "tuff": "Tufo",
    }
    es_material = {
        "blackstone": "Blackstone",
        "calcite": "Calcita",
        "diorite": "Diorita",
        "dripstone": "Dripstone",
        "granite": "Granito",
        "obsidian": "Obsidiana",
        "tuff": "Tufo",
    }

    en_entries: dict[str, str] = {
        f"{GROUP_NAMESPACE}:itemGroup.name.threeStepStairs": "Three-Step Stairs",
        f"{GROUP_NAMESPACE}:itemGroup.name.verticalSlabs": "Vertical Slabs",
    }
    pt_entries: dict[str, str] = {
        f"{GROUP_NAMESPACE}:itemGroup.name.threeStepStairs": "Escadas de Três Degraus",
        f"{GROUP_NAMESPACE}:itemGroup.name.verticalSlabs": "Lajes Verticais",
    }
    es_entries: dict[str, str] = {
        f"{GROUP_NAMESPACE}:itemGroup.name.threeStepStairs": "Escaleras de Tres Peldaños",
        f"{GROUP_NAMESPACE}:itemGroup.name.verticalSlabs": "Losas Verticales",
    }

    for material, label in en_material.items():
        en_entries[f"tile.{NAMESPACE}:{material}_tiles_vertical_slab.name"] = f"{label} Tiles Vertical Slab"
        en_entries[f"tile.{NAMESPACE}:{material}_tiles_three_steps_stairs.name"] = f"{label} Tiles Three-Step Stairs"

    for material, label in pt_material.items():
        pt_entries[f"tile.{NAMESPACE}:{material}_tiles_vertical_slab.name"] = f"Laje Vertical de Ladrilhos de {label}"
        pt_entries[f"tile.{NAMESPACE}:{material}_tiles_three_steps_stairs.name"] = (
            f"Escada de Três Degraus de Ladrilhos de {label}"
        )

    for material, label in es_material.items():
        es_entries[f"tile.{NAMESPACE}:{material}_tiles_vertical_slab.name"] = f"Losa Vertical de Losetas de {label}"
        es_entries[f"tile.{NAMESPACE}:{material}_tiles_three_steps_stairs.name"] = (
            f"Escalera de Tres Peldaños de Losetas de {label}"
        )

    ensure_lang_entries(RP_ROOT / "texts/en_US.lang", en_entries)
    ensure_lang_entries(RP_ROOT / "texts/pt_BR.lang", pt_entries)
    ensure_lang_entries(RP_ROOT / "texts/es_MX.lang", es_entries)


def main() -> None:
    generate_vertical_slabs()
    generate_three_step_stairs()
    generate_three_step_culling()
    generate_custom_recipes()
    update_catalog()
    update_lang_files()


if __name__ == "__main__":
    main()
