import fs from 'node:fs/promises'
import path from 'node:path'
import { performance } from 'node:perf_hooks'

const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://127.0.0.1:11434/api/generate'
const RUNS_PER_SCENARIO = Number(process.env.RUNS_PER_SCENARIO ?? 5)

const models = (process.env.MODELS?.split(',').map(s => s.trim()).filter(Boolean)) ?? [
  'qwen3:4b-instruct-2507-q4_K_M',
  'qwen2.5-coder:7b-instruct',
  'sweaterdog/andy-4:micro-q8_0'
]

const actionCatalog = {
  collect_wood: {
    requires: state => state.nearby.includes('oak_tree') || state.nearby.includes('tree'),
    validTargets: ['oak_log', 'oak_tree', 'tree', 'wood'],
    quantity: { min: 1, max: 16 }
  },
  craft_planks: {
    requires: state => countItem(state, 'oak_log') >= 1,
    validTargets: ['oak_planks', 'planks'],
    quantity: { min: 1, max: 64 }
  },
  craft_crafting_table: {
    requires: state => countItem(state, 'oak_planks') >= 4 || countItem(state, 'oak_log') >= 1,
    validTargets: ['crafting_table'],
    quantity: { min: 1, max: 1 }
  },
  craft_tool: {
    requires: state => state.hasCraftingTable && (countItem(state, 'oak_planks') >= 3 || countItem(state, 'stick') >= 2),
    validTargets: ['wooden_pickaxe', 'wooden_axe', 'stone_pickaxe', 'stone_axe', 'tool'],
    quantity: { min: 1, max: 2 }
  },
  collect_food: {
    requires: state => state.nearby.includes('cow') || state.nearby.includes('sheep') || state.nearby.includes('pig') || state.nearby.includes('chicken'),
    validTargets: ['cow', 'sheep', 'pig', 'chicken', 'food', 'beef', 'mutton', 'porkchop'],
    quantity: { min: 1, max: 8 }
  },
  eat_food: {
    requires: state => hasAnyFood(state),
    validTargets: ['food', 'beef', 'mutton', 'porkchop', 'cooked_beef', 'raw_beef'],
    quantity: { min: 1, max: 1 }
  },
  mine_stone: {
    requires: state => hasTool(state, 'pickaxe') && state.nearby.includes('stone'),
    validTargets: ['stone', 'cobblestone'],
    quantity: { min: 1, max: 32 }
  },
  mine_coal: {
    requires: state => hasTool(state, 'pickaxe') && state.nearby.includes('coal_ore'),
    validTargets: ['coal_ore', 'coal'],
    quantity: { min: 1, max: 16 }
  },
  mine_iron: {
    requires: state => hasTool(state, 'stone_pickaxe') && state.nearby.includes('iron_ore'),
    validTargets: ['iron_ore'],
    quantity: { min: 1, max: 16 }
  },
  build_temporary_shelter: {
    requires: state => buildingBlocks(state) >= 12,
    validTargets: ['near_current_position', 'base_location', 'temporary_shelter', 'shelter'],
    quantity: { min: 1, max: 1 }
  },
  return_to_base: {
    requires: state => state.baseKnown,
    validTargets: ['base', 'base_location'],
    quantity: { min: 0, max: 0 }
  },
  store_items: {
    requires: state => state.baseKnown && state.hasChest && state.inventoryFull,
    validTargets: ['chest', 'base_chest', 'storage'],
    quantity: { min: 0, max: 64 }
  },
  flee_threat: {
    requires: state => state.threatImmediate,
    validTargets: ['safe_location', 'away_from_threat', 'base'],
    quantity: { min: 0, max: 0 }
  },
  explore_area: {
    requires: state => !state.threatImmediate && state.hunger > 6,
    validTargets: ['nearby_area', 'area', 'unknown_area'],
    quantity: { min: 0, max: 0 }
  },
  wait: {
    requires: () => true,
    validTargets: ['current_position', 'safe_position'],
    quantity: { min: 0, max: 0 }
  }
}

