from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BP_ROOT = ROOT / "BP"
RP_ROOT = ROOT / "RP"

NAMESPACE = "dorios_atelier"
GLASS_TEXTURE_DIR = RP_ROOT / "textures/blocks/glass"
GLASS_BLOCK_DIR = BP_ROOT / "blocks/decorative/entire_blocks/Glass"
BLOCKS_JSON_PATH = RP_ROOT / "blocks.json"
TERRAIN_TEXTURE_PATH = RP_ROOT / "textures/terrain_texture.json"
CATALOG_PATH = BP_ROOT / "item_catalog/crafting_item_catalog.json"
CULLING_PATH = RP_ROOT / "block_culling/custom_glass.json"
LANG_PATHS = {
    "en_US": RP_ROOT / "texts/en_US.lang",
    "pt_BR": RP_ROOT / "texts/pt_BR.lang",
    "es_MX": RP_ROOT / "texts/es_MX.lang",
}

GROUP_KEY = f"{NAMESPACE}:itemGroup.name.customGlass"


GLASS_DURABILITY_PROFILES = {
    "tempered": {"seconds_to_destroy": 1.2, "explosion_resistance": 6.0},
    "clean": {"seconds_to_destroy": 0.12, "explosion_resistance": 0.35},
    "clear": {"seconds_to_destroy": 0.12, "explosion_resistance": 0.35},
    "broadline": {"seconds_to_destroy": 0.22, "explosion_resistance": 0.7},
    "hitch_cross": {"seconds_to_destroy": 0.28, "explosion_resistance": 1.0},
    "stained": {"seconds_to_destroy": 0.18, "explosion_resistance": 0.5},
}


def resolve_glass_profile(identifier_suffix: str) -> dict[str, float]:
    for marker, profile in GLASS_DURABILITY_PROFILES.items():
        if marker in identifier_suffix:
            return profile
    return {"seconds_to_destroy": 0.2, "explosion_resistance": 0.6}


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=4) + "\n", encoding="utf-8")


def collect_glass_texture_names() -> list[str]:
    names = sorted(p.stem for p in GLASS_TEXTURE_DIR.glob("*.png"))
    return [name for name in names if "pane" not in name]


def make_glass_block(identifier_suffix: str, texture_key: str) -> dict:
    profile = resolve_glass_profile(identifier_suffix)
    return {
        "format_version": "1.21.100",
        "minecraft:block": {
            "description": {
                "identifier": f"{NAMESPACE}:{identifier_suffix}",
                "menu_category": {
                    "category": "construction"
                }
            },
            "components": {
                "minecraft:geometry": {
                    "identifier": "minecraft:geometry.full_block",
                    "culling": f"{NAMESPACE}:custom_glass"
                },
                "minecraft:light_dampening": 0,
                "minecraft:light_emission": 0,
                "minecraft:material_instances": {
                    "*": {
                        "texture": texture_key,
                        "ambient_occlusion": 0.9,
                        "face_dimming": True,
                        "render_method": "blend"
                    }
                },
                "minecraft:destructible_by_mining": {
                    "seconds_to_destroy": profile["seconds_to_destroy"]
                },
                "minecraft:destructible_by_explosion": {
                    "explosion_resistance": profile["explosion_resistance"]
                },
                "minecraft:loot": "loot_tables/empty.json",
                "tag:dorios_atelier:breakable_by_cutter": {}
            }
        }
    }


def humanize_name(base_name: str) -> str:
    return " ".join(word.capitalize() for word in base_name.split("_"))


def ensure_lang_entries(entries: dict[str, str], lang_path: Path) -> None:
    if not lang_path.exists():
        return

    lines = lang_path.read_text(encoding="utf-8").splitlines()
    existing_keys = {line.split("=", 1)[0] for line in lines if "=" in line and not line.startswith("##")}

    additions = [f"{k}={v}" for k, v in entries.items() if k not in existing_keys]
    if not additions:
        return

    content = "\n".join(lines)
    if content and not content.endswith("\n"):
        content += "\n"
    if content and not content.endswith("\n\n"):
        content += "\n"
    content += "\n".join(additions) + "\n"
    lang_path.write_text(content, encoding="utf-8")


