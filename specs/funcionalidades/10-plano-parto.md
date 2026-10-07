# Plano de parto, malas e enxoval

## Problema
As decisões e os documentos do parto ficam espalhados e, na hora, ela e o acompanhante não sabem o que foi combinado nem o que levar.

## Escopo desta versão
- Assistente em 5 etapas com progresso salvo: Onde, Como, Quem, Documentos, Malas e enxoval
- Dados da maternidade, equipe, acompanhante, doula e contato de emergência
- Preferências de parto como desejos (não decisões médicas)
- Checklists de documentos, mala da mãe, mala do bebê, mala do acompanhante e enxoval, com itens editáveis
- Foto opcional de cada documento
- PDF de uma página do plano, gerado no aparelho para funcionar sem internet
- Botão "Ligar para a maternidade"
- Lembretes nas semanas 28, 34 e 36

## Fora de escopo
- Loja, afiliados, orçamento e preços do enxoval
- Lista de presentes compartilhável
- Protocolos específicos de cada maternidade e integração com elas
- Assinatura digital e validação pelo hospital
- Orientação médica sobre tipo de parto

## Telas
1. Plano: progresso (n de 5 etapas), cartões das etapas, botão "Gerar PDF", "Ligar para a maternidade" (se houver telefone)
2. Onde: maternidade, endereço, telefone, link do mapa, cobertura (SUS, plano, particular), médico e telefone
3. Como: tipo de parto desejado e preferências em chaves liga/desliga, observações
4. Quem: acompanhante, doula, contato de emergência, quem avisar
5. Documentos: checklist com anexo de foto por item
6. Malas e enxoval: 5 listas com progresso por lista, adicionar item, editar quantidade
7. Prévia do PDF e compartilhar

## Modelo de dados
```
birth_plans
  id, pregnancy_id fk unique
  maternity_name text null (<=80), maternity_address text null (<=160)
  maternity_phone text null, maternity_maps_url text null
  coverage text null                    -- sus | private | unknown
  insurer_name text null, doctor_name text null, doctor_phone text null
  wished_delivery text not null default 'undecided'   -- vaginal | cesarean | open | undecided
  prefs jsonb not null default '{}'     -- chaves abaixo
  notes text null (<=1000)
  companion_name text null, companion_phone text null
  doula_name text null, doula_phone text null
  emergency_name text null, emergency_phone text null
  completed_steps smallint[] default '{}'     -- 1..5
  updated_at

birth_checklist_items
  id, pregnancy_id fk
  list text not null    -- documents | bag_mother | bag_baby | bag_companion | layette | baptism
  title text not null (<=80), quantity smallint null, note text null (<=120)
  is_done bool default false, is_custom bool default false, position int

birth_item_attachments(id, item_id fk, storage_path, position smallint (1..3))
```
Chaves de `prefs`: `analgesia` (none | epidural | open | undecided), `skin_to_skin`, `delayed_cord_clamping`, `breastfeeding_first_hour`, `companion_in_room`, `photos_video` (allowed | no), `calm_environment`, `free_movement`, todos booleanos exceto os indicados.

Sementes de itens (copiadas ao abrir o plano pela primeira vez):
- documents (8): documento de identidade e CPF, cartão da gestante, cartão do SUS, carteirinha do plano, exames do pré-natal, últimos ultrassons, plano de parto impresso, certidão de casamento ou união estável (se houver)
- bag_mother (12): camisolas abertas na frente, calcinhas descartáveis, absorvente pós-parto, sutiã de amamentação, protetor de seios, chinelo, meias, roupa de saída, itens de higiene, carregador, travesseiro, lanche
- bag_baby (10): body, macacão, meias, luvas, touca, manta, fraldas RN, lenços umedecidos, roupa de saída, cadeirinha para o carro (obrigatória)
- bag_companion (6): documento, roupa confortável, carregador, lanche, troca de roupa, dinheiro
- layette (20): body, macacão, meias, mantas, toalha com capuz, fraldas, pomada, cotonetes, termômetro, berço ou moisés, carrinho, banheira, trocador, cadeirinha, bolsa maternidade, babá eletrônica opcional, mamadeira opcional, bomba de leite opcional, kit higiene, lençóis

