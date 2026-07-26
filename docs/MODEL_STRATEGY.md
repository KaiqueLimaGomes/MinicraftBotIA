# Estratégia de modelos locais

## Decisão revisada

O `qwen2.5-coder:7b-instruct` respondeu melhor que o Andy-4 Micro no primeiro teste, mas não deve ser tratado como planejador definitivo.

Ele é útil como modelo de código, mas o planejador principal deve ser um modelo generalista/instruct, mais adequado para:

- decisões de sobrevivência;
- JSON estruturado;
- tool calling;
- coordenação entre agentes;
- decisões sociais futuras.

## Papéis recomendados

| Papel | Modelo candidato |
|---|---|
| Planner principal | `qwen3:4b-instruct-2507-q4_K_M` |
| Segundo candidato | `ministral-3:3b-instruct-2512-q4_K_M` |
| Código futuro | `qwen2.5-coder:7b-instruct` |
| Embeddings/memória | `embeddinggemma` |
| Mindcraft puro/benchmark | `sweaterdog/andy-4:micro-q8_0` |

## Configuração inicial do planner

```json
{
  "temperature": 0.2,
  "num_ctx": 8192,
  "num_predict": 300
}
```

## Esquema obrigatório de decisão

```json
{
  "goal": "string",
  "action": "string",
  "target": "string",
  "quantity": 0,
  "priority": 1,
  "reason": "string"
}
```

## Benchmark recomendado

Testar cada modelo com estados concretos, não apenas perguntas genéricas.

### Cenário 1 — início do survival

```text
Time: morning
Health: 20
Hunger: 20
Inventory: empty
Nearby: oak trees, grass, sheep, exposed stone
Shelter: none
Tools: none
```

### Cenário 2 — noite próxima

```text
Time until night: 90 seconds
Inventory: 8 oak logs, 3 raw beef
Tools: wooden pickaxe
Shelter: none
Nearby threat: none
```

### Cenário 3 — crise de fome

```text
Health: 14
Hunger: 4
Inventory: 6 iron ore, 20 cobblestone, no food
Nearby: cow at 18 blocks, base at 40 blocks
```

## Métricas

| Métrica | Peso |
|---|---:|
| JSON válido | 20% |
| Ação existente | 20% |
| Prioridade correta | 20% |
| Ausência de alucinação | 20% |
| Latência | 10% |
| Consistência | 10% |

## Decisão atual

Instalar e testar primeiro:

```powershell
ollama pull qwen3:4b-instruct-2507-q4_K_M
```

Depois comparar com:

```powershell
ollama pull ministral-3:3b-instruct-2512-q4_K_M
```
