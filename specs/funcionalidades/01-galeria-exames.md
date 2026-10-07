# Galeria de exames e ultrassons

## Problema
A gestante guarda laudos e imagens em papel, WhatsApp e rolo da câmera, e na hora da consulta não acha nada.

## Escopo desta versão
- Adicionar documento por câmera, galeria ou PDF, com várias páginas
- Tipo, data, título opcional e observação
- Linha do tempo com filtro por tipo e semana gestacional ao lado de cada item
- Visualizador com zoom e favoritar imagem de ultrassom
- Vínculo com exame agendado (spec 03): anexar resultado marca o exame como feito
- Leitura do laudo por IA (premium): transcreve o que está escrito
- Exportar documentos selecionados em PDF (premium)
- Marcar documento como compartilhado com o parceiro (spec 12)

## Fora de escopo
- Interpretar resultado, dizer se está alto ou baixo, comparar exames entre si
- Gráficos de evolução de valores
- Vídeo de ultrassom
- OCR sem internet
- Integração com laboratórios

## Telas
1. Galeria: chips de tipo, alternância grade e linha do tempo, botão "+ Adicionar"
2. Adicionar: escolher câmera, galeria ou PDF, prévia das páginas, tipo, data, título, salvar
3. Documento: páginas com zoom, metadados, resumo da IA (se houver), ações (favoritar, compartilhar com parceiro, ler laudo, editar, excluir)
4. Selecionar e exportar (premium)
5. Consentimento de leitura por IA (aparece na primeira vez)

## Modelo de dados
```
medical_documents
  id, pregnancy_id fk, created_by fk
  kind text not null     -- us_obstetric | us_nuchal | us_morpho | us_other | blood | urine | glucose | serology | culture_gbs | other
  title text null (<=80)
  exam_date date not null
  notes text null (<=1000)
  is_favorite bool default false
  shared_with_partner bool default false
  scheduled_exam_id uuid null fk user_exams      -- spec 03
  ai_status text not null default 'none'          -- none | pending | done | failed
  ai_summary jsonb null
  created_at, updated_at

document_pages
  id, document_id fk, position smallint, storage_path text, mime text, bytes int, width int null, height int null
```
Semana gestacional não é gravada: calcula-se de `exam_date` com `ga_week`.
`ai_summary` = `{exam_name, lab, exam_date, items:[{name, value, unit, reference, flagged_in_report}]}`.
Limites técnicos: 20 páginas por documento, 15 MB por arquivo após compressão.

## Regras de negócio
- RN-01 Tipo e data são obrigatórios. A data não pode ser futura. Data anterior a 90 dias antes da DUM pede confirmação.
- RN-02 Free: até 20 páginas somadas em todos os documentos. No envio da 21ª abre o paywall e o documento não é salvo. Premium sem limite.
- RN-03 Excluir documento exige confirmação, é definitivo e remove os arquivos do storage em até 24 horas.
- RN-04 Ao salvar com `scheduled_exam_id` vazio, se existir exame agendado pendente do mesmo tipo, perguntar "Este é o resultado de {exame}?". Aceitar vincula e marca o exame como feito.
- RN-05 Leitura por IA só roda com `consents.ai_document_reading` ativo e só quando a usuária toca em "Ler laudo" (nunca automática). O consentimento tem texto próprio dizendo que as imagens são enviadas a um provedor de IA para extrair texto.
- RN-06 A IA apenas transcreve. `flagged_in_report` é verdadeiro somente se o próprio laudo marca o valor (asterisco, negrito, "alterado"). O app nunca calcula alto ou baixo. Texto fixo sob o resumo: "Transcrição automática. Confira com o documento original e converse com seu médico."
- RN-07 Se a IA falha ou devolve JSON inválido: `ai_status='failed'`, mensagem "Não consegui ler este laudo. O arquivo continua salvo.", sem consumir cota.
- RN-08 Cota de IA: 20 leituras por mês por gestação. Esgotada, mostra quando renova.
- RN-09 Exportar PDF (premium): até 50 páginas; capa com nome, DPP e semana; uma seção por documento; link de download válido por 24 horas.
- RN-10 `shared_with_partner` começa desligado e só tem efeito se o parceiro existir (spec 12).
- RN-11 Offline: lista e documentos já abertos continuam visíveis; novos envios ficam na fila com selo "Aguardando envio".
- RN-12 Favoritar só é permitido em tipos `us_*`.

## Eventos
`exam_doc_add_started`, `exam_doc_added {kind, pages, source}`, `exam_doc_viewed {kind}`, `exam_doc_ai_consent_given`, `exam_doc_ai_read_requested`, `exam_doc_ai_read_done {ok}`, `exam_doc_exported {docs, pages}`, `exam_doc_deleted`, `exam_doc_linked_to_exam`, `paywall_shown {feature:'exam_gallery', trigger:'pages_limit'}`.

## Critérios de aceite
- [ ] Fotografo um laudo com 2 páginas, escolho o tipo e a data, salvo e o vejo na galeria com a semana certa
- [ ] Anexo um PDF de 3 páginas e consigo folhear
- [ ] Ao anexar resultado de um exame que eu marquei, o app pergunta se é o resultado dele e, aceitando, ele aparece como feito
- [ ] Toco em "Ler laudo" sem consentimento e o app pede o consentimento antes de enviar qualquer coisa
- [ ] Depois do resumo, vejo o aviso de que é transcrição e não interpretação
- [ ] No plano free, ao passar de 20 páginas, vejo o paywall e nada que eu já guardei some
- [ ] Sem internet, abro a galeria, vejo o que já carreguei e adiciono um documento que sobe sozinho depois
- [ ] Sem nenhum documento, vejo "Guarde aqui o primeiro ultrassom" e o botão de adicionar
- [ ] Volto depois de meses e as imagens abrem normalmente (URLs renovadas) na posição em que parei
- [ ] Excluo um documento e ele não reaparece, nem no storage após 24 horas

## Decisões em aberto
- Limite free de 20 páginas (reversível). Decide: Pietro
- Provedor e modelo de IA para a leitura de laudo e custo por leitura. Decide: Pietro
- Texto do consentimento de IA (LGPD, dado sensível). Revisão jurídica. Decide: Pietro
- Vídeo de ultrassom fica para depois por custo de armazenamento
