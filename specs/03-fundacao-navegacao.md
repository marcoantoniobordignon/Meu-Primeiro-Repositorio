# 03 · Fundação e navegação

## Problema
A usuária precisa chegar em qualquer coisa importante em um toque, e o app precisa saber sozinho se ela está grávida ou já com o bebê no colo.

## Escopo desta versão
- Shell autenticado `(app)/layout.tsx` com TabBar e botão "+".
- Rotas: `/hoje`, `/bebe`, `/enxoval` (placeholder "em breve" nesta versão), `/eu`, `/registrar` (tela do "+"), `/onboarding/*`, `/assinar`.
- Modo derivado (`gestacao` | `bebe`) controlando o que `/hoje` e `/bebe` mostram.
- Tela `Eu`: nome, DPP ou data de nascimento, tema, notificações, cuidadores, assinatura, sair, apagar conta.
- Estado global mínimo com TanStack Query; nada de store global além de tema e sessão.

## Fora de escopo
- Aba Enxoval funcional (v2). Busca. Configurações avançadas.

## Telas
| Rota | Ação principal |
|---|---|
| `/hoje` | ver a semana (ou o dia do bebê) e registrar como está |
| `/bebe` | ver "há quanto tempo" e iniciar um registro |
| `/registrar` | falar ou tocar um tipo de registro |
| `/enxoval` | placeholder com um card "chega em breve" e botão "me avise" |
| `/eu` | ajustar conta, tema, cuidadores, assinatura |

## Modelo de dados
Usa `profiles`, `familias`, `membros_familia`, `bebes` da spec 01. Acrescenta em `profiles`: `ultimo_acesso_em timestamptz`.

## Regras de negócio
- NAV-01 Modo = 'bebe' se a família tem ao menos um bebê com `nascido_em` não nulo; senão 'gestacao'. Calculado no servidor (view `v_modo`) e cacheado no cliente.
- NAV-02 Em modo gestação, a aba Bebê mostra um estado vazio: "Depois do parto, tudo do bebê fica aqui" com botão "Registrar nascimento" (spec 11).
- NAV-03 Em modo bebê, `/hoje` passa a mostrar a home do bebê (spec 09) e o conteúdo da gestação some da primeira dobra.
- NAV-04 O "+" abre `/registrar`; em modo gestação, os tipos são sintoma, chute, contração e consulta; em modo bebê, sono, mamada, fralda, banho e outro.
- NAV-05 A aba ativa persiste ao reabrir o app (sessionStorage); ao abrir por atalho do manifest "Registrar", vai direto a `/registrar`.
- NAV-06 Sem sessão (nem anônima), qualquer rota de `(app)` redireciona para `/onboarding`.
- NAV-07 Retorno após 30+ dias sem abrir: primeira tela mostra uma faixa "Bem-vinda de volta. Está tudo certo?" com dois botões: "Sim" e "Atualizar dados" (leva a Eu).
- NAV-08 Apagar conta remove tudo da família se a pessoa é dona; se é cuidadora, remove só a participação. Confirmação por digitação da palavra "apagar".

## Eventos
`tela_vista {rota, modo}` · `plus_aberto {modo, origem: 'tab'|'atalho'}` · `tema_alterado {tema}` · `conta_apagada {papel}`

## Critérios de aceite
- [ ] Grávida, abro o app e vejo Hoje com a semana; toco em Bebê e vejo o estado vazio com "Registrar nascimento"
- [ ] Depois de registrar o nascimento, Hoje vira a home do bebê sem eu fazer nada
- [ ] Toco no "+" e a tela abre em menos de 300 ms, mesmo sem rede
- [ ] Abro pelo atalho "Registrar" do ícone do app e caio direto em `/registrar`
- [ ] Fico 30 dias sem abrir e, ao voltar, vejo a faixa de boas-vindas
- [ ] Sem rede, todas as 5 abas abrem com o último conteúdo

## Decisões em aberto
- Se a aba Enxoval deve ficar visível como placeholder ou escondida até a v2. Decisão tomada: visível, com "me avise", para medir interesse. Pietro pode reverter.
