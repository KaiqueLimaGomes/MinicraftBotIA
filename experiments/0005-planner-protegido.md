# Experimento 0005 - Planner protegido

## Objetivo

Comparar o Qwen3 bruto com o mesmo modelo protegido por:

- parse JSON estrito;
- normalizacao de aliases;
- validacao estrutural;
- validacao de executabilidade;
- politica de seguranca;
- uma tentativa de reparo;
- fallback deterministico.

## Metas iniciais

| Metrica | Meta |
|---|---:|
| Decisao final estruturalmente valida | 100% |
| Decisao final executavel | >= 99% |
| Cenarios criticos tratados corretamente | 100% |
| Uso de fallback | <= 20% |
| Correcao bem-sucedida | >= 70% |
| Latencia aquecida p95 | <= 2 segundos |
| Loops de correcao | 0 |

## Restricao

Este experimento nao executa a decisao no Minecraft. A integracao com Mineflayer so
deve ocorrer depois que as validacoes simuladas forem aprovadas.

## Resultado

Preenchido automaticamente em `planner-benchmark/results/protected-latest.md`.

Rodada diagnostica inicial: 1 execucao por cenario (12 casos).

- decisao final estruturalmente valida: 100%;
- decisao final executavel: 100%;
- cenarios criticos corretos: 100%;
- uso de fallback: 33%;
- reparo bem-sucedido: 43%;
- latencia aquecida p95 do planner protegido: 2.669 ms;
- maximo de chamadas do modelo por decisao: 2;
- decisao estrategicamente esperada: 25% no Qwen3 bruto e 83% no planner protegido.

Conclusao: o cinto de seguranca esta funcional, mas fallback, reparo e latencia ainda
nao atingiram as metas. Nao integrar ao executor Mineflayer nesta etapa.
