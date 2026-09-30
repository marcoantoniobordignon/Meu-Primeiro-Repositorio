# 01 · Arquitetura

## Problema
A gestante precisa de um app que abra em 1 segundo, funcione às 3 da manhã sem rede e não perca um registro nunca; e o Pietro precisa construir isso sozinho com a stack que já domina.

## Escopo desta versão
- Next.js 15 App Router, TypeScript strict, pnpm, Tailwind 4 com tokens CSS, Vitest + Testing Library, Playwright para 3 fluxos críticos.
- PWA instalável (manifest, service worker com Serwist), atalhos de app ("Registrar", "Bebê").
- Supabase: Postgres com RLS, Auth (anônimo → e-mail/senha ou Google, com upgrade de conta), Storage (fotos futuras), Edge Functions (Deno) para interpretar voz e enviar push.
- Offline-first para leitura e escrita: cache de leitura via TanStack Query persistido em IndexedDB; fila de escrita (`outbox`) com sincronização e resolução por `updated_at`.
- Analytics: GA4 via gtag no cliente, com `track()` tipado.
- Pagamentos: Stripe Checkout + Customer Portal (web), webhook em Route Handler.
- Deploy: Vercel (app) + Supabase Cloud (região São Paulo).

## Fora de escopo
- App nativo, widgets de tela inicial, Live Activities, Apple Watch, Siri.
- Sincronização em tempo real entre cuidadores (usa refetch ao focar a aba; realtime fica para v2).
- Compras dentro das lojas (App Store / Play). Venda só pela web.
- Multi-idioma. Só pt-BR.

## Estrutura de pastas
```
src/
  app/                (rotas: (public)/, (app)/hoje, bebe, enxoval, eu, registrar, onboarding, assinar)
  components/ui/      (Botão, Card, Chip, Anel, Tile, Story, Sheet, TabBar, Toast)
  components/features/<feature>/
  lib/supabase/       (client, server, types.generated.ts)
  lib/offline/        (outbox.ts, sync.ts, queryPersister.ts)
  lib/analytics.ts
  lib/dates.ts        (semana gestacional, idade do bebê, "há X min")
  copy/               (pt-BR: onboarding.ts, home.ts, registros.ts, paywall.ts, push.ts)
  styles/tokens.css
supabase/
  migrations/  functions/interpretar-registro/  functions/enviar-push/  seed/conteudo-semanas.json
specs/
```

## Modelo de dados (núcleo; o restante está em `schema.sql`)
```
profiles        id (= auth.uid), nome, modo ('gestacao'|'bebe'), dpp date, tema ('auto'|'claro'|'escuro'), criado_em
familias        id, dona_id → profiles, plano ('free'|'trial'|'ativo'|'expirado'), trial_fim, stripe_customer_id
membros_familia familia_id, profile_id, papel ('mae'|'parceiro'|'avo'|'cuidador'), criado_em   PK(familia_id, profile_id)
bebes           id, familia_id, nome, nascido_em timestamptz, prematuro_semanas int null
registros       id uuid (gerado no cliente), bebe_id, tipo, inicio timestamptz, fim null, dados jsonb, origem ('voz'|'manual'|'timer'), criado_por, criado_em, atualizado_em, apagado_em null
```
RLS: cada tabela filtra por `familia_id` em `membros_familia` do `auth.uid()`. `registros.id` é gerado no cliente (uuid v7) para permitir escrita offline idempotente.

## Regras de negócio
- ARQ-01 Toda escrita passa pela `outbox` local; a UI reflete o dado imediatamente (otimista) e a fila envia em segundo plano com retry exponencial (1 s, 4 s, 16 s, 60 s, depois a cada 5 min).
- ARQ-02 Conflito entre cliente e servidor no mesmo `id`: vence o maior `atualizado_em`; nunca duplica.
- ARQ-03 Usuário anônimo (Supabase anonymous sign-in) tem os mesmos dados que um cadastrado; ao criar conta, `auth.linkIdentity` preserva o `uid` e nada migra.
- ARQ-04 Sem rede, toda tela renderiza a partir do cache e mostra uma faixa discreta "Sem conexão, salvando aqui"; nunca tela em branco nem modal bloqueante.
- ARQ-05 Nenhum dado de `registros`, `sintomas` ou `bebes` é enviado ao GA4; só eventos com contagens e tipos.
- ARQ-06 Edge Functions só aceitam chamadas com JWT válido do usuário; a chave do provedor de LLM nunca vai ao cliente.
- ARQ-07 `profiles.modo` é derivado: 'bebe' se existir `bebes.nascido_em` não nulo na família; nunca setado manualmente.
- ARQ-08 Datas guardadas em UTC; exibição sempre no fuso do aparelho; "semana gestacional" e "idade do bebê" calculadas em `lib/dates.ts` com testes.

## Limites da plataforma que o código precisa tratar
- iOS só entrega Web Push para PWA instalado (iOS 16.4+); o app precisa detectar `standalone` e guiar a instalação antes de pedir permissão.
- Web Speech API existe no Safari mas cai em silêncio; sempre ter fallback de gravação (MediaRecorder) para a Edge Function transcrever.
- Sem widgets: o atalho "Registrar" do manifest e a tela `/registrar` de carga mínima são o substituto.
- Storage do Safari pode ser apagado após 7 dias sem uso do PWA; a `outbox` precisa avisar quando há itens pendentes há mais de 24 h.

## Eventos
`app_aberto {modo, standalone, online}` · `outbox_sincronizada {itens, tentativas}` · `outbox_falhou {erro}` · `pwa_instalado`

## Critérios de aceite
- [ ] Abro o site no iPhone, instalo na tela inicial e o app abre em tela cheia com ícone e splash próprios
- [ ] Sem internet, abro o app e vejo a última home carregada, não uma tela em branco
- [ ] Registro algo offline, fecho o app, volto com internet e o registro está no Supabase sem duplicar
- [ ] Uso o app anônimo por dias, crio conta e todos os dados continuam lá
- [ ] `pnpm supabase:types` gera os tipos e o build falha se uma tabela mudar sem regenerar
- [ ] Um usuário não consegue ler dados de outra família mesmo forjando a requisição (teste de RLS)

## Decisões em aberto
- Provedor do LLM para interpretar voz (Claude Haiku vs Gemini Flash): decidir na spec 08 pelo custo por chamada. Pietro decide.
- Nome definitivo do app e domínio. Pietro decide antes da spec 14 (aparece no Stripe e no manifest).
