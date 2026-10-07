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

Lembretes (funcionalidades 02–06): `supabase functions deploy enviar-lembretes acao-lembrete`, os segredos do `.env.example` (VAPID e `LEMBRETES_SEGREDO`) e um Cron no painel do Supabase (*Integrations → Cron*) chamando `POST /functions/v1/enviar-lembretes` **a cada minuto** com o header `Authorization: Bearer <LEMBRETES_SEGREDO>`. O app precisa de `NEXT_PUBLIC_VAPID_PUBLIC_KEY`. O mesmo job faz a faxina da galeria (arquivos de documentos excluídos e PDFs exportados com mais de 24 h).

Galeria de exames (funcionalidade 01): `supabase functions deploy ler-laudo`. Usa o mesmo `ANTHROPIC_API_KEY`; o modelo da leitura é `claude-opus-5-5` por padrão e muda com `supabase secrets set MODELO_LAUDO=...` (decisão em aberto na spec). A função pede fallback automático do lado do servidor: se o modelo principal recusar, a API refaz no modelo recomendado.

## Deploy na Vercel

O projeto é importado do GitHub com o preset Next.js; nada precisa ser configurado. Cada push na `main` gera um deploy de produção; cada PR gera um preview. Sem variáveis de ambiente o app sobe em modo 100 % local. Para ligar o Supabase, adicione `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` em *Settings → Environment Variables* e faça um redeploy.

## Verificar

