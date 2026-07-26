# Experimento 0005 - Planner protegido

Data: 2026-07-26T22:34:21.039Z

Modelo: qwen3:4b-instruct-2507-q4_K_M

| Metrica | Qwen3 bruto | Planner protegido | Meta |
|---|---:|---:|---:|
| Estruturalmente valida | 33% | 100% | 100% |
| Executavel | 25% | 100% | >= 99% |
| Estrategicamente correta | 25% | 83% | observacao |
| Cenarios criticos corretos | - | 100% | 100% |
| Uso de fallback | - | 33% | <= 20% |
| Reparo bem-sucedido | - | 43% | >= 70% |
| Latencia aquecida p95 | 1561 ms | 2669 ms | <= 2000 ms |
| Maximo de chamadas por decisao | 1 | 2 | 2 |

O planner protegido permite uma unica correcao. Se ela falha, aplica fallback deterministico.
