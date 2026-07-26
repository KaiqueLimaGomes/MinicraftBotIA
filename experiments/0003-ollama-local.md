# Experimento 0003 — Ollama local

## Objetivo

Validar que o Ollama está rodando localmente e que o modelo escolhido consegue responder a um prompt simples de planejamento de sobrevivência no Minecraft.

## Modelos

- `sweaterdog/andy-4:micro-q8_0`
- `embeddinggemma`
- `qwen2.5-coder:7b-instruct` já existente na máquina

## Critérios de aprovação

- [x] Ollama responde sem erro de conexão
- [x] Modelo `sweaterdog/andy-4:micro-q8_0` está disponível
- [x] Modelo responde a um prompt de sobrevivência
- [x] Tempo de resposta aceitável
- [ ] GPU é utilizada ou o desempenho em CPU é aceitável

## Resultado

Parcialmente aprovado.

Modelos disponíveis:

```text
embeddinggemma:latest
sweaterdog/andy-4:micro-q8_0
qwen2.5-coder:7b-instruct
```

Teste com `sweaterdog/andy-4:micro-q8_0`:

```text
1. Collect 10 oak_log.
2. Build anvil at (0,70,0).
3. Craft wooden pickaxe using oak_planks.
```

Observação: resposta rápida, mas a sugestão de bigorna é irrealista para início de survival.

Teste com prompt JSON rígido no Andy-4:

```text
Okay, I need to start moving again. !moveAway(10)
```

Observação: o modelo parece responder no estilo Mindcraft/comandos diretos, não como planejador estruturado.

Teste com `qwen2.5-coder:7b-instruct`:

```text
1. Find shelter
2. Gather resources
3. Build tools
```

Observação: resposta mais genérica, porém mais sensata.

Decisão provisória:

```text
Usar qwen2.5-coder:7b-instruct como primeiro planejador estruturado via Ollama.
Manter Andy-4 Micro como candidato para Mindcraft puro ou experimentos posteriores.
```

## Revisão da decisão

Após revisão, o `qwen2.5-coder:7b-instruct` deve ser tratado como solução temporária.

Decisão revisada:

```text
Testar qwen3:4b-instruct-2507-q4_K_M como planner principal.
Depois comparar com ministral-3:3b-instruct-2512-q4_K_M.
Manter qwen2.5-coder:7b-instruct para código futuro.
Manter Andy-4 Micro para Mindcraft puro/benchmark.
```