```bash
pnpm lint
pnpm typecheck
pnpm test          # unitários (Vitest); compila o banco de conteúdo antes
pnpm build         # gera também o service worker (public/sw.js)
pnpm e2e           # Playwright: fluxos críticos do app, do painel e das funcionalidades 01–06, contra o build
pnpm supabase:test # pgTAP: RLS entre famílias, privacidade da mãe e as regras das funcionalidades 01–06 (precisa do Supabase local)
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

## Bebê 3D (`/hoje/bebe-3d`)

Cena do bebê dentro do útero, semana a semana. Entrada pelo card "Veja seu bebê hoje" na Hoje. Código isolado em `src/components/features/bebe3d/` e `src/lib/bebe3d/`, carregado com `next/dynamic` (o three.js só desce quando a tela abre). Estado atual: fatia vertical da semana 20 com placeholder gerado por código; as outras semanas, a vista Barriga e o modo Ultrassom vêm depois da aprovação.

- **Trocar o modelo**: colocar `public/bebe3d/bebe.glb` conforme `docs/bebe-3d-assets.md` (nomes de ossos, blend shapes, mapa de espessura) e registrar a licença em `public/bebe3d/MANIFESTO.md`. Em `Bebe.tsx`, carregar o glTF no lugar de `gerarMalhaBebeAsync` e passar `nodes` com os mesmos nomes; o controlador de animação e a pele continuam iguais.
- **Ajustar a luz**: cores em `src/lib/bebe3d/paleta.ts`; intensidades e posições em `Cena.tsx` (sol, preenchimento, ambiente, environment sintético); dispersão da pele em `src/lib/bebe3d/pele.ts` (`uEscala`, `uPotencia`, `uCorSss`); parede do útero em `Utero.tsx`; pós-processamento (god rays, profundidade de campo, bloom, vinheta, grão) em `Pos.tsx`.
- **Níveis de qualidade**: `src/lib/bebe3d/qualidade.ts` (alto, médio, baixo: DPR, partículas, pós, resolução do marching cubes). A detecção inicial usa a GPU; o `PerformanceMonitor` desce ou sobe um degrau ao vivo. Forçar com `?qualidade=baixo` na URL; `?inspecao=1` mostra só o bebê com luz neutra (desenvolvimento). O medidor no canto superior direito mostra fps e nível.
- **Dados**: `src/conteudo/semanas-3d.json` (medidas, comparação, marcos, descrição em texto), tudo marcado `revisao_medica: pendente`. Escala e raio do útero por semana em `src/lib/bebe3d/semanas.ts`.
- **Acessibilidade**: respeita "reduzir movimento" (só repouso e coração, sem auto-órbita); descrição da cena em texto para leitor de tela; sem WebGL2, mostra a descrição e a ficha.

## Conteúdo

Os textos ficam em `content/*.md` (frontmatter + cards separados por `---`). `pnpm conteudo:build` gera `src/conteudo/banco.json`; roda sozinho antes de `test` e `build`. O teste em `src/lib/conteudo/stories.test.ts` barra "sempre", "nunca" e "garantido" e exige a frase de encaminhamento no fim de toda story de saúde. `pnpm conteudo:sync` sobe o banco para a tabela `conteudos`.

## Voz

`tests/voz/frases.json` é o corpus do parser local (frase → registros esperados). Rode `pnpm vitest run src/lib/voz` depois de mexer no parser. O mesmo corpus serve para comparar modelos na Edge Function.

## Funcionalidades 01–06 (`specs/funcionalidades/`)

Galeria de exames e ultrassons (`/galeria`), medicamentos (`/medicamentos`), exames (`/exames`), consultas (`/consultas`), foto da barriga (`/barriga`) e diário (`/diario`), com atalhos em Eu.

- **Nomes**: tabelas, colunas e valores como nas specs; as colunas de infraestrutura seguem a régua do projeto (`familia_id`, `criado_por`, `atualizado_em`, `apagado_em`). Os desvios do modelo estão no topo de `supabase/migrations/0003_funcionalidades.sql`.
- **Regra única para app e servidor**: `supabase/functions/_shared/dominio/` (fuso, ids determinísticos, doses, exames, consultas, barriga, diário, lembretes) é TypeScript puro, importado no app como `@dominio/*` e nas Edge Functions por caminho relativo. Os testes ficam em `src/lib/dominio` e nas pastas de cada funcionalidade.
- **Doses e exames gerados nos dois lados**: o app e o job `enviar-lembretes` materializam as doses com o mesmo id determinístico, então nunca duplicam; o mesmo vale para os exames padrão, o marco do diário (um por autora) e a foto da semana.
- **Lembretes**: derivados do estado atual + `reminders_sent` (nada de fila de agendamento). Mudar a DUM, concluir, dispensar ou cancelar ajusta sozinho; voltar depois de dias não dispara atrasados (tolerância de 30 min); limite de 2 por dia e silêncio das 22h às 7h, exceto medicamento (RN-13). Sem Supabase, o app mostra os avisos enquanto está aberto.
- **Arquivos**: fotos (JPEG ≤ 1600 px, sem EXIF), áudios e anexos ficam no IndexedDB e sobem para o bucket privado `ninho-privado` depois da linha que os referencia; a policy do Storage segue a RLS da linha.
- **Galeria**: fotos e PDFs viram páginas JPEG (≤ 2000 px, sem EXIF; PDF renderizado no aparelho com pdf.js) para folhear, dar zoom, ler por IA e exportar do mesmo jeito. A leitura do laudo roda só na Edge Function `ler-laudo` (consentimento, plano e cota de 20/mês conferidos no servidor; a IA só transcreve e o resultado é validado antes de gravar). O PDF exportado é montado no aparelho e sobe para `exportacoes/{uid}/` com link de 24 h. Desvios do modelo no topo de `0004_galeria.sql`.
- **Parceiro**: a gestante liga "Agenda" (padrão ligado) e "Fotos da barriga" (padrão desligado) em Eu → Família. Medicamentos, medidas e orientações nunca aparecem para ele.

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
| F02 Medicamentos | **pronta**; push precisa das chaves VAPID e do Cron |
| F03 Exames | pronta; o "aparece no calendário" depende da spec 08 das funcionalidades (os dados já estão marcados) e o anexo usa uma `medical_documents` mínima até a galeria (spec 01) |
| F04 Consultas | **pronta**; a antiga `consultas` virou `appointments` (migração no banco e no aparelho) |
| F05 Foto da barriga | **pronta**; o lembrete ainda não vai embutido no `week_turn` (spec 13) |
| F06 Diário | **pronta**; a retrospectiva (spec 07) e o parceiro completo (spec 12) usam estes dados quando chegarem |
| Bebê 3D | fatia vertical: semana 20 com luz, pele com SSS, animação procedural, pós-processamento e níveis de qualidade; placeholder gerado por código. Faltam as outras semanas, a vista Barriga, o ultrassom 4D e o modelo licenciado |

Ver [`CHANGELOG.md`](CHANGELOG.md).