const allowedActions = Object.keys(actionCatalog)

const scenarios = [
  scenario('morning_empty_inventory', 'Manhã, inventário vazio, árvores próximas', {
    time: 'morning',
    health: 20,
    hunger: 20,
    inventory: {},
    nearby: ['oak_tree', 'grass', 'sheep', 'stone'],
    shelter: false,
    tools: [],
    hasCraftingTable: false,
    baseKnown: false
  }, ['collect_wood']),
  scenario('wood_no_tools', 'Madeira coletada, nenhuma ferramenta', {
    time: 'morning',
    health: 20,
    hunger: 20,
    inventory: { oak_log: 8 },
    nearby: ['oak_tree', 'stone'],
    shelter: false,
    tools: [],
    hasCraftingTable: false,
    baseKnown: false
  }, ['craft_planks', 'craft_crafting_table']),
  scenario('planks_no_table', 'Tábuas prontas, sem bancada', {
    time: 'morning',
    health: 20,
    hunger: 19,
    inventory: { oak_planks: 12 },
    nearby: ['stone', 'cow'],
    shelter: false,
    tools: [],
    hasCraftingTable: false,
    baseKnown: false
  }, ['craft_crafting_table']),
  scenario('table_no_tools', 'Bancada pronta, sem ferramentas', {
    time: 'morning',
    health: 20,
    hunger: 18,
    inventory: { oak_planks: 8, stick: 4 },
    nearby: ['stone', 'cow'],
    shelter: false,
    tools: [],
    hasCraftingTable: true,
    baseKnown: false
  }, ['craft_tool']),
  scenario('tools_no_food', 'Ferramentas básicas prontas, sem comida', {
    time: 'afternoon',
    health: 20,
    hunger: 12,
    inventory: { wooden_pickaxe: 1, wooden_axe: 1 },
    nearby: ['cow', 'sheep', 'stone'],
    shelter: false,
    tools: ['wooden_pickaxe', 'wooden_axe'],
    hasCraftingTable: true,
    baseKnown: false
  }, ['collect_food']),
  scenario('night_soon_no_shelter', 'Noite próxima, madeira disponível, sem abrigo', {
    time: 'dusk',
    timeUntilNightSeconds: 90,
    health: 20,
    hunger: 18,
    inventory: { oak_log: 12, raw_beef: 3 },
    nearby: ['stone', 'dirt'],
    shelter: false,
    tools: ['wooden_pickaxe'],
    hasCraftingTable: true,
    baseKnown: false
  }, ['build_temporary_shelter']),
  scenario('shelter_no_light', 'Abrigo pronto, sem iluminação, carvão visível', {
    time: 'night',
    health: 20,
    hunger: 16,
    inventory: { cobblestone: 16, oak_log: 3 },
    nearby: ['coal_ore', 'stone'],
    shelter: true,
    tools: ['stone_pickaxe'],
    hasCraftingTable: true,
    baseKnown: true
  }, ['mine_coal']),
  scenario('hunger_crisis_animal_nearby', 'Fome crítica, animal próximo', {
    time: 'afternoon',
    health: 14,
    hunger: 4,
    inventory: { iron_ore: 6, cobblestone: 20 },
    nearby: ['cow'],
    shelter: true,
    tools: ['stone_sword', 'stone_pickaxe'],
    hasCraftingTable: true,
    baseKnown: true
  }, ['collect_food']),
  scenario('hunger_crisis_food_inventory', 'Fome crítica, comida no inventário', {
    time: 'afternoon',
    health: 13,
    hunger: 3,
    inventory: { raw_beef: 2, cobblestone: 20 },
    nearby: ['stone'],
    shelter: true,
    tools: ['stone_pickaxe'],
    hasCraftingTable: true,
    baseKnown: true
  }, ['eat_food']),
  scenario('low_health_hostile_nearby', 'Vida baixa, inimigo próximo', {
    time: 'night',
    health: 6,
    hunger: 15,
    inventory: { oak_log: 4, raw_beef: 1 },
    nearby: ['zombie'],
    shelter: false,
    tools: ['wooden_sword'],
    hasCraftingTable: false,
    baseKnown: true,
    threatImmediate: true
  }, ['flee_threat']),
  scenario('inventory_full_base_known', 'Inventário cheio, base conhecida', {
    time: 'afternoon',
    health: 20,
    hunger: 16,
    inventory: { cobblestone: 64, oak_log: 32, coal: 16, iron_ore: 8 },
    inventoryFull: true,
    nearby: ['stone'],
    shelter: true,
    tools: ['stone_pickaxe'],
    hasCraftingTable: true,
    baseKnown: true,
    hasChest: true
  }, ['store_items', 'return_to_base']),
  scenario('iron_visible_no_coal', 'Ferro disponível, sem carvão', {
    time: 'afternoon',
    health: 20,
    hunger: 14,
    inventory: { cobblestone: 20 },
    nearby: ['iron_ore', 'coal_ore', 'stone'],
    shelter: true,
    tools: ['stone_pickaxe'],
    hasCraftingTable: true,
    baseKnown: true
  }, ['mine_coal', 'mine_iron'])
]

