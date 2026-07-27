# Experimento 0007B - Coleta deterministica de drops

## Objetivo

Validar a correcao da falha isolada pelo Experimento 0007A: o bloco era
quebrado, mas o item podia cair fora do alcance imediato do agente.

## Mudanca

`collect_wood` agora registra as entidades-item existentes antes da quebra,
observa os novos drops proximos ao bloco e acompanha a posicao real do item.
Quando necessario, o agente navega ate essa posicao, com no maximo tres
tentativas. O sucesso exige aumento confirmado do inventario.

A telemetria distingue:

- `DROP_COLLECTED`;
- `DROP_NOT_OBSERVED`;
- `DROP_DISAPPEARED`;
- `DROP_UNREACHABLE`;
- `DROP_COLLECTION_TIMEOUT`;
- `DROP_ABORTED`.

A busca automatica tambem pode selecionar um tronco escavavel antes de ele
estar ao alcance e navegar ate ele.

## Matriz

Executado em 2026-07-27 com cinco repeticoes por condicao:

| Paper | Movimento | Quebra | Drop observado | Drop coletado | Skill completa |
|---|---|---:|---:|---:|---:|
| 1.21.8 | nenhum | 5/5 | 5/5 | 5/5 | 5/5 |
| 1.21.8 | pathfinder | 5/5 | 5/5 | 5/5 | 5/5 |
| 1.21.11 | nenhum | 5/5 | 5/5 | 5/5 | 5/5 |
| 1.21.11 | pathfinder | 5/5 | 5/5 | 5/5 | 5/5 |

Total: 20/20 quebras, 20/20 drops observados, 20/20 coletas e 20/20 skills
concluidas. Nao ocorreram timeouts nem abortos.

## Interpretacao

O resultado confirma a conclusao do 0007A: a incompatibilidade nao estava em
`bot.dig()`, mas no rastreamento e aproximacao do drop. A coleta pela entidade
real eliminou a diferenca observada entre Paper 1.21.8 e 1.21.11.

`collect_wood` esta aprovada no ambiente controlado para as duas versoes. O
servidor principal pode permanecer em Paper 1.21.11.

Os relatorios brutos e o agregado estao em
`agent-runtime/experiment-results/0007B/`.
