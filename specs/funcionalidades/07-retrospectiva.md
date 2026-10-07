# Retrospectiva da gravidez

## Problema
Depois do parto, o que ela juntou (fotos, marcos, ultrassons) fica espalhado e sem uma história para guardar e mostrar.

## Escopo desta versão
- Retrospectiva em stories verticais, de toque, com 5 a 12 slides montados com os dados dela
- Prévia a partir da semana 36 e versão final depois do nascimento
- Registro do nascimento (data, hora, peso, comprimento, nome) como gatilho
- Edição leve: ocultar slides e escolher a frase do diário de cada slide
- Exportar vídeo vertical e slides em imagem, compartilhar
- Ponte para o app do bebê no último slide

## Fora de escopo
- Fotolivro impresso
- Música no vídeo
- Reordenar slides, editor livre
- Retrospectiva do parceiro
- Gerar texto por IA

## Telas
1. Card "Sua história até aqui" (home, a partir de 36s0d) e "Sua retrospectiva está pronta" (depois do nascimento)
2. Registrar nascimento: data, hora, peso, comprimento, nome do bebê (tudo opcional exceto a data)
3. Player de stories: barra de progresso, toque para avançar e voltar, segurar para pausar, X para fechar
4. Editar: lista de slides com "ocultar" e, nos de diário, "trocar frase"
5. Exportar: vídeo ou imagens, compartilhar

## Modelo de dados
```
retrospectives
  id, pregnancy_id fk
  kind text not null                    -- preview | final
  hidden_slides text[] default '{}'
  chosen_entries jsonb default '{}'     -- {slide_type: diary_entry_id | texto livre}
  last_exported_at timestamptz null
  unique (pregnancy_id, kind)
```
Os slides são calculados na hora de exibir, com os dados vivos; só a configuração é gravada. Campos de nascimento ficam em `pregnancies` (fundação).

Slides, na ordem (omitidos quando faltam dados):
| tipo | conteúdo | sempre? |
|---|---|---|
| cover | "A história de {nome ou 'vocês'}", foto mais recente da barriga | sim |
| duration | "N semanas e D dias" (da DUM ao parto, ou até hoje na prévia) | sim |
| discovery | frase do marco `discovery` e data | não |
| belly | timelapse das fotos (3 ou mais) | não |
| ultrasound | ultrassom favorito da galeria | não |
| first_kick | frase do marco `first_kick` | não |
| sex_name | marcos `sex_known` e `name_chosen` | não |
| numbers | consultas feitas, documentos guardados, fotos, entradas do diário | sim |
| quote | uma entrada escolhida por ela | não |
| partner | trecho de entrada do parceiro, só se ela escolher | não |
| closing | "E então {nome} chegou" com data, hora, peso, comprimento (prévia: "Até logo, {nome}") | sim |
| bridge | "Começar o diário de {nome}" | só na versão final |

## Regras de negócio
- RN-01 A prévia fica disponível a partir de `ga_days >= 252` (36s0d). A final, depois do nascimento registrado. Depois fica para sempre em "Memórias".
- RN-02 Registrar nascimento: data entre `lmp_date + 140 dias` e hoje; hora, peso (500 a 7000 g) e comprimento (20 a 65 cm) opcionais. Ao salvar: `status='ended'`, cancela notificações da gestação, dispara a retrospectiva final e abre a fase do bebê.
- RN-03 Slides sem dado são omitidos. `cover`, `duration`, `numbers` e `closing` sempre existem.
- RN-04 Trecho de diário: por padrão a primeira frase (até 140 caracteres) da entrada do marco. Ela pode trocar por outra entrada ou digitar. Nenhuma frase aparece sem ter sido escrita por ela, e entradas do parceiro só entram se ela escolher.
- RN-05 Ocultar slide é permitido, menos nos obrigatórios.
- RN-06 Player: 5 s por slide, transição fade de 0,4 s, toque na metade direita avança e na esquerda volta.
- RN-07 Exportar vídeo: canvas 1080x1920, 5 s por slide, `MediaRecorder` com o mesmo critério de formato da spec 05. Antes de exportar, baixa todas as fotos com barra de progresso. Free: marca d'água "Ninho"; premium: sem marca. Cada slide pode sair como PNG com as mesmas regras.
- RN-08 Compartilhar usa a Web Share API com arquivo; fallback para download.
- RN-09 Push `retro_ready`: um na prévia (semana 38) e um no dia seguinte ao nascimento às 10:00.
- RN-10 Peso e comprimento são opcionais e nunca obrigatórios para concluir o registro.
- RN-11 Offline: o player funciona com o que já está em cache; exportar sem rede mostra "Conecte-se para baixar as fotos".

## Eventos
`retro_preview_shown`, `retro_opened {kind}`, `retro_slide_viewed {index, type}`, `retro_slide_hidden {type}`, `retro_exported {format, tier}`, `retro_shared`, `birth_registered {weeks_at_birth, has_weight}`.

## Critérios de aceite
- [ ] Na semana 36 vejo o card da prévia e abro uma história com meus dados
- [ ] Sem fotos da barriga, o slide do timelapse não aparece e nada fica quebrado
- [ ] Registro o nascimento só com a data e a retrospectiva final abre com os slides possíveis
- [ ] Oculto um slide e ele sai do player e da exportação
- [ ] Troco a frase do slide de diário por outra entrada
- [ ] Exporto o vídeo e o compartilho; no free há marca d'água
- [ ] Sem internet, assisto à retrospectiva já carregada; exportar pede conexão
- [ ] Quase sem dados (gestação criada na semana 35), vejo ao menos capa, duração, números e encerramento
- [ ] Volto um ano depois e a retrospectiva final continua abrindo em "Memórias"
- [ ] O parceiro não vê a retrospectiva a menos que eu a compartilhe pelo vídeo exportado

## Decisões em aberto
- O registro de nascimento pode já existir na spec do bebê por voz; se existir, reutilizar. Decide: Pietro
- Fotolivro impresso é monetização futura (parceria gráfica). Decide: Pietro