const promptRules = `
You are the planner for a Minecraft survival bot.
Return ONLY valid JSON. No markdown. No commentary. No text outside JSON.

Schema:
{"goal":"string","action":"string","target":"string","quantity":0,"priority":1,"reason":"string"}

Allowed actions:
${allowedActions.join(', ')}

Principles:
1. First satisfy prerequisites that unlock later actions.
2. Address immediate threats before long-term goals.
3. Never select an action whose prerequisites are unavailable.
4. Prefer the smallest useful action that advances survival.
5. Do not build permanent structures before basic tools and resources exist, unless night or immediate danger requires shelter.
6. Priority 10 means urgent and immediately executable.
7. The chosen action should normally have high priority.

Basic progression:
wood -> planks -> crafting table -> basic tools -> food -> temporary shelter before night -> stone tools -> light/fuel -> iron progression
Use progression only when the required prerequisite is actually missing.
Never repeat a completed progression step.
Inventory, threats, hunger and time override generic progression.
`.trim()

const results = []

for (const model of models) {
  for (const scenario of scenarios) {
    for (let run = 1; run <= RUNS_PER_SCENARIO; run++) {
      const prompt = buildPrompt(scenario)
      const started = performance.now()
      const response = await generate(model, prompt)
      const latencyMs = Math.round(performance.now() - started)
      const evaluation = evaluate(response, scenario)

      const row = {
        model,
        scenario: scenario.id,
        run,
        latencyMs,
        response,
        ...evaluation
      }
      results.push(row)
      console.log(`${model} | ${scenario.id} | ${run}/${RUNS_PER_SCENARIO} | score=${evaluation.score} | action=${evaluation.action ?? 'INVALID'} | ${latencyMs}ms`)
    }
  }
}

const report = buildReport(results)
const outDir = path.resolve('results')
const latestJsonPath = path.join(outDir, 'latest.json')
const latestMdPath = path.join(outDir, 'latest.md')

await fs.mkdir(outDir, { recursive: true })
await fs.writeFile(latestJsonPath, JSON.stringify(results, null, 2), 'utf8')
await fs.writeFile(latestMdPath, report, 'utf8')

console.log('')
console.log(`Relatório JSON: ${latestJsonPath}`)
console.log(`Relatório MD:   ${latestMdPath}`)

function scenario(id, title, state, expectedActions) {
  return { id, title, state: normalizeState(state), expectedActions }
}

