# Experimento 0005 - Planner protegido

Data: 2026-07-26T23:14:48.744Z

Modelo: qwen3:4b-instruct-2507-q4_K_M

| Metrica | Qwen3 bruto | Planner protegido | Meta |
|---|---:|---:|---:|
| Estruturalmente valida | 25% | 100% | 100% |
| Executavel | 25% | 100% | >= 99% |
| Estrategicamente correta | 33% | 83% | observacao |
| Cenarios criticos corretos | - | 100% | 100% |
| Uso de fallback | - | 0% | <= 20% |
| Safety override intencional | - | 42% | separado |
| Fallback por falha da LLM | - | 0% | <= 20% |
| Reparo bem-sucedido | - | 100% | >= 70% |
| Latencia aquecida p95 | 1397 ms | 1014 ms | <= 2000 ms |
| Maximo de chamadas por decisao | 1 | 1 | 2 |

O planner protegido permite uma unica correcao. Se ela falha, aplica fallback deterministico.

## Taxonomia de falhas

```json
{
  "SAFETY_OVERRIDE": 5
}
```

## Reparos mecanicos

```json
{
  "DETERMINISTIC_TARGET": 7,
  "DEFAULT_QUANTITY": 7
}
```
