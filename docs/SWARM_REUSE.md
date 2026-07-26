# Estrategia de reuso do minecraft-agent-swarm

Referencia estudada:

- projeto: `JesseRWeigel/minecraft-agent-swarm`;
- commit upstream: `e69eaa2878b38adacffb4a5dab70d2c2740546ba`;
- licenca informada no estudo: MIT.

## Decisao

O MinicraftBotIA preserva seu planner protegido, snapshots, admissibilidade,
politicas de seguranca, testes e metodologia experimental.

O projeto upstream sera usado como catalogo de falhas reais e fonte seletiva de
padroes para:

- navegacao cancelavel;
- watchdog;
- deteccao de stall;
- coleta verificada de drops;
- verificacao de inventario;
- telemetria de trajetoria;
- resultados estruturados de skills.

Nao serao importados integralmente `actions.ts`, `executor.ts`, skills compostas,
stash, coordenacao multiagente, combate, geracao dinamica de codigo ou regras
acopladas ao mundo upstream.

## Ordem obrigatoria

1. concluir o Experimento 0006D;
2. criar a branch `spike/swarm-executor`;
3. adicionar `LICENSE` e `THIRD_PARTY_NOTICES.md`;
4. analisar o codigo upstream exato antes de qualquer adaptacao;
5. criar `agent-runtime` separado de `bot-smoke-test`;
6. implementar primitivas cancelaveis e skill runner;
7. implementar apenas `craft_planks`, `craft_crafting_table` e `collect_wood`;
8. executar skills manualmente antes de conectá-las ao planner;
9. manter `EXECUTION_MODE=shadow` como padrao.

Nenhum codigo do upstream foi adaptado nesta etapa. O licenciamento e os cabecalhos
serao adicionados antes do primeiro reuso efetivo.

## Contrato futuro

Cada skill devera possuir:

- `canExecute()`;
- `execute()` com `AbortSignal`;
- `verifyProgress()`;
- timeout;
- protecao por `executionId`;
- resultado estruturado;
- verificacao de efeito real.

Sucesso nunca sera inferido apenas pela resolucao de `bot.dig()` ou `bot.craft()`.
