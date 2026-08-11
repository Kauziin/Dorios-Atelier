from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LANG_FILES = [
    ROOT / "RP/texts/en_US.lang",
    ROOT / "RP/texts/pt_BR.lang",
    ROOT / "RP/texts/es_MX.lang",
]


def dedupe_lang_file(path: Path) -> int:
    if not path.exists():
        return 0

    lines = path.read_text(encoding="utf-8").splitlines()
    key_occurrences: dict[str, list[int]] = {}

    for idx, line in enumerate(lines):
        stripped = line.strip()
        if not stripped or stripped.startswith("##") or "=" not in line:
            continue
        key = line.split("=", 1)[0]
        key_occurrences.setdefault(key, []).append(idx)

    duplicate_indices: set[int] = set()
    for indices in key_occurrences.values():
        if len(indices) <= 1:
            continue
        duplicate_indices.update(indices[:-1])

    if not duplicate_indices:
        return 0

    new_lines = [line for idx, line in enumerate(lines) if idx not in duplicate_indices]
    path.write_text("\n".join(new_lines).rstrip("\n") + "\n", encoding="utf-8")
    return len(duplicate_indices)


def main() -> None:
    removed_total = 0
    for lang_file in LANG_FILES:
        removed_total += dedupe_lang_file(lang_file)
    print(f"Removed duplicate entries: {removed_total}")


if __name__ == "__main__":
    main()
