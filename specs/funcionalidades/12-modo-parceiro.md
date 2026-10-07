# Modo parceiro

## Problema
O parceiro quer participar, mas não sabe o que acontece nem como ajudar, e ela acaba sendo a única gerente da gravidez.

## Escopo desta versão
- Convite por link ou código, um parceiro por gestação
- Home própria do parceiro: semana, tamanho do bebê, "o que ela pode estar sentindo", "como ajudar esta semana", próximos compromissos
- Permissões ajustáveis pela gestante
- Ações do parceiro: adicionar perguntas à pauta, marcar itens das listas, escrever no diário, votar nomes
- Avisos próprios do parceiro, com opt-out por tipo
- Remover o parceiro ou o parceiro sair

## Fora de escopo
- Mais de um acompanhante (avós e rede de apoio são outra feature)
- Chat entre os dois e tarefas atribuídas
- Edição de dados médicos pelo parceiro
- App separado e cobrança do parceiro (ele herda o plano da gestante)

## Telas
1. Gestante > Parceiro: convidar (gerar link e código), estado do convite, permissões, remover
2. Aceitar convite: explica o que ele verá, pede login, confirma
3. Home do parceiro: semana e fruta, "Ela pode estar sentindo", "Como ajudar", próximos compromissos, atalhos para pauta, listas e diário
4. Parceiro > Ajustes: tipos de aviso, sair da gestação

## Modelo de dados
```
partner_invites
  id, pregnancy_id fk, created_by fk
  token_hash text unique        -- sha256; o token em si nunca é guardado
  code text unique              -- 6 caracteres, só alfanuméricos sem ambíguos
  expires_at timestamptz         -- criação + 7 dias
  accepted_by uuid null, accepted_at null, revoked_at null

pregnancy_members (fundação)
  role='partner'; permissions jsonb padrão {"agenda": true, "birth_plan": true, "belly_photos": false}

partner_tips
  id, week_from smallint, week_to smallint, trimester smallint
  feeling_text text (<=160)
  help_tips text[] (1..3 itens, <=200 cada)
  reviewed_on date
```
Matriz de acesso do parceiro:
| dado | acesso |
|---|---|
| semana, fruta, DPP, nome do bebê | ler |
| consultas (data, local, profissional) e pauta | ler; adicionar perguntas (permissão `agenda`) |
| exames marcados (só nome e data) e calendário | ler (permissão `agenda`) |
| medidas, `notes_after`, medicamentos, exames feitos, perguntas do FAQ | nunca |
| documentos da galeria | só os marcados `shared_with_partner` |
| diário | só entradas marcadas; escreve as próprias |
| fotos da barriga | ler (permissão `belly_photos`) |
| plano de parto e listas | ler e marcar itens (permissão `birth_plan`) |
| nomes | só os matches (spec 15) |
| cartas | nunca (cada autor só vê as suas) |
| retrospectiva | nunca (só pelo vídeo compartilhado) |

## Regras de negócio
- RN-01 Só a gestante (`owner`) cria convite. Um convite ativo por vez; gerar outro revoga o anterior. Token de 32 bytes aleatórios, link `{APP_URL}/convite/{token}`, validade de 7 dias.
- RN-02 Aceitar exige login. Uma conta tem um papel por vez na v1: quem já tem gestação própria ativa ou é parceiro de outra vê "Use outra conta para acompanhar".
- RN-03 Um parceiro por gestação. Novo convite só depois de remover o atual.
- RN-04 A matriz acima é aplicada por RLS, não só na interface. Permissão desligada nega leitura e escrita imediatamente.
- RN-05 Mudar permissão vale na hora; o app do parceiro revalida na próxima abertura.
- RN-06 Remover ou sair: `removed_at` preenchido, push do parceiro apagado, acesso encerrado. Entradas de diário que ele escreveu ficam com a gestante, com o rótulo "Escrito por {nome}". A gestante recebe um aviso na central, sem push.
- RN-07 O parceiro herda `has_premium` enquanto for membro ativo.
- RN-08 Avisos do parceiro (tipo `partner_*`, respeitam a fundação): véspera de consulta às 18:00; exame marcado pela gestante (no momento); marcos nas semanas 12, 20, 28, 36, 38 e 40 às 09:00. Opt-out por tipo e máximo de 3 por semana.
- RN-09 "Como ajudar" usa `partner_tips` da semana; sem item da semana, usa o do trimestre; sem nenhum, esconde o card.
- RN-10 Convite compartilhado pela Web Share API: "Entre no Ninho para acompanhar a gravidez comigo: {link}". O código de 6 caracteres serve para digitar manualmente.
- RN-11 Estado vazio do parceiro: se a gestante ainda não adicionou nada, "Ela ainda não adicionou compromissos".
- RN-12 Convite expirado ou revogado mostra mensagem clara e orienta pedir outro.

## Eventos
`partner_invite_created`, `partner_invite_accepted {hours_to_accept}`, `partner_invite_expired` (servidor), `partner_permission_changed {key, value}`, `partner_removed {by}`, `partner_home_viewed`, `partner_question_added`, `partner_checklist_toggled`, `partner_tip_viewed`.

## Critérios de aceite
- [ ] Gero um convite, envio o link, ele aceita e passa a ver a home do parceiro
- [ ] Ligo e desligo "Fotos da barriga" e o acesso muda na hora
- [ ] Ele adiciona uma pergunta à pauta e eu a vejo com o nome dele
- [ ] Ele nunca vê meus medicamentos, as medidas das consultas nem os exames que eu não marquei
- [ ] Ele marca um item da mala e eu vejo o item marcado
- [ ] Removo o parceiro e ele perde o acesso na hora; o diário dele continua comigo
- [ ] Um convite com mais de 7 dias mostra "Convite expirado"
- [ ] Sem internet, ele vê o que já carregou da home
- [ ] Logo depois de aceitar, antes de eu ter cadastrado qualquer coisa, a home dele tem a semana, a fruta e "Como ajudar", sem tela em branco
- [ ] Ele volta depois de 2 meses e a home mostra a semana atual e os próximos compromissos

## Decisões em aberto
- Um parceiro por gestação e um papel por conta na v1 (reversível). Decide: Pietro
- Os textos de `partner_tips` (cerca de 40 semanas) precisam de redação e revisão. Decide: Pietro
