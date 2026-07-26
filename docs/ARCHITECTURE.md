# Arquitetura dos agentes

## Princípio principal

A LLM não deve controlar cada movimento do bot.

Fluxo recomendado:

```text
Estado do mundo
↓
Decisão de alto nível pela IA
↓
Escolha de uma habilidade segura
↓
Execução por código/Mineflayer
↓
Resultado volta para o agente
↓
Nova decisão
```

## Código controla

- movimento;
- pathfinding;
- mineração;
- coleta;
- crafting;
- construção;
- comer;
- fugir de mobs;
- evitar perigo imediato;
- guardar itens.

## IA decide

- prioridades;
- interpretação de falhas;
- planos de médio prazo;
- cooperação entre agentes;
- regras sociais futuras;
- liderança e decisões coletivas futuras.

## Meta inicial

Antes de sociedade, política ou múltiplos agentes:

```text
Um agente precisa sobreviver sozinho de forma confiável.
```
## Planner protegido

O modelo local nao envia comandos diretamente ao Mineflayer. A decisao percorre:

```text
Qwen3
  -> intencao (goal, action, priority, reason)
  -> parse JSON estrito
  -> resolucao deterministica de alvo e quantidade
  -> validacao estrutural
  -> validacao de executabilidade
  -> politica de seguranca
  -> classificacao de qualidade
  -> decisao final
```

Classificacoes:

- `VALID`: executavel e alinhada com a politica;
- `VALID_SUBOPTIMAL`: executavel, mas existe opcao deterministica preferivel;
- `INVALID_REPAIRABLE`: formato, alvo ou pre-condicao podem ser corrigidos;
- `UNSAFE_OVERRIDE`: reservado para uma escolha do modelo substituida pela politica
  critica. No retorno atual, a origem equivalente e `safety_override`.

Uma decisao reparavel recebe somente uma segunda tentativa. Se continuar invalida,
o planner usa fallback deterministico. O executor Mineflayer ainda nao esta conectado
ao planner. A integracao atual e somente observacional (`shadow-mode.js`).

## Modulos

Os modulos estao em `planner-benchmark/planner/`:

- `action-catalog.js`: acoes, alvos, aliases e pre-condicoes;
- `decision-schema.js`: parse estrito e estrutura;
- `intent-schema.js`: contrato reduzido da intencao;
- `resolve-intent.js`: alvo e quantidade derivados do estado;
- `failure-taxonomy.js`: causas de falha e fallback;
- `normalize-decision.js`: normalizacao;
- `validate-decision.js`: executabilidade;
- `safety-policy.js`: situacoes criticas;
- `quality-policy.js`: decisao valida versus subotima;
- `repair-decision`: incorporado ao fluxo de `planner.js`;
- `fallback-policy.js`: escolha deterministica;
- `planner.js`: orquestracao e limite de duas chamadas.
