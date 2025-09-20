from jinja2 import Environment, FileSystemLoader
import os

# Configurações
TEMPLATE_DIR = ""
OUTPUT_DIR = "Data/blocks"
TXT_FILE = "blocks.txt"  # cada linha contém o nome de um bloco

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
env = Environment(loader=FileSystemLoader(TEMPLATE_DIR))
template = env.get_template("blocks.json.j2")

# Garante que a pasta de saída existe
os.makedirs(OUTPUT_DIR, exist_ok=True)
total = 0
# Lê nomes do arquivo .txt
with open(TXT_FILE, "r", encoding="utf-8") as f:
    block_names = [
        line.strip()
        for line in f
        if line.strip() and not line.strip().startswith("##") and not line.strip().startswith("-")
    ]

# Gera arquivos com base no template
for name in block_names:
    total = total+1
    value = get_value_from_name(name)
    output = template.render(name=name, value=value)
    output_path = os.path.join(OUTPUT_DIR, f"{name}.json")
    with open(output_path, "w", encoding="utf-8") as out_file:
        out_file.write(output)

print(total, "blocos gerados com sucesso.")