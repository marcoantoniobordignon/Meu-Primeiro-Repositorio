# Changelog

## Não lançado

### Spec 07 · Conteúdo semanal e stories
- Banco de conteúdo em markdown (`content/*.md`, frontmatter + cards separados por `---`) compilado para `src/conteudo/banco.json` por `pnpm conteudo:build` (roda antes de `test` e `build`). As 42 stories "Semana X: o que muda" nascem de `conteudo-semanas.json`. Vai inteiro no bundle, então lê offline (CON-06).
- 35 artigos iniciais: toda semana de 1 a 42 tem ao menos 2 além da story da semana; todo mês do bebê de 0 a 12 tem ao menos 1. Seis são premium.
- Stories do dia na home: story da semana + 2 elegíveis, não lidas primeiro, `dia_da_semana` de hoje primeiro, ordem aleatória com semente = data (CON-01); modo bebê usa `mes_bebe` (CON-02); lida fica esmaecida e sai no dia seguinte (CON-04).
- Leitor em tela cheia: cards por toque, progresso segmentado, guardar, card de bloqueio para premium sem plano (CON-05).
- `/eu/guardados` (CON-03).
- Checagem CON-07 como teste: nenhum texto usa "sempre", "nunca" ou "garantido" e toda story de saúde termina com "Na dúvida, fale com quem te acompanha."; o build falha sem isso (`pretest`/`prebuild`).
- Fora: painel `/admin/conteudo` (precisa de Supabase e allowlist).

### Spec 06 · Sintomas e diário
- Catálogo de 28 sintomas em `supabase/seed/sintomas.json` (rascunho para revisão), com grupo e faixas de semanas frequentes.
- Chips na home: registrados hoje primeiro + frequentes da semana, até 5, e o "+" (SIN-01); um toque registra leve, outro remove (SIN-02); "Chutes" e "Contrações" abrem os sheets (SIN-04).
- Sheet "Como você está hoje?" por grupo; toque cicla leve → incômodo → forte → remove (SIN-03); nota livre.
- Entre 0h e 4h pergunta "Ainda é ontem?" uma vez por sessão (SIN-05).
- `/hoje/diario` por dia com filtro por sintoma, edição até 30 dias (SIN-08), linha "Vale comentar na próxima consulta" após 3 dias fortes (SIN-07), estado vazio com "Registrar hoje".
- `/hoje/diario/resumo`: grade dia × sintoma dos últimos 14 dias e "Copiar como texto" no formato da SIN-06, com fallback selecionável.
- Os sintomas da tela 5 do onboarding agora gravam na mesma coleção.

### Spec 05 · Home da gestação
- `/hoje`: saudação por hora (HG-04), anel de 40 semanas com trimestres, cheio depois da 40 (HG-02), legenda "N semanas para o parto" / "pode ser a qualquer momento" / "X dias além da data" (HG-03), pílula "Como você está hoje?", chips, stories, card da próxima consulta.
- Consultas: sheet de criar/editar, lista em `/eu/consultas`, marcar realizada. Card fica coral a partir de 24 h antes (HG-05); passada sem marcar pergunta "Foi bem?" por 3 dias (HG-06).
- Contador de chutes: encerra sozinho em 10 chutes ou 2 h com toast; a sessão aparece no diário do dia (HG-07).
- Timer de contrações com duração e intervalo das últimas 6; aviso "Padrão de trabalho de parto. Fale com sua equipe." com 6 em 1 h, ≥ 45 s e intervalo ≤ 5 min (HG-08), sem palavra de diagnóstico.
- Cards na home enquanto há contagem de chutes ou contração recente.

### Fundação (specs 01–03, parcial)
- Coleções locais (`src/lib/dados`) no formato de registro da spec 01 (id no cliente, `atualizado_em`, `apagado_em`), reativas via `useSyncExternalStore`; a outbox de sincronização entra sem mudar as telas.
- TabBar com 4 abas e "+" central; `/registrar` com sintoma, chutes, contrações e consulta (NAV-04); `/bebe` e `/enxoval` como placeholders; `/eu` com nome, DPP, tema, atalhos e "apagar tudo".
- Componentes novos: Sheet, Toast, TabBar, Story, Vazio, Skeleton, Cabeçalho.

### Spec 04 · Onboarding
- Fluxo de 7 telas, uma pergunta por tela, barra de progresso sempre visível e "pular" da tela 4 em diante.
- Momento de valor na tela 3: anel com a semana, dias, trimestre, semanas para o parto, comparação de tamanho e o que muda esta semana, tudo antes de pedir nome.
- DPP direta ou calculada pela DUM (+280 dias), editável; DPP no passado pergunta "o bebê já nasceu?" e vira modo bebê (ONB-01, ONB-02).
- Conteúdo das 42 semanas embutido no bundle; a tela 3 abre sem rede (ONB-03).
- Rascunho do fluxo em localStorage: fechar e voltar retoma na mesma tela por até 7 dias (ONB-04).
- Instalação do PWA guiada por sistema e pedido de push só depois de instalado (ONB-05).
- Cadastro só na última tela e pulável; pular mantém a sessão anônima e a Hoje mostra a faixa "Guardar minha linha do tempo" por 3 dias (ONB-06).
- Voltar sempre possível, exceto da tela 3 para a 2 depois de gravar a DPP (ONB-08).

### Base do projeto
- Next.js 15 App Router, TypeScript strict, Tailwind 4 lendo só `src/styles/tokens.css`, Vitest, ESLint com regra que barra hex fora dos tokens.
- Tokens claro/escuro, fontes Outfit e EB Garamond via `next/font`, `data-tema` com `auto | claro | escuro`.
- `lib/dates.ts` (semana gestacional, DPP/DUM, idade do bebê, legendas, formatação) com testes.
- Sessão anônima local, com Supabase opcional por variáveis de ambiente. Manifest do PWA e ícones.
