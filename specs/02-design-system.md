# 02 · Design system

## Problema
Toda tela nova precisa sair com a mesma cara do mockup aprovado (teal do Huckleberry, creme e tipografia da Clue, herói e stories do Flo) sem repetir decisões de cor e espaçamento a cada sessão.

## Escopo desta versão
- `src/styles/tokens.css` com todos os tokens em claro e escuro; `tailwind.config.ts` lendo só esses tokens.
- Fontes: Outfit (300, 400, 500, 600) e EB Garamond itálica (400, 500) via `next/font`, self-hosted, `display: swap`.
- Componentes base em `src/components/ui`: Botão, Card, Chip, Anel, Tile, Story, Sheet, TabBar, Toast, Faixa (aviso), Skeleton, Vazio (estado vazio).
- Storybook não entra; uma rota `/dev/ui` lista todos os componentes em todos os estados, nos dois temas.

## Fora de escopo
- Ilustrações e mascote. Ícones vêm do Lucide, sempre dentro de círculo colorido.
- Animações além das listadas.

## Tokens
```css
:root{
  --cor-primaria:#31BCD3;  --cor-primaria-texto:#158FA3;  --cor-primaria-suave:#DDF4F7;
  --cor-acento:#F0707D;    --cor-acento-suave:#FDE3E5;
  --fundo:#FAF6F4; --superficie:#FFFFFF; --texto:#2B2A28; --texto-mudo:#7A7570; --fio:#EDE6E1;
  --reg-sono:#7B6FE0; --reg-mamada:#F0707D; --reg-fralda:#F2B441; --reg-banho:#5CC8A8;
  --erro:#D7263D; --sucesso:#2E9E6B;
  --raio:18px; --raio-pilula:999px;
  --esp-1:4px; --esp-2:8px; --esp-3:12px; --esp-4:16px; --esp-5:24px; --esp-6:32px; --esp-7:48px;
  --fonte:"Outfit",system-ui,sans-serif; --fonte-serifa:"EB Garamond",Georgia,serif;
}
[data-tema="escuro"]{
  --fundo:#171513; --superficie:#221F1C; --texto:#F1ECE7; --texto-mudo:#A29B94; --fio:#2E2A26;
  --cor-primaria-texto:#6FD0E0; --cor-primaria-suave:#153840; --cor-acento-suave:#3A2427;
}
```
Regra de significado: teal é "o app" (ação, progresso, aba ativa); coral é "você agora" (marcador do dia, chip selecionado, mamada); as quatro cores de registro só aparecem em sono, mamada, fralda e banho. Nunca sombra, exceto o botão "+" flutuante (`0 8px 18px rgba(49,188,211,.4)`).

## Tipografia
| Papel | Fonte | Tamanho/peso | Uso |
|---|---|---|---|
| Herói | Outfit 300 | 54 px, tracking -0.03em, tabular | número do anel, contador do tile |
| Rótulo do herói | EB Garamond itálica 500 | 15 px | "semanas", "meses e 2 semanas" |
| Saudação | Outfit 500 | 16 px | "Bom dia, *Helena*" (nome em itálica) |
| Título de seção | Outfit 500 | 13 px | "Hoje para você" |
| Corpo | Outfit 400 | 14 px, lh 1.4 | textos |
| Meta | Outfit 400 | 11 px, `--texto-mudo` | "há 2 h · xixi" |
| Voz | EB Garamond itálica 400 | 14 px | frase transcrita, entre aspas |
Itálica só nestes três lugares. Nunca em parágrafo.

## Componentes e estados
- **Botão** `variant: primario | secundario | fantasma`, `tamanho: md | lg`. Pílula, altura mín. 44, Outfit 500. Estados: normal, pressionado (escurece 8 %), carregando (spinner e texto mantido), desabilitado (opacidade .45). Um primário por tela.
- **Card** superfície branca, raio 18, padding 14/16, sem borda no claro; no escuro, borda 1 px `--fio`.
- **Chip** pílula com círculo colorido 18 px à esquerda; `selecionado` troca a borda para coral e o fundo para `--cor-acento-suave`, círculo mostra check. Linha rolável cortada na borda.
- **Anel** SVG 200 px, traço 12, trilho `--fio`, progresso `--cor-primaria`, marcador do dia branco com borda coral 3 px. Props: `total`, `atual`, `segmentos?` (trimestres). Animação de 600 ms ao montar; respeita `prefers-reduced-motion`.
- **Tile** card com ícone circular (28 px, cor do registro), nome, contador "há X" em Outfit 300 15 px, meta. `ao_vivo` inverte: fundo na cor do registro, texto branco, contador correndo.
- **Story** 118 × 118, raio 18, fundo suave da categoria, círculo da cor no canto, título 11,5 px, meta "2 min · expira hoje". `lida` reduz opacidade a .6.
- **Sheet** bottom sheet com alça, raio 24 no topo, fecha por arraste e por botão. Usado em todo registro manual.
- **TabBar** 4 abas (Hoje, Bebê, Enxoval, Eu) mais "+" central 52 px elevado 30 px, com `env(safe-area-inset-bottom)`. Aba ativa em `--cor-primaria-texto` com ícone preenchido.
- **Toast** uma linha, 3 s, no topo, para confirmações ("Mamada registrada ✓"); nunca modal.
- **Faixa** aviso persistente fino no topo do conteúdo (sem rede, trial acabando).
- **Vazio** ícone em círculo, uma frase, um botão. Todo lista tem um.

## Regras de negócio
- DS-01 Nenhum componente aceita `className` com cor; cor entra por `variant` ou `cor: 'sono'|'mamada'|'fralda'|'banho'`.
- DS-02 `data-tema` segue `profiles.tema`; 'auto' usa `prefers-color-scheme`; a troca não recarrega a página.
- DS-03 Todo ícone tem `aria-label` ou está dentro de texto visível.
- DS-04 Alvo de toque mínimo 44 × 44, mesmo quando o ícone tem 18.
- DS-05 Movimento: entrada de sheet 240 ms, toast 180 ms, anel 600 ms; com `prefers-reduced-motion`, tudo instantâneo.

## Eventos
Nenhum.

## Critérios de aceite
- [ ] `/dev/ui` mostra todos os componentes nos dois temas e nenhum usa hex fora de `tokens.css` (lint com regra `no-restricted-syntax` para `#[0-9a-f]{3,6}` em `src/components` e `src/app`)
- [ ] Contraste de todo texto sobre seu fundo ≥ 4,5:1 nos dois temas (teste automatizado com axe no Playwright)
- [ ] Troco o tema em Eu → Aparência e a home muda sem recarregar
- [ ] Com "Reduzir movimento" ligado no iPhone, o anel aparece já preenchido

## Decisões em aberto
- Ícone do app e splash (precisa de arte). Pietro decide.
