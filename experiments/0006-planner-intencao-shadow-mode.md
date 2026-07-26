# Experimento 0006 - Intencao, taxonomia e shadow mode

## 0006A - Analise de falhas

O planner registra em cada decisao:

- resposta inicial invalida;
- categoria e codigo do erro;
- normalizacao ou reparo mecanico aplicado;
- resultado da unica tentativa cognitiva;
- uso e motivo do fallback;
- safety override separado de falha da LLM.

Categorias:

`INVALID_JSON`, `INVALID_SCHEMA`, `UNKNOWN_ACTION`, `INVALID_TARGET`,
`INVALID_QUANTITY`, `PRECONDITION_NOT_MET`, `SAFETY_OVERRIDE`,
`STRATEGIC_OVERRIDE`, `REPAIR_FAILED` e `MODEL_UNAVAILABLE`.

## 0006B - Planner de intencao

O Qwen3 agora escolhe somente:

```json
{
  "goal": "string",
  "action": "allowed_action",
  "priority": 1,
  "reason": "string"
}
```

O codigo resolve alvo e quantidade. A resposta antiga com `target` e `quantity`
continua aceita, mas esses campos nao controlam a decisao final.

## 0006C - Shadow mode

O Mineflayer:

1. observa mundo, inventario, vida, fome, tempo, blocos e entidades proximas;
2. cria um snapshot;
3. consulta o planner protegido;
4. captura outro snapshot ao fim da inferencia;
5. registra mudanca de estado, repeticao e executabilidade posterior;
6. nao executa nenhuma acao.

Duracao padrao: 20 minutos. Intervalo padrao: 15 segundos.

Comando:

```powershell
cd C:\MinicraftBotIA\bot-smoke-test
node shadow-mode.js
```

Os registros ficam em `C:\MinicraftBotIA\bot-smoke-test\shadow-results\shadow-*.jsonl` e nao sao enviados
ao GitHub.

## Resultado inicial

Rodada sintetica com 12 cenarios:

- fallback por falha da LLM: 0%;
- safety override intencional: 42%;
- segunda chamada: 0%;
- p95 aquecido protegido: 939 ms;
- decisoes finais estruturais e executaveis: 100%;
- casos criticos corretos: 100%;
- estrategia esperada: 50%.

Foram aplicados sete alvos deterministas e sete quantidades padrao. A queda da
metrica estrategica ocorreu porque o modelo escolheu acoes executaveis, mas
subotimas, principalmente `explore_area` e abrigo antecipado.

Teste real curto do shadow mode:

- dois snapshots registrados;
- duas decisoes ainda executaveis ao final da inferencia;
- latencia media: 1.084 ms;
- nenhuma acao executada;
- o primeiro snapshot mudou durante a inferencia por estabilizacao inicial do bot;
- o segundo permaneceu estavel.

Conclusao: a integracao observacional esta funcional. O proximo teste deve durar
20 a 30 minutos antes de liberar qualquer habilidade.
