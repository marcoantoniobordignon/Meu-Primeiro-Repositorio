# Ninho

App PWA de gestação e primeiro ano do bebê, em pt-BR. Next.js 15 (App Router), TypeScript strict, Tailwind 4 com tokens do design system, Supabase.

As specs de produto ficam em [`specs/`](specs/00-LEIA-PRIMEIRO.md); as regras do projeto, em [`CLAUDE.md`](CLAUDE.md).

## Rodar

```bash
pnpm install
pnpm dev        # http://localhost:3000
```

Sem `.env.local`, o app roda 100 % local (sessão anônima no aparelho). Para ligar o Supabase, copie `.env.example` para `.env.local` e preencha.

## Verificar

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Estado

| Spec | Status |
|---|---|
| 01 Arquitetura | parcial: repo, tokens, PWA instalável, sessão anônima local |
| 02 Design system | parcial: tokens, tema, Botão, Card, Chip, Anel, Progresso, Faixa |
| 03 Fundação e navegação | não iniciada (`/hoje` é um destino mínimo) |
| 04 Onboarding | **pronta** |

Ver [`CHANGELOG.md`](CHANGELOG.md).
