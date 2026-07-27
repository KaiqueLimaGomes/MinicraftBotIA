# Experimento 0006D - Matriz de estados reais

## Objetivo

Validar a fidelidade do snapshot e a decisao observacional em estados variados do
servidor. O bot permanece em shadow mode e nao executa habilidades.

## Preparacao

Pre-requisitos implementados:

- coordenadas de base incompletas ou nao numericas encerram com erro;
- coordenadas negativas e zero sao aceitas;
- bau e bancada registrados na base aparecem no snapshot;
- reparo recebe somente acoes estrategicamente admissiveis;
- fingerprint decisorio inclui horario, urgencia noturna, abrigo, base e
  infraestrutura;
- testes locais e CI do GitHub cobrem essas regras.

Para cada fase:

1. preparar manualmente o estado no Minecraft;
2. conferir visualmente inventario, vida, fome, horario e recursos;
3. configurar `SHELTER_STATUS` e base somente quando forem conhecidos;
4. iniciar o shadow mode por pelo menos tres snapshots;
5. encerrar e anotar o arquivo JSONL correspondente;
6. comparar o snapshot registrado com o estado visivel.

Execucao de uma fase:

```powershell
cd C:\MinicraftBotIA\bot-smoke-test
$env:SHADOW_PHASE='1'
$env:SHADOW_MAX_SNAPSHOTS='3'
node shadow-mode.js
```

Trocar `SHADOW_PHASE` de 1 a 12. O processo encerra automaticamente depois de
tres decisoes. Para as fases 7 e 8, definir `SHELTER_STATUS` como `absent` ou
`present`. Para as fases 9 e 10, registrar `BASE_X`, `BASE_Y` e `BASE_Z`.

Depois das 12 fases:

```powershell
node summarize-matrix.js
```

O agregador gera `matrix-results/0006D-latest.md` e
`matrix-results/0006D-latest.json`, contendo apenas resultados agregados e
amostras relevantes para auditoria. Os JSONL brutos continuam ignorados pelo Git.

### Preparacao de jogador persistido

Como comandos `clear`, `tp` e `effect clear` exigem normalmente um jogador online,
usar primeiro:

```powershell
cd C:\MinicraftBotIA\bot-smoke-test
$env:MC_USERNAME='AgenteShadow'
npm run prepare
```

Esse processo conecta o jogador sem planner, snapshots, chat ou movimento. Enquanto
ele estiver conectado, aplicar no console do servidor:

```text
gamemode survival AgenteShadow
clear AgenteShadow
effect clear AgenteShadow
tp AgenteShadow X Y Z
```

Depois pressionar `Ctrl+C` no PowerShell de preparação. O servidor persiste posição
e inventário. Ajustar `time set 0` imediatamente antes de iniciar a fase 1.

O modo de preparação nunca conta como amostra do experimento.

### Aquecimento observacional

Em fases da matriz, o shadow mode aguarda cinco segundos depois do evento `spawn`
antes do primeiro snapshot. Isso permite o carregamento de chunks, blocos e
entidades proximas. O timer global e cancelado quando a quantidade de amostras e
atingida, evitando processo orfao depois do terceiro snapshot.

## Matriz

| Fase | Estado |
|---:|---|
| 1 | Manha, inventario vazio e carvalho proximo |
| 2 | Oito troncos no inventario |
| 3 | Tabuas disponiveis, sem bancada |
| 4 | Bancada disponivel, sem ferramenta |
| 5 | Ferramenta pronta e animal proximo |
| 6 | Fome critica com comida no inventario |
| 7 | Dusk, 12 blocos, `SHELTER_STATUS=absent` |
| 8 | Dentro de abrigo, `SHELTER_STATUS=present` |
| 9 | Base e bau registrados por `BASE_X/Y/Z` |
| 10 | Inventario cheio longe da base |
| 11 | Carvao e ferro proximos |
| 12 | Vida baixa com zumbi proximo |

## Metricas

- snapshot corresponde ao estado real;
- decisao `catalogExecutable`;
- decisao ainda valida depois da inferencia;
- acerto dos casos criticos;
- exploracao prematura;
- abrigo antecipado;
- `same_state_same_decision`;
- `same_state_different_decision`;
- `changed_state_same_decision`;
- `changed_state_different_decision`;
- timeout ou erro de conexao nao tratado;
- latencia aquecida p95.

## Criterio de liberacao

A execucao limitada so pode ser criada depois da matriz ser preenchida e aprovada.
Ela sera desenvolvida na branch `feat/limited-skill-executor`, sem commit direto na
`main`.

## Estado

Fase 1 aprovada em 2026-07-26:

- snapshot correspondente: 3/3;
- `collect_wood`: 3/3;
- `catalogExecutable`: 3/3;
- decisao ainda valida depois da inferencia: 3/3;
- mesma entrada, mesma decisao: 100%;
- latencia p95: 1.237 ms;
- acoes executadas: 0;
- erros nao tratados: 0.

A primeira tentativa foi rejeitada porque o snapshot imediato ocorreu antes do
carregamento dos blocos proximos. O JSONL foi movido para
`shadow-results/rejected/` e nao participa do agregado. A instrumentacao passou a
aguardar cinco segundos e a limpar o timer global ao atingir a amostra.

Progresso atual: 1/12 fases e 3/36 decisoes.

Fase 2 aprovada em 2026-07-26:

- snapshot com oito troncos: 3/3;
- `craft_planks`: 3/3;
- `catalogExecutable`: 3/3;
- decisao ainda valida depois da inferencia: 3/3;
- acoes executadas: 0.

Duas tentativas foram rejeitadas e arquivadas:

1. `collect_wood` ainda era admissivel com oito troncos;
2. `craft_crafting_table` aceitava troncos e escondia a fabricacao de tabuas.

O filtro agora remove coleta redundante quando madeira ou tabuas suficientes ja
desbloqueiam a progressao. A bancada exige quatro tabuas reais.

Progresso atual: 2/12 fases e 6/36 decisoes.

Fase 3 aprovada em 2026-07-26:

- snapshot com 12 tabuas e sem bancada: 3/3;
- `craft_crafting_table`: 3/3;
- `catalogExecutable`: 3/3;
- decisao ainda valida depois da inferencia: 3/3;
- acoes executadas: 0;
- cold start: 5.150 ms;
- chamadas aquecidas: 998 a 1.016 ms.

Progresso atual: 3/12 fases e 9/36 decisoes.
