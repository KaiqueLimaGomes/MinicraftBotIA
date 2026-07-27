# Experimento 0007C - Cadeia limitada end-to-end

## Objetivo

Validar no Paper 1.21.11 os bloqueadores restantes do executor limitado:

- encontrar uma arvore distante sem coordenada fornecida;
- impedir alteracoes implicitas pelo pathfinder;
- validar crafting com amostragem real;
- executar a cadeia `collect_wood -> craft_planks -> craft_crafting_table`.

## Protecoes

Todos os pontos de entrada usam `createSafeMovements()`. A configuracao
desativa quebra, scaffolding, torres 1x1 e parkour, e limita quedas a um bloco.
A quebra do tronco continua sendo feita somente por `digCancelable()`.

A coleta prioriza drops do tipo esperado e tenta candidatos restantes quando
o primeiro desaparece ou fica inacessivel.

## Resultado

Executado em 2026-07-27:

| Gate | Resultado |
|---|---:|
| `craft_planks` isolado | 10/10 |
| `craft_crafting_table` isolado | 10/10 |
| Arvore encontrada sem `target` | 10/10 |
| Log coletado | 10/10 |
| Tabuas fabricadas na cadeia | 10/10 |
| Bancada fabricada na cadeia | 10/10 |
| Cadeias completas | 10/10 |
| Alteracoes extras na arena | 0 |
| Timeout | 0 |
| Abort | 0 |

Incluindo os passos dentro das cadeias, `craft_planks` e
`craft_crafting_table` terminaram 20/20 cada. O p95 de `collect_wood` foi
7.224 ms.

O detector de efeitos observa o volume controlado da arena. Atualizacoes
naturais de blocos distantes no mundo nao sao atribuidas ao agente.

## Conclusao

O experimento tem `status: COMPLETE` e `passed: true`. Os tres skills do
executor limitado passaram individualmente e em cadeia, sem pre-requisitos
implicitos ou alteracoes adicionais do pathfinder.

Os resultados brutos estao em
`agent-runtime/experiment-results/0007C/`.
