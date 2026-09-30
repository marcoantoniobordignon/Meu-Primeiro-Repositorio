# 04 · Onboarding

## Problema
A gestante baixa dez apps e some de nove; ela precisa ver a própria semana e algo útil sobre ela em menos de um minuto, antes de qualquer cadastro.

## Escopo desta versão
- Fluxo de 7 telas, uma pergunta por tela, barra de progresso sempre visível, botão "pular" onde a resposta não é essencial.
- Sessão anônima criada silenciosamente na primeira tela.
- Momento de valor: a tela do anel com a semana e a comparação de tamanho, antes de pedir nome.
- Pedido de instalação do PWA e de notificação só depois do momento de valor, com explicação do benefício.
- Cadastro (e-mail ou Google) só é pedido ao final, como "guardar sua linha do tempo", e pode ser pulado.

## Fora de escopo
- Paywall no onboarding (spec 14 define que o primeiro paywall aparece no dia 3).
- Onboarding para quem entra já com bebê nascido (v2; nesta versão a pessoa informa DPP passada e registra o nascimento na spec 11).
- Onboarding do cuidador convidado (spec 12, é outro fluxo).

## Telas
| # | Tela | Pergunta ou conteúdo | Pular? |
|---|---|---|---|
| 1 | Boas-vindas | "Você está grávida ou já com o bebê?" (dois cards) | não |
| 2 | Data | DPP ou data da última menstruação (calculadora inline) | não |
| 3 | Valor | Anel com "22 semanas", "18 semanas para o parto", "do tamanho de um mamão" e uma frase do que muda esta semana | não (é a recompensa) |
| 4 | Nome | "Como a gente te chama?" | sim |
| 5 | Como está | 4 chips de sintoma mais frequentes da semana; "isso vira seu diário" | sim |
| 6 | Instalar e avisar | "Adiciona na tela inicial para abrir em um toque" (instruções por sistema) e "Quer o aviso de 'virou a semana' toda segunda?" | sim |
| 7 | Guardar | "Guardar sua linha do tempo" com Google e e-mail; link "agora não" | sim |

## Modelo de dados
`profiles.nome`, `profiles.dpp`, `profiles.onboarding_concluido_em`. Sintomas da tela 5 gravam em `sintomas` (spec 06) com a data de hoje. Preferência de push em `push_preferencias` (spec 13).

## Regras de negócio
- ONB-01 Na tela 1, "já com o bebê" leva para a tela 2 pedindo data de nascimento e cria o bebê na hora; o modo já nasce 'bebe'.
- ONB-02 DPP calculada da DUM = DUM + 280 dias; a tela mostra as duas e a pessoa pode ajustar. DPP no passado (> 2 semanas) pede confirmação: "o bebê já nasceu?".
- ONB-03 Tela 3 carrega sem rede: a comparação de tamanho e a frase da semana vêm de um JSON embutido no bundle (`seed/conteudo-semanas.json`, 42 entradas).
- ONB-04 Fechar o app no meio: ao voltar, retoma na mesma tela (estado em localStorage), por até 7 dias; depois recomeça.
- ONB-05 Tela 6 só pede permissão de push se o app estiver instalado (`standalone`); senão mostra instruções e o botão "já instalei" leva ao pedido.
- ONB-06 Pular a tela 7 mantém a sessão anônima; a home mostra por 3 dias uma faixa "Guardar minha linha do tempo" dispensável.
- ONB-07 O fluxo inteiro tem no máximo 7 telas e nunca ganha tela nova sem tirar outra.
- ONB-08 Voltar é sempre possível (seta), exceto na tela 3 para a 2 depois de gravar a DPP (edita em Eu).

## Eventos
`onb_iniciado` · `onb_tela_vista {n}` · `onb_valor_visto {semana}` · `onb_pulou {n}` · `onb_instalacao_mostrada {sistema}` · `onb_push_permitido {permitido}` · `onb_cadastro {metodo: 'google'|'email'|'pulou'}` · `onb_concluido {segundos, telas_puladas}`

## Critérios de aceite
- [ ] Abro o app pela primeira vez e, em 4 toques, vejo minha semana e a comparação de tamanho sem criar conta
- [ ] Informo só a DUM e a DPP aparece calculada, editável
- [ ] Sem internet, completo o onboarding inteiro e a home abre
- [ ] Fecho na tela 4 e, ao voltar, estou na tela 4 com a DPP guardada
- [ ] Pulo o cadastro, uso por 2 dias, crio conta e minha semana e sintomas continuam
- [ ] No iPhone sem instalar, a tela 6 me mostra como instalar e não pede push antes disso
- [ ] O fluxo leva menos de 60 segundos respondendo tudo

## Decisões em aberto
- Se "já com o bebê" na tela 1 entra nesta versão ou só na v2. Decisão tomada: entra, porque é barato e evita perder quem baixa depois do parto.
