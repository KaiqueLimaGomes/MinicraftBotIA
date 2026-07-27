# Experimento 0007A - Matriz de compatibilidade fisica

## Objetivo

Separar quatro hipoteses para a falha de `collect_wood`:

- incompatibilidade do Mineflayer com Minecraft 1.21.11;
- estado `onGround=false` apos movimento;
- calculo incorreto de `digTime`;
- falha local no executor.

## Condicoes

| Condicao | Paper | Porta | Movimento anterior | Repeticoes |
|---|---|---:|---|---:|
| A | 1.21.11 | 25565 | nenhum | 5 |
| B | 1.21.11 | 25565 | pathfinder | 5 |
| C | 1.21.8 | 25566 | nenhum | 5 |
| D | 1.21.8 | 25566 | pathfinder | 5 |

O servidor 1.21.11 e o mundo do Experimento 0006D permanecem preservados. O
servidor 1.21.8 usa mundo descartavel e isolado.

## Instrumentacao

Cada tentativa e registrada antes de `bot.dig()` e inclui:

- versao do servidor e bot;
- bloco, posicao e distancia;
- `canDigBlock`;
- `onGround` antes de olhar e antes de quebrar;
- `estimatedDigTimeMs`;
- item segurado;
- eventos `diggingCompleted`, `diggingAborted` e `blockUpdate`;
- tempo real, resolucao, mudanca do bloco e delta de inventario.

Depois de movimento, a quebra exige 500 ms grounded estavel. Falha produz
`DIG_NOT_GROUNDED`.

O workaround de escala nao faz parte da matriz.

## Resultado

Executado em 2026-07-27:

| Condicao | Quebra confirmada | Inventario + | Skill completa |
|---|---:|---:|---:|
| 1.21.11 sem movimento | 5/5 | 0/5 | 0/5 |
| 1.21.11 apos pathfinder | 5/5 | 4/5 | 4/5 |
| 1.21.8 sem movimento | 5/5 | 4/5 | 4/5 |
| 1.21.8 apos pathfinder | 5/5 | 5/5 | 5/5 |

Todas as 20 tentativas:

- iniciaram grounded e permaneceram grounded antes de `bot.dig()`;
- estimaram aproximadamente 3000 ms para quebrar `oak_log` com a mao;
- resolveram `bot.dig()`;
- registraram `diggingCompleted`;
- receberam `blockUpdate` para ar;
- confirmaram a mudanca real do bloco;
- tiveram zero `diggingAborted`;
- tiveram zero timeout.

## Interpretacao

O experimento rejeita a hipotese de que o Mineflayer 4.37.1 seja incapaz de
quebrar `oak_log` em Paper 1.21.11 neste ambiente controlado. A quebra fisica
funcionou 10/10 nessa versao.

A diferenca esta na coleta do drop e no posicionamento posterior:

- Paper 1.21.11: 4/10 skills completas;
- Paper 1.21.8: 9/10 skills completas.

Durante as execucoes, o observador humano confirmou que, nas falhas de coleta,
o bloco era quebrado e o item caia fora do alcance imediato do agente. Isso e
coerente com a melhora da condicao apos pathfinder e localiza a falha na
aproximacao da entidade-item, nao na escavacao.

O estado residual de `pathfinder.stop()` tambem causava falhas locais entre
amostras. A limpeza passou a chamar `stop()` apenas quando `isMoving()` e
verdadeiro.

Para o desenvolvimento inicial do executor, Paper 1.21.8 e o laboratorio mais
estavel porque ultrapassou a meta minima de 8/10 para `collect_wood`. Isso nao
constitui migracao definitiva e nao invalida o servidor 1.21.11 do 0006D.

O proximo trabalho de runtime e tornar a aproximacao/coleta do item determinista,
localizando a entidade de drop real em vez de navegar apenas ate a coordenada
original do bloco, mantendo quebra e coleta como metricas separadas.
