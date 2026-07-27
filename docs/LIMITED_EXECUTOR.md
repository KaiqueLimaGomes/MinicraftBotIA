# Executor limitado

Branch inicial: `feat/limited-skill-executor`

## Limites

O modo padrao e `EXECUTION_MODE=shadow`. Alteracoes no mundo exigem
`EXECUTION_MODE=limited` e uma acao na allowlist:

- `craft_planks`;
- `craft_crafting_table`;
- `collect_wood`.

O runtime nao chama o planner. O executavel manual recebe uma unica acao por
`MANUAL_ACTION`, captura um estado fresco e revalida `canExecute()` antes de
iniciar.

## Contrato

Cada skill implementa:

- `canExecute()`;
- `execute()` com `AbortSignal`;
- `verifyProgress()`.

O runner oferece:

- `executionId` unico;
- exclusao mutua por bot;
- timeout;
- abort externo;
- parada de pathfinder, controles e escavacao;
- protecao contra conclusao antiga;
- resultado estruturado;
- verificacao de efeito real.

Resolver a Promise de `craft()` ou `dig()` nao significa sucesso. O inventario
precisa confirmar o aumento do item esperado.

## Metas manuais

| Skill | Sucesso minimo | p95 |
|---|---:|---:|
| `craft_planks` | 10/10 | 5 s |
| `craft_crafting_table` | 10/10 | 5 s |
| `collect_wood` | 8/10 | 90 s |

O executor ainda nao esta conectado ao planner. Essa integracao permanece
bloqueada ate a conclusao dos 30 testes reais.

## Automacao local com RCON

O harness prepara e limpa cada amostra, cria uma arena dedicada para madeira e
gera relatorios JSON e Markdown:

```powershell
cd C:\MinicraftBotIA\agent-runtime
npm run experiment:skills
```

Credenciais podem ser fornecidas por `C:\MinicraftBotIA\.env.local`, que e
ignorado pelo Git:

```text
MC_RCON_PASSWORD=senha-local
```

RCON remoto e bloqueado por padrao. O harness aceita no maximo dez repeticoes
por skill e nao chama o planner.

## Dependencias

O runtime fixa `mineflayer@4.33.0`, igual ao modulo de smoke test, e
`mineflayer-pathfinder@2.4.5`.

Em 2026-07-26, `npm audit` reportou seis avisos moderados transitivos no caminho
de autenticacao do Mineflayer, principalmente por `uuid <11.1.1`. A correcao
sugerida pelo npm e um downgrade incorreto para `mineflayer@1.4.0`, incompativel
com Minecraft 1.21.11. Nenhum `npm audit fix --force` foi aplicado.
