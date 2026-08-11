from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TARGET_DIRS = [ROOT / "BP", ROOT / "RP", ROOT / "tools", ROOT / "Upcoming"]
SKIP_DIR_NAMES = {"node_modules", ".git", ".venv", "builds", "_unpacked"}
ALLOWED_SUFFIXES = {
    ".json",
    ".js",
    ".ts",
    ".lang",
    ".md",
    ".txt",
    ".py",
    ".j2",
    ".mcmeta",
}

REPLACEMENTS = [
    ("dorios_atelier:itemGroup.name.", "dorios_atelier:itemGroup.name."),
    ("tile.dorios_atelier:", "tile.dorios_atelier:"),
    ("item.dorios_atelier:", "item.dorios_atelier:"),
    ("dorios_atelier:", "dorios_atelier:"),
]


def should_skip(path: Path) -> bool:
    return any(part in SKIP_DIR_NAMES for part in path.parts)


def migrate_file(path: Path) -> tuple[bool, int]:
    text = path.read_text(encoding="utf-8")
    updated = text
    total_replacements = 0

    for old, new in REPLACEMENTS:
        count = updated.count(old)
        if count:
            updated = updated.replace(old, new)
            total_replacements += count

    if updated == text:
        return False, 0

    path.write_text(updated, encoding="utf-8")
    return True, total_replacements


def iter_candidate_files() -> list[Path]:
    candidates: list[Path] = []
    for base_dir in TARGET_DIRS:
        if not base_dir.exists():
            continue
        for path in base_dir.rglob("*"):
            if not path.is_file():
                continue
            if should_skip(path):
                continue
            if path.suffix.lower() not in ALLOWED_SUFFIXES:
                continue
            candidates.append(path)
    return candidates


def main() -> None:
    changed_files = 0
    replaced_tokens = 0

    for file_path in iter_candidate_files():
        changed, replacement_count = migrate_file(file_path)
        if changed:
            changed_files += 1
            replaced_tokens += replacement_count

    print(f"Changed files: {changed_files}")
    print(f"Replaced tokens: {replaced_tokens}")


if __name__ == "__main__":
    main()
