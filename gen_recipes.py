from __future__ import annotations

from pathlib import Path

from jinja2 import Environment, FileSystemLoader

BASE_DIR = Path(__file__).resolve().parent
TEMPLATE_DIR = BASE_DIR
OUTPUT_DIR = BASE_DIR / "Data" / "recipes" / "crafting"

CHAINS: list[dict[str, object]] = [
    {
        "base": "minecraft:andesite",
        "stages": [
            "smooth_andesite",
            "andesite_bricks",
            "andesite_tiles",
        ],
    },
    {
        "base": "minecraft:basalt",
        "stages": [
            "smooth_basalt",
            "basalt_bricks",
            "basalt_tiles",
        ],
    },
    {
        "base": "minecraft:blackstone",
        "stages": [
            "smooth_blackstone",
            "blackstone_bricks",
            "blackstone_tiles",
        ],
    },
    {
        "base": "minecraft:calcite",
        "stages": [
            "smooth_calcite",
            "polished_calcite",
            "calcite_bricks",
            "calcite_tiles",
        ],
    },
    {
        "base": "minecraft:diorite",
        "stages": [
            "smooth_diorite",
            "diorite_bricks",
            "diorite_tiles",
        ],
    },
    {
        "base": "minecraft:dripstone_block",
        "stages": [
            "smooth_dripstone",
            "polished_dripstone",
            "dripstone_bricks",
            "dripstone_tiles",
        ],
    },
    {
        "base": "minecraft:granite",
        "stages": [
            "smooth_granite",
            "granite_bricks",
            "granite_tiles",
        ],
    },
    {
        "base": "minecraft:polished_basalt",
        "stages": [
            "smooth_polished_basalt",
            "polished_basalt_bricks",
            "polished_basalt_tiles",
        ],
    },
    {
        "base": "minecraft:tuff",
        "stages": [
            "smooth_tuff",
            "tuff_bricks",
            "tuff_tiles",
        ],
    },
]


def make_identifier(output_name: str) -> str:
    return f"utilitycraft:craft_{output_name}"


def make_item_id(name: str) -> str:
    return f"utilitycraft:{name}" if ":" not in name else name


def main() -> None:
    env = Environment(loader=FileSystemLoader(str(TEMPLATE_DIR)))
    template = env.get_template("recipe_2x2.json.j2")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    generated = 0

    for chain in CHAINS:
        base_item = chain["base"]
        stages = [str(stage) for stage in chain["stages"]]

        input_item = base_item
        for stage in stages:
            output_name = stage.split(":", 1)[1] if ":" in stage else stage
            output_item = make_item_id(stage)
            ingredients = [{"item": input_item} for _ in range(4)]
            rendered = template.render(
                identifier=make_identifier(output_name),
                ingredients=ingredients,
                output_item=output_item,
            )
            output_path = OUTPUT_DIR / f"{output_name}.json"
            output_path.write_text(rendered, encoding="utf-8")
            generated += 1
            input_item = output_item

    print(generated, "receitas geradas com sucesso.")


if __name__ == "__main__":
    main()
