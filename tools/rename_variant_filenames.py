from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

TARGET_DIRS = [
    ROOT / "BP/blocks/decorative/slabs",
    ROOT / "BP/blocks/decorative/stairs",
    ROOT / "BP/blocks/decorative/unique_stairs",
    ROOT / "BP/blocks/decorative/vertical_slabs",
    ROOT / "RP/block_culling",
    ROOT / "BP/recipes/stonecutter",
]

TOKEN_REPLACEMENTS = [
    ("three_steps_stairs", "tss"),
    ("three_step_stairs", "tss"),
    ("vertical_slabs", "vslab"),
    ("vertical_slab", "vslab"),
    ("stairs", "str"),
    ("cracked", "ck"),
    ("chiseled", "ch"),
    ("polished", "pl"),
    ("smooth", "sm"),
]


def rename_text(text: str) -> str:
    updated = text
    for old, new in TOKEN_REPLACEMENTS:
        updated = updated.replace(old, new)
    return updated


def rename_files() -> tuple[int, int]:
    renamed = 0
    skipped = 0

    for directory in TARGET_DIRS:
        if not directory.exists() or not directory.is_dir():
            continue

        files = sorted([path for path in directory.iterdir() if path.is_file() and path.suffix.lower() == ".json"])
        for source in files:
            target_name = rename_text(source.name)
            if target_name == source.name:
                continue

            target = source.with_name(target_name)
            if target.exists() and target != source:
                skipped += 1
                continue

            source.rename(target)
            renamed += 1

    return renamed, skipped


def rename_vertical_slabs_dir() -> bool:
    old_dir = ROOT / "BP/blocks/decorative/vertical_slabs"
    new_dir = ROOT / "BP/blocks/decorative/vslab"
    if not old_dir.exists() or not old_dir.is_dir():
        return False
    if new_dir.exists():
        return False
    old_dir.rename(new_dir)
    return True


def main() -> None:
    renamed, skipped = rename_files()
    dir_renamed = rename_vertical_slabs_dir()

    print(f"Renamed files: {renamed}")
    print(f"Skipped collisions: {skipped}")
    print(f"Renamed directory vertical_slabs -> vslab: {dir_renamed}")


if __name__ == "__main__":
    main()
