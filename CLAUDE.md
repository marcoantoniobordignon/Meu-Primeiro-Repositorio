# Ninho
App PWA de gestação e bebê em pt-BR. Next.js 15 App Router, TypeScript strict, Tailwind com tokens do design system, Supabase.

## Regras inegociáveis
- Toda cor, raio, espaçamento e fonte vem de `src/styles/tokens.css`. Nunca hex solto em componente (o lint barra).
- Componentes base em `src/components/ui`. Telas só compõem; não estilizam do zero.
- Texto em português do Brasil, tom "a gente", frases curtas, sem jargão médico sem explicação. Copy fica em `src/copy/*.ts`, nunca inline.
- Funciona offline para leitura e registro: escrita vai para fila local e sincroniza. Nunca tela em branco sem rede.
- Nenhum dado de saúde sai do Supabase do projeto. Nada de SDK de terceiros com dados de registro.
- Dark mode obrigatório em toda tela (madrugada).
- Acessibilidade: alvo de toque mínimo 44 px, contraste AA, `aria-label` em ícones, foco visível.
- Eventos de analytics só pelos nomes das specs, via `track()` em `src/lib/analytics.ts`.
- Cada spec implementada gera: testes das regras numeradas e um item em CHANGELOG.md.

## Comandos
pnpm dev · pnpm lint · pnpm typecheck · pnpm test · pnpm build

## Não fazer
- Não instalar UI kit externo.
- Não criar feature fora da spec da sessão.
- Não pedir cadastro antes do momento definido em specs/04.