## Regras de negócio
- RN-01 Cada campo salva sozinho (debounce de 800 ms). "Concluir etapa" marca a etapa em `completed_steps`, sem exigir campos. Progresso = etapas concluídas / 5.
- RN-02 O PDF nunca exige campos. Seções vazias são omitidas.
- RN-03 Texto fixo em "Como": "Preferências, não garantias. O que acontece no parto depende da sua saúde, da do bebê e da equipe. Converse com seu médico."
- RN-04 Texto fixo em "Quem": "A lei garante a presença de um acompanhante de sua escolha no trabalho de parto, parto e pós-parto imediato (Lei 11.108/2005)." com link para o cartão de direitos (spec 16). Em "Onde": referência ao direito de conhecer a maternidade (Lei 11.634/2007).
- RN-05 PDF A4 de uma página: nome, DPP e semana; maternidade; equipe; acompanhantes; preferências com marca de seleção; observações. Gerado no aparelho (biblioteca de PDF no cliente) para funcionar offline. Free: rodapé "feito com Ninho"; premium: sem rodapé. Compartilhar usa a Web Share API com arquivo.
- RN-06 Checklists: sementes copiadas ao abrir o plano, editáveis (adicionar, renomear, remover, quantidade). Progresso por lista = itens feitos / total.
- RN-07 Lembretes `birth_plan_nudge` às 10:00: semana 28 "Hora de começar o plano de parto"; semana 34 "Faltam itens na mala" (só se mala incompleta); semana 36 "Confira os documentos" (só se documentos incompletos). Plano com as 5 etapas concluídas não recebe lembretes.
- RN-08 "Ligar para a maternidade" abre `tel:` com o telefone cadastrado e fica visível também na tela inicial do plano.
- RN-09 Anexos de documentos: até 3 por item. Free: 10 anexos no total; premium ilimitado.
- RN-10 Parceiro (permissão `birth_plan`, padrão ligada) vê tudo, marca e adiciona itens de checklist e não altera preferências nem dados de contato.
- RN-11 Na semana 37 ou depois, com a etapa "Onde" vazia, a home mostra "Qual maternidade?".
- RN-12 Offline: leitura total do cache, escrita na fila, PDF gerado localmente. A tela do plano é pré-carregada no cache a partir da semana 34.
- RN-13 O telefone da maternidade fica disponível para outras features (campo `maternity_phone`).
- RN-14 A lista `baptism` é criada pela spec 17 e usa as mesmas tabelas.

## Eventos
`bp_started`, `bp_step_completed {step}`, `bp_pdf_generated {offline}`, `bp_pdf_shared`, `bp_checklist_toggled {list}`, `bp_item_added {list}`, `bp_call_maternity_tapped`, `bp_reminder_opened {week}`, `paywall_shown {feature:'birth_plan', trigger:'attachments_limit'}`.

## Critérios de aceite
- [ ] Abro o plano, preencho a maternidade e o acompanhante e o progresso mostra 2 etapas ao concluir
- [ ] Gero o PDF e ele sai com maternidade, equipe e preferências marcadas, em uma página
- [ ] Coloco o celular em modo avião e gero o PDF com sucesso
- [ ] Sem internet, marco um item da mala e a alteração sobe sozinha quando a rede volta
- [ ] Marco itens da mala e o progresso da lista sobe
- [ ] Adiciono o item "Almofada de amamentação" à mala e ele fica salvo
- [ ] Na semana 34, com a mala incompleta, recebo o lembrete; com a mala completa, não recebo
- [ ] Toco em "Ligar para a maternidade" e o discador abre com o número
- [ ] O parceiro marca itens da mala, mas não consegue editar as preferências
- [ ] Plano recém-aberto vê as 5 etapas com as listas já semeadas, nenhuma tela vazia
- [ ] Volto na semana 39 depois de meses e o plano está intacto, com o card "Qual maternidade?" se faltar

## Decisões em aberto
- Itens semente das listas (revisão editorial). Decide: Pietro
- Se o enxoval entra na v1 só como checklist (decidido assim) ou como loja depois. Decide: Pietro
- Limite free de 10 anexos (reversível). Decide: Pietro