def update_catalog(glass_ids: list[str]) -> None:
    catalog = read_json(CATALOG_PATH)
    categories = catalog["minecraft:crafting_items_catalog"]["categories"]
    construction = next(c for c in categories if c["category_name"] == "construction")
    groups = construction["groups"]

    groups = [g for g in groups if g.get("group_identifier", {}).get("name") != GROUP_KEY]

    icon = f"{NAMESPACE}:clean_glass" if f"{NAMESPACE}:clean_glass" in glass_ids else glass_ids[0]
    groups.append(
        {
            "group_identifier": {
                "icon": icon,
                "name": GROUP_KEY,
            },
            "items": sorted(glass_ids),
        }
    )

    construction["groups"] = groups
    write_json(CATALOG_PATH, catalog)


def update_blocks_json(entries: dict[str, dict]) -> None:
    data = read_json(BLOCKS_JSON_PATH)
    changed = False
    for key, value in entries.items():
        if data.get(key) != value:
            data[key] = value
            changed = True

    if changed:
        write_json(BLOCKS_JSON_PATH, data)


def update_terrain_texture(texture_entries: dict[str, dict]) -> None:
    data = read_json(TERRAIN_TEXTURE_PATH)
    texture_data = data.setdefault("texture_data", {})

    changed = False
    for key, value in texture_entries.items():
        if texture_data.get(key) != value:
            texture_data[key] = value
            changed = True

    if changed:
        write_json(TERRAIN_TEXTURE_PATH, data)


def update_custom_glass_culling() -> None:
    payload = read_json(CULLING_PATH)
    description = payload.get("minecraft:block_culling_rules", {}).get("description", {})
    if description.get("identifier") != f"{NAMESPACE}:custom_glass":
        payload["minecraft:block_culling_rules"]["description"]["identifier"] = f"{NAMESPACE}:custom_glass"
        write_json(CULLING_PATH, payload)


def main() -> None:
    texture_names = collect_glass_texture_names()
    if not texture_names:
        print("No glass textures found.")
        return

    GLASS_BLOCK_DIR.mkdir(parents=True, exist_ok=True)

    blocks_json_entries: dict[str, dict] = {}
    terrain_entries: dict[str, dict] = {}
    glass_ids: list[str] = []

    for name in texture_names:
        texture_key = f"{NAMESPACE}_{name}"
        identifier = f"{NAMESPACE}:{name}"
        payload = make_glass_block(name, texture_key)

        write_json(GLASS_BLOCK_DIR / f"{name}.json", payload)

        blocks_json_entries[identifier] = {
            "sound": "glass",
            "textures": texture_key,
        }
        terrain_entries[texture_key] = {
            "textures": f"textures/blocks/glass/{name}"
        }
        glass_ids.append(identifier)

    update_blocks_json(blocks_json_entries)
    update_terrain_texture(terrain_entries)
    update_custom_glass_culling()
    update_catalog(glass_ids)

    en_entries = {GROUP_KEY: "Custom Glass"}
    pt_entries = {GROUP_KEY: "Vidros Personalizados"}
    es_entries = {GROUP_KEY: "Vidrios Personalizados"}

    for name in texture_names:
        label = humanize_name(name)
        en_entries[f"tile.{NAMESPACE}:{name}.name"] = label
        pt_entries[f"tile.{NAMESPACE}:{name}.name"] = label
        es_entries[f"tile.{NAMESPACE}:{name}.name"] = label

    ensure_lang_entries(en_entries, LANG_PATHS["en_US"])
    ensure_lang_entries(pt_entries, LANG_PATHS["pt_BR"])
    ensure_lang_entries(es_entries, LANG_PATHS["es_MX"])

    print(f"Generated/updated {len(texture_names)} glass blocks.")


if __name__ == "__main__":
    main()
