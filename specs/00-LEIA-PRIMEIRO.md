# Ninho · specs de implementação

App de gestação e bebê em pt-BR. Um só app, da semana 4 ao primeiro ano: acompanhamento semanal, sintomas, conteúdo do dia, virada automática no parto, registro do bebê por voz, previsão de soneca, cuidadores, assinatura.

Stack fixada: **Next.js 15 (App Router) PWA + Supabase (Postgres, Auth, Storage, Edge Functions) + TypeScript**. Detalhes em `01-arquitetura.md`.

## Como usar com o Claude Code

1. Crie o repositório e cole `CLAUDE.md` (abaixo) na raiz.
2. Copie a pasta `specs/` para dentro do repo.
3. Implemente **uma spec por sessão**, na ordem abaixo. Abra a sessão com: `Leia CLAUDE.md, specs/01 e specs/02, depois implemente specs/0N por completo. Não avance para outra spec. Ao final, rode lint, typecheck e testes e liste os critérios de aceite marcando o que passou.`
4. Só marque a spec como pronta quando todos os critérios de aceite passarem. Regras de negócio numeradas viram testes.

## Ordem de implementação

| # | Spec | Entrega de ponta a ponta |
|---|------|--------------------------|
| 01 | Arquitetura | repo, Supabase, PWA instalável, auth anônima |
| 02 | Design system | tokens, componentes base, tema claro e escuro |
| 03 | Fundação e navegação | shell com 4 abas e "+", modos gestação/bebê |
| 04 | Onboarding | primeiro valor antes do cadastro |
| 05 | Home da gestação | anel de semanas, saudação, próxima consulta |
| 06 | Sintomas | chips com check, diário |
| 07 | Conteúdo semanal | stories do dia, banco por semana |
| 08 | Registro por voz | microfone, transcrição, interpretação, confirmação |
| 09 | Home do bebê e registros | tiles "há X", timers, registro manual |
| 10 | Previsão de soneca | janela de vigília calibrada |
| 11 | Virada do parto | gestação → bebê, 7 dias de cortesia |
| 12 | Cuidadores | convite com papéis, uma assinatura para todos |
| 13 | Notificações | push web, no máximo 2 por dia |
| 14 | Paywall e assinatura | Stripe, R$ 19,90 / R$ 149,90, cupom |
| 15 | Analytics | dicionário de eventos GA4 |

`schema.sql` consolida o modelo de dados de todas as specs; aplique como primeira migration e evolua por migrations nomeadas pela spec (`0004_onboarding.sql`).

## CLAUDE.md sugerido

```md
# Ninho
App PWA de gestação e bebê em pt-BR. Next.js 15 App Router, TypeScript strict, Tailwind com tokens do design system, Supabase.

## Regras inegociáveis
- Toda cor, raio, espaçamento e fonte vem de `src/styles/tokens.css` e `tailwind.config.ts`. Nunca hex solto em componente.
- Componentes base em `src/components/ui`. Telas só compõem; não estilizam do zero.
- Texto em português do Brasil, tom "a gente", frases curtas, sem jargão médico sem explicação. Copy fica em `src/copy/*.ts`, nunca inline.
- Funciona offline para leitura e registro: escrita vai para fila local (IndexedDB) e sincroniza. Nunca tela em branco sem rede.
- Nenhum dado de saúde sai do Supabase do projeto. Nada de SDK de terceiros com dados de registro.
- Dark mode obrigatório em toda tela (madrugada).
- Acessibilidade: alvo de toque mínimo 44 px, contraste AA, `aria-label` em ícones, foco visível.
- Eventos de analytics só pelos nomes de `specs/15-analytics.md`, via `track()` em `src/lib/analytics.ts`.
- Cada spec implementada gera: migration, tipos gerados (`supabase gen types`), testes das regras RN-*, e um item em CHANGELOG.md.

## Comandos
pnpm dev · pnpm lint · pnpm typecheck · pnpm test · pnpm supabase:types

## Não fazer
- Não instalar UI kit externo (shadcn é permitido como base copiada, nunca como dependência de estilo).
- Não criar feature fora da spec da sessão.
- Não pedir cadastro antes do momento definido em specs/04.
```

## Definição de pronto (vale para toda spec)

- Critérios de aceite passam manualmente no iPhone (Safari, instalado na tela inicial) e num Android (Chrome).
- Estados cobertos: sem rede, sem dados ainda, retorno após 30 dias fora, tema escuro.
- `pnpm lint && pnpm typecheck && pnpm test` verdes.
- Eventos da spec aparecem no DebugView do GA4.
