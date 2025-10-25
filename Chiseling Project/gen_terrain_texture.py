from __future__ import annotations

import json
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
BLOCK_TEXTURE_DIR = BASE_DIR / "Assets" / "blocks"
BLOCKS_LIST = BASE_DIR / "blocks.txt"
OUTPUT_FILE = BASE_DIR / "Assets" / "terrain_texture.json"


def load_block_names(source: Path) -> list[str]:
    """Return normalized block identifiers listed in the source file."""
    seen: set[str] = set()
    names: list[str] = []

    for raw_line in source.read_text(encoding="utf-8").splitlines():
        stripped = raw_line.strip()
        if not stripped or stripped.startswith("##"):
            continue

        normalized = stripped.lstrip("+- ").split("#", 1)[0].strip().lower()
        if not normalized or normalized in seen:
            continue

        seen.add(normalized)
        names.append(normalized)

    return names


def collect_texture_entries() -> tuple[dict[str, dict[str, str]], dict[str, str]]:
    """Build terrain texture entries and a lookup of available stems."""
    entries: dict[str, dict[str, str]] = {}
    stems: dict[str, str] = {}

    for texture_path in sorted(BLOCK_TEXTURE_DIR.glob("*.png")):
        stem = texture_path.stem
        key = f"twm_{stem.lower()}"
        entries[key] = {"textures": f"textures/blocks/{stem}"}
        stems[stem.lower()] = stem

    return entries, stems


def main() -> None:
    BLOCK_TEXTURE_DIR.mkdir(parents=True, exist_ok=True)

    entries, stems = collect_texture_entries()
    block_names = load_block_names(BLOCKS_LIST) if BLOCKS_LIST.exists() else []
    missing = [name for name in block_names if name not in stems]

    data = {
        "resource_pack_name": "twm",
        "texture_name": "atlas.terrain",
        "padding": 8,
        "num_mip_levels": 4,
        "texture_data": entries,
    }

    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_FILE.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")

    print(len(entries), "texturas listadas no terrain_texture.")
    if missing:
        print("Texturas ausentes para:", ", ".join(missing))


if __name__ == "__main__":
    main()
