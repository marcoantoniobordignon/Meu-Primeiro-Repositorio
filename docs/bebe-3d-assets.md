# Bebê 3D · especificação de assets

Esta é a especificação para comprar ou encomendar o modelo definitivo do bebê da aba 3D. O placeholder atual é gerado por código (`src/lib/bebe3d/malha.ts`); trocar pelo modelo definitivo é colocar o arquivo em `public/bebe3d/bebe.glb` e seguir os nomes abaixo. O esqueleto, as animações e o shader de pele continuam os mesmos.

**Nunca use modelo sem licença comercial clara.** Registre origem e licença em `public/bebe3d/MANIFESTO.md`.

## Estágios-chave e interpolação

| Estágio (semanas) | O que muda no corpo |
|---|---|
| 8 | embrião: cabeça metade do corpo, brotos de membros, cauda sumindo |
| 12 | feto: dedos separados, pálpebras fundidas, perfil humano |
| 16 | pescoço definido, orelhas na posição final, membros proporcionais |
| 20 | **estágio base** (fatia vertical): vérnix, lanugo, proporção 1:3 cabeça/corpo |
| 24 | pele enrugada e translúcida, sobrancelhas |
| 28 | olhos abrem, gordura começa, pele menos vermelha |
| 32 | corpo arredondado, unhas |
| 36 | bochechas cheias, lanugo cai |
| 40 | termo: proporção 1:4 cabeça/corpo, pele opaca |

Um **único modelo base** (semana 20) com topologia fixa e **um blend shape por estágio** (9 alvos: `estagio_08` … `estagio_40`). As semanas intermediárias são interpolação linear entre os dois estágios vizinhos (pesos somam 1) mais a escala contínua de `escalaDaSemana()` em `src/lib/bebe3d/semanas.ts`. Com topologia fixa a troca de semana é contínua, sem corte.

## Malha

- Uma malha só (`Bebe`), quad-dominante, sem sobreposição de UV.
- LOD0: ~25 000 triângulos. LOD1: ~10 000. LOD2: ~4 000. Nomes `Bebe_LOD0`, `Bebe_LOD1`, `Bebe_LOD2`, mesmo esqueleto.
- Olhos como malha separada (`Olhos`) com córnea, para o brilho do olhar depois da semana 28.
- Pose de repouso: fetal, igual ao placeholder (ver `src/lib/bebe3d/esqueleto.ts`): cabeça inclinada à frente, braços dobrados na frente do peito, mãos perto do rosto, joelhos flexionados.
- Unidades: metros no glTF (o app escala); o modelo deve medir 1,3 u da cabeça ao bumbum na pose fetal.

## Esqueleto (36 ossos; os 19 abaixo são obrigatórios e têm estes nomes)

```
pelvis
└ coluna
  └ torax
    ├ pescoco
    │ └ cabeca
    ├ braco_E  → antebraco_E → mao_E → dedos_E
    └ braco_D  → antebraco_D → mao_D → dedos_D
pelvis
├ coxa_E → canela_E → pe_E
└ coxa_D → canela_D → pe_D
```

Opcionais, usados se existirem: `coluna_2`, `mandibula`, `olho_E`, `olho_D`, dedos individuais (`polegar_E_1..3`, `indicador_E_1..3`, …), `dedos_pe_E`, `dedos_pe_D`. Eixos: Y para cima, o rosto aponta para +Z. Até 4 influências por vértice.

## Blend shapes (além dos 9 de estágio)

| Nome | Uso |
|---|---|
| `piscar_E`, `piscar_D` | piscar (semana 26+) |
| `boca_aberta` | bocejo e sucção |
| `succao` | polegar na boca |
| `sorriso` | raro, semana 30+ |

## Texturas (2048², KTX2)

| Mapa | Formato | Observação |
|---|---|---|
| `albedo` | ETC1S | pele clara rosada, sem maquiagem; vérnix pintado leve nas dobras |
| `normal` | UASTC | poros finos, dobras das articulações |
| `roughness` | ETC1S | mais brilho em lábios e pálpebras (úmidos) |
| `thickness` | ETC1S | **obrigatório para o SSS**: 0 nas orelhas, dedos e pálpebras; 1 no crânio e no tronco |
| `detail_normal` (opcional) | UASTC | 512², tile 8× |

## Animações (clipes no glTF, 30 fps, loopáveis)

| Clipe | Duração | Nota |
|---|---|---|
| `repouso` | 10 s | deriva mínima, respiração |
| `respirar` | 6 s | tórax, aditivo |
| `maos_abrir_fechar` | 4 s | dedos, aditivo |
| `polegar_boca` | 6 s | braço direito ao rosto, segura, volta |
| `chute` | 1,5 s | perna esquerda; o app espelha para a direita |
| `espreguicar` | 4 s | corpo inteiro |
| `virar_cabeca` | 4 s | olha para a esquerda e volta |
| `soluco` | 1 s | tranco no diafragma, aditivo |

O controlador (`src/lib/bebe3d/animacao.ts`) mistura clipes aditivos por cima do repouso, com entrada e saída suaves; se um clipe não existir, o procedural equivalente assume.

## Formato e tamanho

- glTF 2.0 binário (`.glb`) com compressão **Meshopt** (`EXT_meshopt_compression`) e texturas **KTX2** (`KHR_texture_basisu`).
- Orçamento: LOD2 + texturas 1024² ≤ 400 KB (vai primeiro); LOD0 + 2048² ≤ 2,5 MB (carrega em segundo plano).
- Validar com `gltf-validator`; sem materiais extras (o app aplica a pele).

## Onde comprar ou encomendar

- Marketplaces com licença comercial explícita para app: TurboSquid (licença *Standard* ou *Editorial + Commercial*), CGTrader (*Royalty Free* com uso em software). Buscar "fetus", "unborn baby", "fetal development stages".
- Encomenda a artista: pacote típico (modelo base + 9 blend shapes + rig + 8 clipes + texturas) entre US$ 1 500 e 4 000; prazo de 4 a 8 semanas.
- Pedir sempre: licença perpétua, uso em aplicativo comercial, direito de modificar, sem obrigação de crédito visível.
