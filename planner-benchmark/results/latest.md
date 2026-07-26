# Experimento 0004 — Benchmark de planner local

Data: 2026-07-26T22:19:58.333Z

Modelos: qwen3:4b-instruct-2507-q4_K_M, qwen2.5-coder:7b-instruct, sweaterdog/andy-4:micro-q8_0

Cenários: 12

Execuções por cenário: 5

## Resumo por modelo

| Modelo | Score médio | JSON puro válido | Campos/tipos | Ação permitida | Pré-condição | Estratégia | Sem alucinação | Latência média |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| qwen3:4b-instruct-2507-q4_K_M | 57.8 | 100% | 100% | 100% | 42% | 33% | 100% | 726 ms |
| qwen2.5-coder:7b-instruct | 57.7 | 55% | 100% | 100% | 60% | 27% | 100% | 1783 ms |
| sweaterdog/andy-4:micro-q8_0 | 9.3 | 0% | 0% | 0% | 0% | 0% | 93% | 475 ms |

## Resumo por cenário

| Modelo | Cenário | Score médio | Estratégia | Pré-condição | Latência média |
|---|---|---:|---:|---:|---:|
| qwen2.5-coder:7b-instruct | hunger_crisis_animal_nearby | 86.0 | 100% | 100% | 1499 ms |
| qwen3:4b-instruct-2507-q4_K_M | hunger_crisis_animal_nearby | 80.0 | 100% | 100% | 569 ms |
| sweaterdog/andy-4:micro-q8_0 | hunger_crisis_animal_nearby | 10.0 | 0% | 0% | 464 ms |
| qwen3:4b-instruct-2507-q4_K_M | hunger_crisis_food_inventory | 90.0 | 100% | 100% | 606 ms |
| qwen2.5-coder:7b-instruct | hunger_crisis_food_inventory | 57.0 | 0% | 100% | 1647 ms |
| sweaterdog/andy-4:micro-q8_0 | hunger_crisis_food_inventory | 10.0 | 0% | 0% | 368 ms |
| qwen2.5-coder:7b-instruct | inventory_full_base_known | 53.0 | 40% | 40% | 1538 ms |
| qwen3:4b-instruct-2507-q4_K_M | inventory_full_base_known | 45.0 | 0% | 0% | 630 ms |
| sweaterdog/andy-4:micro-q8_0 | inventory_full_base_known | 6.0 | 0% | 0% | 438 ms |
| qwen2.5-coder:7b-instruct | iron_visible_no_coal | 69.0 | 40% | 100% | 1555 ms |
| qwen3:4b-instruct-2507-q4_K_M | iron_visible_no_coal | 45.0 | 0% | 0% | 802 ms |
| sweaterdog/andy-4:micro-q8_0 | iron_visible_no_coal | 10.0 | 0% | 0% | 245 ms |
| qwen3:4b-instruct-2507-q4_K_M | low_health_hostile_nearby | 70.0 | 100% | 0% | 605 ms |
| qwen2.5-coder:7b-instruct | low_health_hostile_nearby | 65.0 | 0% | 100% | 1652 ms |
| sweaterdog/andy-4:micro-q8_0 | low_health_hostile_nearby | 10.0 | 0% | 0% | 315 ms |
| qwen3:4b-instruct-2507-q4_K_M | morning_empty_inventory | 80.0 | 100% | 100% | 1437 ms |
| qwen2.5-coder:7b-instruct | morning_empty_inventory | 39.0 | 0% | 0% | 3115 ms |
| sweaterdog/andy-4:micro-q8_0 | morning_empty_inventory | 10.0 | 0% | 0% | 1242 ms |
| qwen3:4b-instruct-2507-q4_K_M | night_soon_no_shelter | 65.0 | 0% | 100% | 668 ms |
| qwen2.5-coder:7b-instruct | night_soon_no_shelter | 63.0 | 0% | 100% | 1714 ms |
| sweaterdog/andy-4:micro-q8_0 | night_soon_no_shelter | 10.0 | 0% | 0% | 275 ms |
| qwen2.5-coder:7b-instruct | planks_no_table | 37.0 | 0% | 0% | 1909 ms |
| qwen3:4b-instruct-2507-q4_K_M | planks_no_table | 35.0 | 0% | 0% | 642 ms |
| sweaterdog/andy-4:micro-q8_0 | planks_no_table | 8.0 | 0% | 0% | 698 ms |
| qwen2.5-coder:7b-instruct | shelter_no_light | 61.0 | 40% | 60% | 1669 ms |
| qwen3:4b-instruct-2507-q4_K_M | shelter_no_light | 45.0 | 0% | 0% | 654 ms |
| sweaterdog/andy-4:micro-q8_0 | shelter_no_light | 10.0 | 0% | 0% | 219 ms |
| qwen2.5-coder:7b-instruct | table_no_tools | 43.0 | 0% | 0% | 1595 ms |
| qwen3:4b-instruct-2507-q4_K_M | table_no_tools | 35.0 | 0% | 0% | 799 ms |
| sweaterdog/andy-4:micro-q8_0 | table_no_tools | 10.0 | 0% | 0% | 557 ms |
| qwen2.5-coder:7b-instruct | tools_no_food | 76.0 | 100% | 100% | 1796 ms |
| qwen3:4b-instruct-2507-q4_K_M | tools_no_food | 39.0 | 0% | 0% | 635 ms |
| sweaterdog/andy-4:micro-q8_0 | tools_no_food | 10.0 | 0% | 0% | 332 ms |
| qwen3:4b-instruct-2507-q4_K_M | wood_no_tools | 65.0 | 0% | 100% | 665 ms |
| qwen2.5-coder:7b-instruct | wood_no_tools | 43.0 | 0% | 20% | 1711 ms |
| sweaterdog/andy-4:micro-q8_0 | wood_no_tools | 8.0 | 0% | 0% | 548 ms |

## Critérios

- JSON válido e sem texto externo: 10%
- Campos/tipos/prioridade/quantidade: 10%
- Ação permitida: 15%
- Pré-condições e alvo: 20%
- Prioridade estratégica: 25%
- Ausência de alucinação: 10%
- Latência e consistência são reportadas, mas ainda não entram no score numérico.
