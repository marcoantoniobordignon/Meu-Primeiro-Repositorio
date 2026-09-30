# Changelog

## Não lançado

### Spec 04 · Onboarding
- Fluxo de 7 telas, uma pergunta por tela, barra de progresso sempre visível e "pular" da tela 4 em diante.
- Momento de valor na tela 3: anel com a semana, dias, trimestre, semanas para o parto, comparação de tamanho e o que muda esta semana, tudo antes de pedir nome.
- DPP direta ou calculada pela DUM (+280 dias), editável; DPP no passado pergunta "o bebê já nasceu?" e vira modo bebê (ONB-01, ONB-02).
- Conteúdo das 42 semanas embutido no bundle (`supabase/seed/conteudo-semanas.json`); a tela 3 abre sem rede (ONB-03).
- Rascunho do fluxo em localStorage: fechar e voltar retoma na mesma tela por até 7 dias (ONB-04).
- Instalação do PWA guiada por sistema (iOS, Android, desktop) e pedido de push só depois de instalado (ONB-05).
- Cadastro (Google ou e-mail) só na última tela e pulável; pular mantém a sessão anônima e a Hoje mostra a faixa "Guardar minha linha do tempo" por 3 dias (ONB-06).
- Voltar sempre possível, exceto da tela 3 para a 2 depois de gravar a DPP (ONB-08).
- Eventos `onb_*` via `track()` tipado.

### Fundação mínima (para o onboarding rodar)
- Next.js 15 App Router, TypeScript strict, Tailwind 4 lendo só `src/styles/tokens.css`, Vitest, ESLint com regra que barra hex fora dos tokens.
- Tokens claro/escuro, fontes Outfit e EB Garamond via `next/font`, `data-tema` com `auto | claro | escuro`.
- Componentes base: Botão, Card, Chip, Anel, Progresso, Faixa, CampoTexto.
- `lib/dates.ts` (semana gestacional, DPP/DUM, idade do bebê) com testes.
- Sessão anônima local, com Supabase opcional por variáveis de ambiente.
- Manifest do PWA e ícones.