function normalizeState(state) {
  return {
    time: state.time ?? 'unknown',
    timeUntilNightSeconds: state.timeUntilNightSeconds ?? null,
    health: state.health ?? 20,
    hunger: state.hunger ?? 20,
    inventory: state.inventory ?? {},
    inventoryFull: Boolean(state.inventoryFull),
    nearby: state.nearby ?? [],
    shelter: Boolean(state.shelter),
    tools: state.tools ?? [],
    hasCraftingTable: Boolean(state.hasCraftingTable),
    baseKnown: Boolean(state.baseKnown),
    hasChest: Boolean(state.hasChest),
    threatImmediate: Boolean(state.threatImmediate)
  }
}

function buildPrompt(scenario) {
  return `${promptRules}

State:
${stateToText(scenario.state)}

Expected output: choose the single best next action.`
}

function stateToText(state) {
  return [
    `Time: ${state.time}`,
    state.timeUntilNightSeconds === null ? null : `Time until night: ${state.timeUntilNightSeconds} seconds`,
    `Health: ${state.health}`,
    `Hunger: ${state.hunger}`,
    `Inventory: ${inventoryToText(state.inventory)}${state.inventoryFull ? ' (full)' : ''}`,
    `Nearby: ${state.nearby.join(', ') || 'nothing notable'}`,
    `Shelter exists: ${state.shelter}`,
    `Tools: ${state.tools.join(', ') || 'none'}`,
    `Crafting table available: ${state.hasCraftingTable}`,
    `Base known: ${state.baseKnown}`,
    `Chest available at base: ${state.hasChest}`,
    `Immediate threat: ${state.threatImmediate}`
  ].filter(Boolean).join('\n')
}

function inventoryToText(inventory) {
  const entries = Object.entries(inventory)
  if (entries.length === 0) return 'empty'
  return entries.map(([item, qty]) => `${qty} ${item}`).join(', ')
}

