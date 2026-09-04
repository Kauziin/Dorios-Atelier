# Plano de variantes futuras

Este documento resume o catálogo de `future-variant-plan.json`. Nada desta lista participa da geração ativa: todas as famílias continuam com o estado `planned_textures_missing` até a aprovação das texturas e dos rendimentos das receitas.

## Regras comuns

- Todo bloco decorativo novo recebe, quando liberado, laje, escada, laje vertical e muro.
- Formatos vanilla são sempre reutilizados. O Atelier cria somente o formato ausente.
- `three_step_stairs` permanece proibido.
- Geometrias, traits e posicionamento seguem o BlocksWithTraits; blocos sólidos conduzem redstone.
- Cada subtipo terá uma receita explícita e uma receita de reset para a matéria-prima da família.
- A política ativa em `variant-policy.json` não será alterada enquanto as texturas estiverem ausentes.

## Famílias e progressões

| Família | Progressão proposta | Complementos de formato |
| --- | --- | --- |
| Netherrack Endurecida | netherrack → endurecida → polida → tijolos → ladrilhos; cinzelada e rachadas como ramificações | manter laje/escada/laje vertical da netherrack comum e planejar apenas seu muro; todos os sete blocos endurecidos recebem os quatro formatos |
| Terra | terra → terra compactada → terra suave ou cortada → tijolos → ladrilhos; cinzelada sai da cortada | não criar formatos da terra crua; iniciar os formatos na terra compactada |
| Areia | areia → areia compactada → areia suave ou cortada → tijolos → ladrilhos; cinzelada sai da cortada | não usar receita 2×2, para não disputar com arenito; só a areia crua mantém queda por gravidade |
| Arenito | preservar arenito, liso, cortado e cinzelado vanilla | amarelo e vermelho: somente lajes, escadas, lajes verticais e muros realmente ausentes no vanilla |
| Ardosiabissal | preservar a progressão vanilla de pedregosa, polida, tijolos e ladrilhos | completar os quatro formatos da ardosiabissal crua e os muros das versões cinzelada e rachadas; manter os formatos já existentes |
| Prismarinho | prismarinho → polido → cortado; tijolos vanilla → ladrilhos; cinzelado e rachados como ramificações | muro dos tijolos vanilla; seis blocos decorativos novos com a matriz completa |
| Prismarinho Escuro | escuro → polido → tijolos → ladrilhos; cinzelado e rachados como ramificações | muro do bloco vanilla; seis blocos decorativos novos com a matriz completa |
| Bloco de Púrpura | púrpura → tijolos → ladrilhos; cinzelado e rachados como ramificações | manter laje/escada vanilla, laje vertical atual e planejar o muro; o pilar vanilla não será duplicado |
| Bloco de Enxofre | enxofre → polido → cortado → tijolos → ladrilhos; cinzelado e rachados como ramificações | completar os quatro formatos do bloco-base e dos sete blocos decorativos |
| Bloco de Cinábrio | cinábrio → polido → cortado → tijolos → ladrilhos; cinzelado e rachados como ramificações | completar os quatro formatos do bloco-base e dos sete blocos decorativos |

## Receita-base da netherrack endurecida

A entrada da progressão fica fixada como uma receita 2×2: quatro `minecraft:netherrack` produzem duas `dorios_atelier:hardened_netherrack`. O reset de uma netherrack endurecida retorna duas netherracks; receitas decorativas devem preservar essa equivalência para não criar duplicação.

## Decisões ainda dependentes de arte ou balanceamento

- Rendimentos da progressão própria de terra e areia.
- Texturas finais e nomes localizados de todos os IDs novos.
- Se a areia vermelha ganhará uma progressão granular própria; ela não foi incluída automaticamente.
- Componentes especiais de enxofre e cinábrio. Sons, mineração, emissão de luz e riscos não devem ser presumidos antes de inspecionar os blocos-base finais da versão-alvo.

O plano contém 50 blocos decorativos completos candidatos. Com seus formatos e os formatos ausentes de fontes vanilla, o teto atual é de 289 definições futuras; esse número é deliberadamente uma estimativa de escopo, não autorização para geração.
