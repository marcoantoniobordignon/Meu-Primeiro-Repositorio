# Ninho

App PWA de gestação e primeiro ano do bebê, em pt-BR. Next.js 15 (App Router), TypeScript strict, Tailwind 4 com tokens do design system, Supabase (Postgres com RLS, Auth anônima, Edge Functions), offline-first.

As specs de produto ficam em [`specs/`](specs/00-LEIA-PRIMEIRO.md); as regras do projeto, em [`CLAUDE.md`](CLAUDE.md).

## Rodar

```bash
pnpm install
pnpm dev        # http://localhost:3000
```

Sem `.env.local`, o app roda 100 % local (sessão anônima e dados no aparelho, nada sincroniza). Para ligar o Supabase:

```bash
pnpm supabase:start            # Postgres + Auth + Studio locais (precisa do Supabase CLI e Docker)
pnpm supabase:reset            # aplica supabase/migrations e supabase/seed.sql
cp .env.example .env.local     # NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY do `supabase status`
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... pnpm conteudo:sync   # banco de conteúdo + catálogo de sintomas
pnpm supabase:functions        # serve as Edge Functions; a de voz precisa de ANTHROPIC_API_KEY em supabase/.env
```

Na nuvem: `supabase link`, `supabase db push`, `supabase functions deploy interpretar-registro` e `supabase secrets set ANTHROPIC_API_KEY=...`. Deploy do app na Vercel com as duas variáveis públicas.

## Deploy na Vercel

O projeto é importado do GitHub com o preset Next.js; nada precisa ser configurado. Cada push na `main` gera um deploy de produção; cada PR gera um preview. Sem variáveis de ambiente o app sobe em modo 100 % local. Para ligar o Supabase, adicione `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` em *Settings → Environment Variables* e faça um redeploy.

## Verificar

```bash
pnpm lint
pnpm typecheck
pnpm test          # unitários (Vitest); compila o banco de conteúdo antes
pnpm build         # gera também o service worker (public/sw.js)
pnpm e2e           # Playwright, 3 fluxos críticos do app + 2 do painel, contra o build
pnpm supabase:test # pgTAP: RLS entre famílias e privacidade da mãe (precisa do Supabase local)
pnpm supabase:types # regenera src/lib/supabase/types.generated.ts (precisa do Supabase local)
```

Em container como root, o Playwright precisa de `PLAYWRIGHT_NO_SANDBOX=1` (e `PLAYWRIGHT_CHROMIUM=/caminho/do/chromium` se o navegador não for o baixado por ele).

## Como os dados fluem (spec 01)

- **Leitura**: toda tela renderiza a partir das coleções locais (`src/lib/dados`), que vivem no `localStorage`. Nunca tela em branco sem rede.
- **Escrita**: toda `salvar`/`apagar` numa coleção dispara um gancho que enfileira o registro na **outbox** (IndexedDB, `src/lib/offline/outbox.ts`). A UI já mostra o dado; a fila envia em segundo plano com retry 1 s → 4 s → 16 s → 60 s → a cada 5 min.
- **Sincronização** (`src/lib/offline/sync.ts`): ao abrir, ao voltar a rede, ao voltar para a aba e a cada minuto, empurra a outbox (upsert por `id`) e puxa o que mudou desde a última vez (`atualizado_em`), mesclando por `atualizado_em`: vence o mais novo, nunca duplica. No servidor, o trigger `manter_mais_recente` aplica a mesma regra.
- **Sessão**: anônima no primeiro toque (Supabase `signInAnonymously`); sem rede, um uid local que é promovido ao uid real quando a rede volta. Criar conta usa `linkIdentity`, então o uid não muda e nada migra.
- **Família**: `familia_id` e `criado_por` são preenchidos por trigger a partir da sessão; o cliente nunca manda. RLS filtra tudo por `membros_familia`. Sintomas e check-ins da mãe são invisíveis para avó e cuidadora.
- **Voz**: com rede, a Edge Function `interpretar-registro` (Claude Haiku 4.5, JSON estrito, prompt em cache) interpreta; sem rede ou se ela falhar, o parser local de regras assume.

## Painel de admin

`/admin` é a área da equipe: visão geral (famílias, ativas, novas, plano, uso por dia, registros por tipo, sintomas mais marcados), usuárias (distribuição por semana e mês do bebê, papéis, planos, lista de famílias sem nome nem dado de saúde), conteúdo (lista, calendário "por dia" que simula o carrossel e editor com preview e as regras da spec 07), voz (precisão da interpretação) e sistema (o que está ligado).

- **Acesso**: link mágico por e-mail; só entra quem está na tabela `admins` (`supabase/seed.sql`). As RPCs `admin_*` (`supabase/migrations/0002_admin.sql`) são `security definer` e exigem `eh_admin()`; devolvem só agregados.
- **Sem Supabase**: o painel roda em modo demonstração, com faixa avisando e números fictícios, para dar para ver e testar o layout.
- **Conteúdo editado no painel** vai para a tabela `conteudos`; o app puxa na sincronização e mescla com o bundle (o servidor vence pelo id). O bundle continua saindo de `content/*.md`.

## Conteúdo

Os textos ficam em `content/*.md` (frontmatter + cards separados por `---`). `pnpm conteudo:build` gera `src/conteudo/banco.json`; roda sozinho antes de `test` e `build`. O teste em `src/lib/conteudo/stories.test.ts` barra "sempre", "nunca" e "garantido" e exige a frase de encaminhamento no fim de toda story de saúde. `pnpm conteudo:sync` sobe o banco para a tabela `conteudos`.

## Voz

`tests/voz/frases.json` é o corpus do parser local (frase → registros esperados). Rode `pnpm vitest run src/lib/voz` depois de mexer no parser. O mesmo corpus serve para comparar modelos na Edge Function.

## Estado

| Spec | Status |
|---|---|
| 01 Arquitetura | **pronta**: migrations com RLS, auth anônima com upgrade, outbox + sync, PWA com service worker e atalhos, Edge Functions, GA4, Vitest + Playwright. Fora: Stripe (é a spec 14) e Storage (fotos, futuro) |
| 02 Design system | parcial: tokens, tema e os componentes usados até aqui; falta `/dev/ui` e o teste de contraste com axe |
| 03 Fundação e navegação | parcial: TabBar, "+", Eu mínimo, placeholders de Bebê e Enxoval; falta a faixa de retorno após 30 dias |
| 04 Onboarding | **pronta** |
| 05 Home da gestação | **pronta** |
| 06 Sintomas e diário | **pronta** |
| 07 Conteúdo semanal | pronta, exceto `/admin/conteudo` |
| 08 Registro por voz | pronta com Edge Function + parser local; falta o fallback por gravação de áudio |
| 09 Home do bebê e registros | **pronta** |
| 10 Previsão de soneca | pronta; o push do aviso é a spec 13 |
| 11 Virada do parto | **pronta** |
| 12 Cuidadores | pronta com RPCs; sem servidor, o convite vale só no mesmo aparelho. Falta o QR |
| Painel de admin | **pronto**: métricas agregadas, usuárias, conteúdo (lista, por dia, editor), voz e sistema; demonstração sem Supabase |

Ver [`CHANGELOG.md`](CHANGELOG.md).
