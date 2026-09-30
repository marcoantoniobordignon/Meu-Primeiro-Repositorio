# Ninho

App PWA de gestação e primeiro ano do bebê, em pt-BR. Next.js 15 (App Router), TypeScript strict, Tailwind 4 com tokens do design system, Supabase.

As specs de produto ficam em [`specs/`](specs/00-LEIA-PRIMEIRO.md); as regras do projeto, em [`CLAUDE.md`](CLAUDE.md).

## Rodar

```bash
pnpm install
pnpm dev        # http://localhost:3000
```

Sem `.env.local`, o app roda 100 % local (sessão anônima e dados no aparelho). Para ligar o Supabase, copie `.env.example` para `.env.local` e preencha.

## Verificar

```bash
pnpm lint
pnpm typecheck
pnpm test        # compila o banco de conteúdo antes (checagem CON-07 inclusa)
pnpm build
```

## Conteúdo

Os textos ficam em `content/*.md` (frontmatter + cards separados por `---`). `pnpm conteudo:build` gera `src/conteudo/banco.json`; roda sozinho antes de `test` e `build`. O teste em `src/lib/conteudo/stories.test.ts` barra "sempre", "nunca" e "garantido" e exige a frase de encaminhamento no fim de toda story de saúde.

## Estado

| Spec | Status |
|---|---|
| 01 Arquitetura | parcial: repo, tokens, PWA instalável, sessão anônima local, coleções locais (sem outbox/sync) |
| 02 Design system | parcial: tokens, tema, Botão, Card, Chip, Anel, Progresso, Faixa, Sheet, Toast, TabBar, Story, Vazio, Skeleton |
| 03 Fundação e navegação | parcial: TabBar, "+", Eu mínimo, placeholders de Bebê e Enxoval |
| 04 Onboarding | **pronta** |
| 05 Home da gestação | **pronta** (dados locais) |
| 06 Sintomas e diário | **pronta** (dados locais) |
| 07 Conteúdo semanal | pronta, exceto `/admin/conteudo` (precisa de Supabase) |
| 08 Registro por voz | transcrição no aparelho + parser local; Edge Function com LLM e fallback por gravação ficam para o Supabase |
| 09 Home do bebê e registros | **pronta** (dados locais) |
| 10 Previsão de soneca | pronta; o push do aviso é a spec 13 |
| 11 Virada do parto | **pronta** (dados locais) |
| 12 Cuidadores | modelo, permissões e telas prontos; aceitar convite só no mesmo aparelho até haver servidor |

## Voz

`tests/voz/frases.json` é o corpus do parser local (frase → registros esperados). Rode `pnpm vitest run src/lib/voz` depois de mexer no parser. O mesmo corpus serve para comparar o modelo da Edge Function quando ela existir.

Ver [`CHANGELOG.md`](CHANGELOG.md).
