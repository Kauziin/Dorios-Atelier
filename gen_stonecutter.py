from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from jinja2 import Environment, FileSystemLoader

BASE_DIR = Path(__file__).resolve().parent
TEMPLATE_DIR = BASE_DIR
OUTPUT_DIR = BASE_DIR / "Data" / "recipes" / "stonecutter"


@dataclass(frozen=True)
class StonecutterRecipe:
    input_item: str
    output_item: str
    count: int = 1

    def identifier(self) -> str:
        return (
            "utilitycraft:sc_"
            f"{self._sanitize(self._short_name(self.output_item))}_"
            f"from_{self._sanitize(self._short_name(self.input_item))}"
        )

    def filename(self) -> str:
        return (
            f"sc_{self._sanitize(self._short_name(self.output_item))}_"
            f"from_{self._sanitize(self._short_name(self.input_item))}.json"
        )

    @staticmethod
    def _sanitize(item_id: str) -> str:
        return item_id.replace(":", "_")

    @staticmethod
    def _short_name(item_id: str) -> str:
        return item_id.split(":", 1)[1] if ":" in item_id else item_id


STONECUTTER_CHAINS: list[dict[str, object]] = [
    {
        "base": "minecraft:andesite",
        "liso": ["smooth_andesite"],
        "bricks": "andesite_bricks",
        "tiles": "andesite_tiles",
        "chiseled_from_liso": ["chiseled_andesite"],
        "chiseled_from_bricks": ["chiseled_andesite_bricks"],
    },
    {
        "base": "minecraft:basalt",
        "liso": ["smooth_basalt"],
        "bricks": "basalt_bricks",
        "tiles": "basalt_tiles",
        "chiseled_from_liso": ["chiseled_basalt"],
        "chiseled_from_bricks": ["chiseled_basalt_bricks"],
    },
    {
        "base": "minecraft:blackstone",
        "liso": ["smooth_blackstone"],
        "bricks": "blackstone_bricks",
        "tiles": "blackstone_tiles",
        "chiseled_from_liso": ["chiseled_blackstone"],
        "chiseled_from_bricks": ["chiseled_blackstone_bricks"],
    },
    {
        "base": "minecraft:calcite",
        "liso": ["smooth_calcite", "polished_calcite"],
        "bricks": "calcite_bricks",
        "tiles": "calcite_tiles",
        "chiseled_from_liso": ["chiseled_calcite"],
        "chiseled_from_bricks": ["chiseled_calcite_bricks"],
    },
    {
        "base": "minecraft:diorite",
        "liso": ["smooth_diorite"],
        "bricks": "diorite_bricks",
        "tiles": "diorite_tiles",
        "chiseled_from_liso": ["chiseled_diorite"],
        "chiseled_from_bricks": ["chiseled_diorite_bricks"],
    },
    {
        "base": "minecraft:dripstone_block",
        "liso": ["smooth_dripstone", "polished_dripstone"],
        "bricks": "dripstone_bricks",
        "tiles": "dripstone_tiles",
        "chiseled_from_liso": ["chiseled_dripstone"],
        "chiseled_from_bricks": ["chiseled_dripstone_bricks"],
    },
    {
        "base": "minecraft:granite",
        "liso": ["smooth_granite"],
        "bricks": "granite_bricks",
        "tiles": "granite_tiles",
        "chiseled_from_liso": ["chiseled_granite"],
        "chiseled_from_bricks": ["chiseled_granite_bricks"],
    },
    {
        "base": "minecraft:polished_basalt",
        "liso": ["smooth_polished_basalt"],
        "bricks": "polished_basalt_bricks",
        "tiles": "polished_basalt_tiles",
        "chiseled_from_liso": ["chiseled_polished_basalt"],
        "chiseled_from_bricks": [
            "chiseled_polished_basalt_bricks",
            "chiseled_polished_basalt_tiles",
        ],
    },
    {
        "base": "minecraft:tuff",
        "liso": ["smooth_tuff"],
        "bricks": "tuff_bricks",
        "tiles": "tuff_tiles",
        "chiseled_from_liso": ["chiseled_tuff"],
        "chiseled_from_bricks": ["chiseled_tuff_bricks"],
    },
]


def make_item_id(name: str) -> str:
    return name if ":" in name else f"utilitycraft:{name}"


def build_recipes() -> list[StonecutterRecipe]:
    recipes: list[StonecutterRecipe] = []
    seen: set[tuple[str, str, int]] = set()

    def add_recipe(input_item: str, output_item: str, count: int = 1) -> None:
        if input_item == output_item:
            return
        key = (input_item, output_item, count)
        if key in seen:
            return
        seen.add(key)
        recipes.append(StonecutterRecipe(input_item, output_item, count))

    for chain in STONECUTTER_CHAINS:
        base_item = make_item_id(str(chain["base"]))
        liso_items = [make_item_id(name) for name in chain.get("liso", [])]
        bricks_item = make_item_id(chain["bricks"]) if chain.get("bricks") else None
        tiles_item = make_item_id(chain["tiles"]) if chain.get("tiles") else None
        chiseled_from_liso = [make_item_id(name) for name in chain.get("chiseled_from_liso", [])]
        chiseled_from_bricks = [make_item_id(name) for name in chain.get("chiseled_from_bricks", [])]

        for liso in liso_items:
            add_recipe(base_item, liso)

        for liso in liso_items:
            for target in chiseled_from_liso:
                add_recipe(liso, target)
            if bricks_item:
                add_recipe(liso, bricks_item)
            if tiles_item:
                add_recipe(liso, tiles_item)

        if bricks_item:
            for target in chiseled_from_bricks:
                add_recipe(bricks_item, target)
            if tiles_item:
                add_recipe(bricks_item, tiles_item)

    recipes.sort(key=lambda r: (r.output_item, r.input_item))
    return recipes


def render_recipes(recipes: Iterable[StonecutterRecipe]) -> None:
    env = Environment(loader=FileSystemLoader(str(TEMPLATE_DIR)))
    template = env.get_template("recipe_stonecutter.json.j2")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    for existing in OUTPUT_DIR.glob("*.json"):
        existing.unlink()

    for recipe in recipes:
        rendered = template.render(
            identifier=recipe.identifier(),
            ingredient=recipe.input_item,
            result_item=recipe.output_item,
            count=recipe.count,
        )
        output_path = OUTPUT_DIR / recipe.filename()
        output_path.write_text(rendered, encoding="utf-8")


def main() -> None:
    recipes = build_recipes()
    render_recipes(recipes)
    print(len(recipes), "receitas de cortador de pedra geradas com sucesso.")


if __name__ == "__main__":
    main()
