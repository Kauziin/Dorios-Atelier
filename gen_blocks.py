from pathlib import Path

from jinja2 import Environment, FileSystemLoader

# Configurações
BASE_DIR = Path(__file__).resolve().parent
TEMPLATE_DIR = BASE_DIR
OUTPUT_DIR = BASE_DIR / "Data" / "blocks"
TXT_FILE = BASE_DIR / "blocks.txt"  # cada linha contém o nome de um bloco

# Mapeamento de categorias -> valores
CATEGORY_VALUES = {
    "smooth": 1.35,
    "cracked": 1.4,
    "polished": 1.5,
    "bricks": 1.5,
    "tiles": 1.6,
    "chiseled": 1.6,
}

def get_value_from_name(name: str) -> float | None:
    for keyword, value in CATEGORY_VALUES.items():
        if keyword in name.lower():
            return value
    return 1.5  # ou um valor padrão


# Carrega o template
env = Environment(loader=FileSystemLoader(str(TEMPLATE_DIR)))
template = env.get_template("blocks.json.j2")

def load_block_names(source: Path) -> list[str]:
    """Read block identifiers, normalizing markers and avoiding duplicates."""
    seen: set[str] = set()
    blocks: list[str] = []
    for raw_line in source.read_text(encoding="utf-8").splitlines():
        stripped = raw_line.strip()
        if not stripped or stripped.startswith("##"):
            continue

        normalized = stripped.lstrip("+- ").split("#", 1)[0].strip().lower()
        if not normalized or normalized in seen:
            continue

        seen.add(normalized)
        blocks.append(normalized)

    return blocks


block_names = load_block_names(TXT_FILE)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

for name in block_names:
    value = get_value_from_name(name)
    output = template.render(name=name, value=value)
    output_path = OUTPUT_DIR / f"{name}.json"
    output_path.write_text(output, encoding="utf-8")

print(len(block_names), "blocos gerados com sucesso.")