async function generate(model, prompt) {
  const body = {
    model,
    prompt,
    stream: false,
    options: {
      temperature: 0.2,
      num_ctx: 8192,
      num_predict: 300
    }
  }

  const res = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Ollama error ${res.status}: ${text}`)
  }

  const json = await res.json()
  return String(json.response ?? '').trim()
}

function evaluate(response, scenario) {
  const exactJsonOnly = looksLikeJsonOnly(response)
  const parsed = parseJson(response)
  const jsonValid = parsed !== null
  const fieldsValid = jsonValid && validateFields(parsed)
  const action = fieldsValid ? parsed.action : null
  const actionExists = Boolean(action && allowedActions.includes(action))
  const preconditionsMet = actionExists && actionCatalog[action].requires(scenario.state)
  const strategicCorrect = actionExists && scenario.expectedActions.includes(action)
  const noHallucination = jsonValid && isGrounded(parsed, scenario.state, actionExists)
  const priorityCoherent = fieldsValid && Number.isInteger(parsed.priority) && (
    strategicCorrect ? parsed.priority >= 7 : parsed.priority >= 1
  )
  const targetValid = actionExists && targetMatches(parsed.target, actionCatalog[action].validTargets)
  const quantityValid = actionExists && quantityMatches(parsed.quantity, actionCatalog[action].quantity)

  const rawScore =
    (jsonValid && exactJsonOnly ? 10 : 0) +
    (fieldsValid && priorityCoherent && quantityValid ? 10 : 0) +
    (actionExists ? 15 : 0) +
    (preconditionsMet && targetValid ? 20 : 0) +
    (strategicCorrect ? 25 : 0) +
    (noHallucination ? 10 : 0)
  const score = rawScore / 90 * 100

  return {
    exactJsonOnly,
    jsonValid,
    fieldsValid,
    action,
    target: fieldsValid ? parsed.target : null,
    quantity: fieldsValid ? parsed.quantity : null,
    priority: fieldsValid ? parsed.priority : null,
    actionExists,
    preconditionsMet,
    strategicCorrect,
    noHallucination,
    priorityCoherent,
    targetValid,
    quantityValid,
    rawScore,
    score
  }
}

function looksLikeJsonOnly(response) {
  const trimmed = response.trim()
  return trimmed.startsWith('{') && trimmed.endsWith('}')
}

function validateFields(parsed) {
  return typeof parsed.goal === 'string'
    && typeof parsed.action === 'string'
    && typeof parsed.target === 'string'
    && Number.isInteger(parsed.quantity)
    && parsed.quantity >= 0
    && Number.isInteger(parsed.priority)
    && parsed.priority >= 1
    && parsed.priority <= 10
    && typeof parsed.reason === 'string'
}

function parseJson(response) {
  try {
    return JSON.parse(response)
  } catch {
    const match = response.match(/\{[\s\S]*\}/)
    if (!match) return null
    try {
      return JSON.parse(match[0])
    } catch {
      return null
    }
  }
}

function isGrounded(parsed, state, actionExists) {
  if (!parsed || !actionExists) return false
  const normalized = normalizeTarget(parsed.target)
  const observed = new Set([
    ...Object.keys(state.inventory),
    ...state.nearby,
    ...state.tools,
    ...(state.baseKnown ? ['base_location'] : []),
    ...(state.hasChest ? ['base_chest'] : []),
    ...(state.hasCraftingTable ? ['crafting_table'] : [])
  ])
  const producible = new Set([
    'oak_planks', 'crafting_table', 'wooden_pickaxe', 'wooden_axe',
    'stone_pickaxe', 'stone_axe', 'temporary_shelter', 'near_current_position',
    'safe_location', 'nearby_area'
  ])
  return observed.has(normalized) || producible.has(normalized) ||
    actionCatalog[parsed.action].validTargets.map(normalizeTarget).includes(normalized)
}

function targetMatches(target, validTargets) {
  const normalized = normalizeTarget(target)
  return validTargets.map(normalizeTarget).includes(normalized)
}

function normalizeTarget(target) {
  const value = String(target ?? '').trim().toLowerCase().replaceAll(' ', '_')
  const aliases = {
    tree: 'oak_tree', wood: 'oak_log', planks: 'oak_planks', base: 'base_location',
    shelter: 'temporary_shelter', chest: 'base_chest', storage: 'base_chest',
    away_from_threat: 'safe_location', current_position: 'near_current_position',
    safe_position: 'safe_location', area: 'nearby_area', unknown_area: 'nearby_area'
  }
  return aliases[value] ?? value
}

function quantityMatches(quantity, rule) {
  return Number.isInteger(quantity) && quantity >= rule.min && quantity <= rule.max
}

function countItem(state, item) {
  return Number(state.inventory[item] ?? 0)
}

function hasTool(state, namePart) {
  return state.tools.some(tool => tool.includes(namePart)) || Object.keys(state.inventory).some(item => item.includes(namePart))
}

function hasAnyFood(state) {
  return ['raw_beef', 'cooked_beef', 'beef', 'mutton', 'porkchop', 'chicken', 'bread', 'apple'].some(item => countItem(state, item) > 0)
}

function buildingBlocks(state) {
  return ['oak_log', 'oak_planks', 'cobblestone', 'dirt', 'stone'].reduce((sum, item) => sum + countItem(state, item), 0)
}

function buildReport(rows) {
  const grouped = summarize(rows)
  const lines = [
    '# Experimento 0004 — Benchmark de planner local',
    '',
    `Data: ${new Date().toISOString()}`,
    '',
    `Modelos: ${models.join(', ')}`,
    '',
    `Cenários: ${scenarios.length}`,
    '',
    `Execuções por cenário: ${RUNS_PER_SCENARIO}`,
    '',
    '## Resumo por modelo',
    '',
    '| Modelo | Score normalizado | JSON puro válido | Campos/tipos | Ação permitida | Pré-condição | Estratégia | Fundamentada no estado | Cold start | Aquecida média | p50 | p95 | Máxima |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|'
  ]

  for (const item of grouped) {
    lines.push(`| ${item.model} | ${item.avgScore.toFixed(1)}/100 | ${pct(item.exactJsonValidRate)} | ${pct(item.fieldsValidRate)} | ${pct(item.actionExistsRate)} | ${pct(item.preconditionsRate)} | ${pct(item.strategicRate)} | ${pct(item.noHallucinationRate)} | ${item.coldStartMs} ms | ${Math.round(item.warmAvgLatencyMs)} ms | ${item.p50LatencyMs} ms | ${item.p95LatencyMs} ms | ${item.maxLatencyMs} ms |`)
  }

  lines.push('')
  lines.push('## Resumo por cenário')
  lines.push('')
  lines.push('| Modelo | Cenário | Score médio | Estratégia | Pré-condição | Latência média |')
  lines.push('|---|---|---:|---:|---:|---:|')

  for (const item of summarizeByScenario(rows)) {
    lines.push(`| ${item.model} | ${item.scenario} | ${item.avgScore.toFixed(1)} | ${pct(item.strategicRate)} | ${pct(item.preconditionsRate)} | ${Math.round(item.avgLatencyMs)} ms |`)
  }

  lines.push('')
  lines.push('## Critérios')
  lines.push('')
  lines.push('- JSON válido e sem texto externo: 10%')
  lines.push('- Campos/tipos/prioridade/quantidade: 10%')
  lines.push('- Ação permitida: 15%')
  lines.push('- Pré-condições e alvo: 20%')
  lines.push('- Prioridade estratégica: 25%')
  lines.push('- Fundamentação no estado observado e no catálogo: 10%')
  lines.push('- O total bruto de 90 pontos é normalizado para uma escala de 0 a 100.')
  lines.push('- Latência e consistência são reportadas, mas ainda não entram no score numérico.')
  lines.push('')

  return lines.join('\n')
}

function summarize(rows) {
  return [...groupBy(rows, row => row.model).entries()].map(([model, items]) => ({
    model,
    avgScore: avg(items.map(i => i.score)),
    exactJsonValidRate: avg(items.map(i => Number(i.jsonValid && i.exactJsonOnly))),
    fieldsValidRate: avg(items.map(i => Number(i.fieldsValid))),
    actionExistsRate: avg(items.map(i => Number(i.actionExists))),
    preconditionsRate: avg(items.map(i => Number(i.preconditionsMet && i.targetValid))),
    strategicRate: avg(items.map(i => Number(i.strategicCorrect))),
    noHallucinationRate: avg(items.map(i => Number(i.noHallucination))),
    avgLatencyMs: avg(items.map(i => i.latencyMs)),
    coldStartMs: items[0].latencyMs,
    warmAvgLatencyMs: avg(items.slice(1).map(i => i.latencyMs)),
    p50LatencyMs: percentile(items.map(i => i.latencyMs), 0.50),
    p95LatencyMs: percentile(items.map(i => i.latencyMs), 0.95),
    maxLatencyMs: Math.max(...items.map(i => i.latencyMs))
  })).sort((a, b) => b.avgScore - a.avgScore)
}

function summarizeByScenario(rows) {
  return [...groupBy(rows, row => `${row.model}///${row.scenario}`).entries()].map(([key, items]) => {
    const [model, scenario] = key.split('///')
    return {
      model,
      scenario,
      avgScore: avg(items.map(i => i.score)),
      strategicRate: avg(items.map(i => Number(i.strategicCorrect))),
      preconditionsRate: avg(items.map(i => Number(i.preconditionsMet && i.targetValid))),
      avgLatencyMs: avg(items.map(i => i.latencyMs))
    }
  }).sort((a, b) => a.scenario.localeCompare(b.scenario) || b.avgScore - a.avgScore)
}

function groupBy(items, keyFn) {
  const map = new Map()
  for (const item of items) {
    const key = keyFn(item)
    const bucket = map.get(key) ?? []
    bucket.push(item)
    map.set(key, bucket)
  }
  return map
}

function avg(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function pct(value) {
  return `${Math.round(value * 100)}%`
}

function percentile(values, quantile) {
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.ceil(quantile * sorted.length) - 1
  return sorted[Math.max(0, index)]
}
