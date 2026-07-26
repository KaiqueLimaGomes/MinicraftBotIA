# Experimento 0004 — Benchmark de planner local

## Objetivo

Comparar modelos locais no Ollama para decidir qual deve ser usado como planner inicial do agente de sobrevivência.

## Configuração

- Data: 26/07/2026
- Cenários: 12
- Execuções por cenário: 5
- Modelos:
  - `qwen3:4b-instruct-2507-q4_K_M`
  - `qwen2.5-coder:7b-instruct`
  - `sweaterdog/andy-4:micro-q8_0`

## Relatórios gerados

- JSON bruto: `C:\MinicraftBotIA\planner-benchmark\results\latest.json`
- Resumo: `C:\MinicraftBotIA\planner-benchmark\results\latest.md`

## Resultado resumido

| Modelo | Score médio | JSON puro válido | Pré-condição | Estratégia | Latência média |
|---|---:|---:|---:|---:|---:|
| `qwen3:4b-instruct-2507-q4_K_M` | 57.8 | 100% | 42% | 33% | 726 ms |
| `qwen2.5-coder:7b-instruct` | 57.7 | 55% | 60% | 27% | 1783 ms |
| `sweaterdog/andy-4:micro-q8_0` | 9.3 | 0% | 0% | 0% | 475 ms |

## Leitura dos resultados

O empate entre Qwen3 e Qwen2.5 Coder é enganoso.

O Qwen3 foi claramente melhor em:

- JSON puro;
- aderência ao formato;
- baixa latência;
- consistência de saída.

Mas falhou em várias decisões estratégicas, frequentemente insistindo em `collect_wood` ou escolhendo `eat_food` sem fome real.

O Qwen2.5 Coder respeitou pré-condições um pouco melhor, mas:

- foi mais lento;
- muitas vezes colocou texto fora do JSON;
- errou cenários iniciais importantes, como tentar `mine_stone` sem ferramenta.

O Andy-4 Micro não serve como planner abstrato nesse formato. Ele pode continuar como benchmark ou modelo especializado para Mindcraft puro.

## Achados importantes

### Qwen3

Pontos fortes:

- 100% JSON válido e puro;
- latência média abaixo de 1 segundo;
- bom em crises simples, como fome crítica com comida disponível.

Pontos fracos:

- dificuldade com progressão intermediária;
- às vezes escolhe ação com quantidade `0` quando a ação exige quantidade;
- confunde “ação de pré-requisito” com ação já concluída;
- precisa de validação semântica e fallback determinístico.

### Qwen2.5 Coder

Pontos fortes:

- melhor em alguns cenários com recursos/mineração;
- boa disciplina de campos quando o JSON é extraído.

Pontos fracos:

- não mantém JSON puro com confiabilidade suficiente;
- latência maior;
- viés para ações de mineração/código de tarefa, mesmo sem pré-condições.

### Benchmark/validador

O benchmark v2 é útil, mas ainda precisa de ajustes:

- `flee_threat` com `target:"zombie"` deveria ser considerado semanticamente aceitável;
- algumas ações precisam de regras melhores para `quantity`;
- o score ainda não inclui consistência nem latência;
- a próxima rodada deve testar autocorreção com uma única tentativa.

## Decisão

Não escolher planner definitivo ainda.

Decisão provisória:

```text
Continuar com Qwen3 como candidato principal,
mas adicionar validator + feedback de erro + fallback determinístico antes de integrar ao bot.
```

## Próximo passo

Implementar fluxo:

```text
LLM gera decisão
→ schema validator
→ semantic validator
→ se inválida, pedir uma correção
→ se falhar de novo, usar fallback determinístico
```

Esse fluxo é mais importante do que trocar de modelo neste momento.
