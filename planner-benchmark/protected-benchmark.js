import fs from 'node:fs/promises'
import { performance } from 'node:perf_hooks'
import { actionCatalog, allowedActions, normalizeState, normalizeTarget } from './planner/action-catalog.js'
import { parseStrictJson } from './planner/decision-schema.js'
import { normalizeDecision } from './planner/normalize-decision.js'
import { createPlanner } from './planner/planner.js'
import { validateDecision } from './planner/validate-decision.js'

const MODEL = process.env.MODEL ?? 'qwen3:4b-instruct-2507-q4_K_M'
const RUNS = Number(process.env.RUNS_PER_SCENARIO ?? 5)
const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://127.0.0.1:11434/api/generate'

const scenarios = [
  s('empty_inventory', { inventory: {}, nearby: ['oak_tree', 'sheep', 'stone'] }, ['collect_wood']),
  s('logs_no_planks', { inventory: { oak_log: 8 }, nearby: ['oak_tree', 'stone'] }, ['craft_planks']),
  s('planks_no_table', { inventory: { oak_planks: 12 }, nearby: ['cow', 'stone'] }, ['craft_crafting_table']),
  s('table_no_tools', { inventory: { oak_planks: 8, stick: 4 }, nearby: ['cow', 'stone'], hasCraftingTable: true }, ['craft_tool']),
  s('needs_food', { hunger: 12, inventory: { wooden_pickaxe: 1 }, tools: ['wooden_pickaxe'], nearby: ['cow', 'stone'], hasCraftingTable: true }, ['collect_food']),
  s('night_soon', { time: 'dusk', timeUntilNightSeconds: 90, shelterStatus: 'absent', inventory: { oak_log: 12, raw_beef: 3 }, tools: ['wooden_pickaxe'], nearby: ['stone'] }, ['build_temporary_shelter'], true),
  s('needs_coal', { time: 'night', inventory: { cobblestone: 16 }, tools: ['stone_pickaxe'], nearby: ['coal_ore', 'stone'], shelter: true, baseKnown: true }, ['mine_coal']),
  s('critical_hunger_food', { health: 13, hunger: 3, inventory: { raw_beef: 2 }, nearby: ['stone'], shelter: true, baseKnown: true }, ['eat_food'], true),
  s('critical_hunger_animal', { health: 14, hunger: 4, inventory: {}, nearby: ['cow'], tools: ['stone_sword'], shelter: true }, ['collect_food'], true),
  s('low_health_threat', { time: 'night', health: 6, hunger: 15, inventory: {}, nearby: ['zombie'], threatImmediate: true, baseKnown: true }, ['flee_threat'], true),
  s('inventory_full', { inventoryFull: true, inventory: { cobblestone: 64 }, nearby: ['stone'], baseKnown: true, hasChest: true, shelter: true }, ['store_items'], true),
  s('iron_and_coal', { hunger: 14, inventory: { cobblestone: 20 }, nearby: ['iron_ore', 'coal_ore', 'stone'], tools: ['stone_pickaxe'], shelter: true, baseKnown: true }, ['mine_coal', 'mine_iron'])
]

const rows = []
let callIndex = 0

for (const scenario of scenarios) {
  for (let run = 1; run <= RUNS; run++) {
    const rawStart = performance.now()
    const rawText = await generate(basePrompt(scenario.state))
    const rawLatencyMs = Math.round(performance.now() - rawStart)
    const rawEvaluation = evaluateText(rawText, scenario)

    const planner = createPlanner({ generate })
    const protectedStart = performance.now()
    const protectedResult = await planner.decide(scenario.state)
    const protectedLatencyMs = Math.round(performance.now() - protectedStart)
    const finalValidation = validateDecision(protectedResult.decision, scenario.state)
    const strategicCorrect = scenario.expected.includes(protectedResult.decision.action)

    rows.push({
      scenario: scenario.id,
      critical: scenario.critical,
      run,
      raw: { latencyMs: rawLatencyMs, ...rawEvaluation },
      protected: {
        latencyMs: protectedLatencyMs,
        ...protectedResult,
        finalStructural: finalValidation.structural,
        finalCatalogExecutable: finalValidation.catalogExecutable,
        finalExecutable: finalValidation.catalogExecutable,
        strategicCorrect
      }
    })
    console.log(`${scenario.id} ${run}/${RUNS} raw=${rawEvaluation.action ?? 'INVALID'} final=${protectedResult.decision.action} source=${protectedResult.source}`)
  }
}

const summary = summarize(rows)
await fs.mkdir('results', { recursive: true })
await fs.writeFile('results/protected-latest.json', JSON.stringify({ model: MODEL, summary, rows }, null, 2))
await fs.writeFile('results/protected-latest.md', markdown(summary))
console.log(JSON.stringify(summary, null, 2))

function s(id, input, expected, critical = false) {
  return { id, state: normalizeState(input), expected, critical }
}

async function generate(prompt) {
  callIndex++
  const response = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      prompt,
      stream: false,
      options: { temperature: 0.2, num_ctx: 8192, num_predict: 240 }
    })
  })
  if (!response.ok) throw new Error(`Ollama ${response.status}: ${await response.text()}`)
  return String((await response.json()).response ?? '').trim()
}

function basePrompt(state) {
  return `You are the planner for a Minecraft survival bot.
Return ONLY valid JSON:
{"goal":"string","action":"string","target":"string","quantity":0,"priority":1,"reason":"string"}
Allowed actions: ${allowedActions.join(', ')}
Never select an action that cannot start from the observed state.
Use progression only when its prerequisite is missing. Never repeat a completed step.
Inventory, threats, hunger and time override generic progression.
State:
${JSON.stringify(state)}
Choose the single best next action.`
}

function evaluateText(text, scenario) {
  const parsed = parseStrictJson(text)
  if (!parsed.ok) return { structural: false, executable: false, strategicCorrect: false, action: null }
  const decision = normalizeDecision(parsed.value)
  const validation = validateDecision(decision, scenario.state)
  return {
    structural: validation.structural,
    executable: validation.executable,
    strategicCorrect: scenario.expected.includes(decision.action),
    action: decision.action
  }
}

function summarize(items) {
  const rawLatencies = items.map(row => row.raw.latencyMs)
  const protectedLatencies = items.map(row => row.protected.latencyMs)
  const repairRows = items.filter(row => row.protected.repaired)
  const critical = items.filter(row => row.critical)
  return {
    model: MODEL,
    scenarios: scenarios.length,
    runsPerScenario: RUNS,
    totalCases: items.length,
    rawStructuralRate: rate(items, row => row.raw.structural),
    rawExecutableRate: rate(items, row => row.raw.executable),
    protectedStructuralRate: rate(items, row => row.protected.finalStructural),
    protectedCatalogExecutableRate: rate(items, row => row.protected.finalCatalogExecutable),
    protectedExecutableRate: rate(items, row => row.protected.finalCatalogExecutable),
    criticalCorrectRate: rate(critical, row => row.protected.strategicCorrect),
    fallbackRate: rate(items, row => row.protected.fallbackUsed),
    repairAttemptRate: rate(items, row => row.protected.repaired),
    repairSuccessRate: repairRows.length ? rate(repairRows, row => row.protected.source === 'llm_repair') : 1,
    rawStrategicRate: rate(items, row => row.raw.strategicCorrect),
    protectedStrategicRate: rate(items, row => row.protected.strategicCorrect),
    coldStartMs: rawLatencies[0],
    rawWarmP95Ms: percentile(rawLatencies.slice(1), 0.95),
    protectedWarmP95Ms: percentile(protectedLatencies.slice(1), 0.95),
    maxPlannerCalls: Math.max(...items.map(row => row.protected.attempts)),
    totalOllamaCalls: callIndex
    ,
    failureTaxonomy: countBy(
      items.flatMap(row => row.protected.failures ?? []),
      failure => failure.category
    ),
    mechanicalRepairTaxonomy: countBy(
      items.flatMap(row => row.protected.mechanicalRepairs ?? []),
      repair => repair.reason
    ),
    intentionalSafetyOverrideRate: rate(items, row => row.protected.source === 'safety_override'),
    llmFailureFallbackRate: rate(items, row => row.protected.source === 'fallback')
  }
}

function markdown(x) {
  return `# Experimento 0005 - Planner protegido

Data: ${new Date().toISOString()}

Modelo: ${MODEL}

| Metrica | Qwen3 bruto | Planner protegido | Meta |
|---|---:|---:|---:|
| Estruturalmente valida | ${pct(x.rawStructuralRate)} | ${pct(x.protectedStructuralRate)} | 100% |
| Executavel no catalogo | ${pct(x.rawExecutableRate)} | ${pct(x.protectedCatalogExecutableRate)} | >= 99% |
| Estrategicamente correta | ${pct(x.rawStrategicRate)} | ${pct(x.protectedStrategicRate)} | observacao |
| Cenarios criticos corretos | - | ${pct(x.criticalCorrectRate)} | 100% |
| Uso de fallback | - | ${pct(x.fallbackRate)} | <= 20% |
| Safety override intencional | - | ${pct(x.intentionalSafetyOverrideRate)} | separado |
| Fallback por falha da LLM | - | ${pct(x.llmFailureFallbackRate)} | <= 20% |
| Reparo bem-sucedido | - | ${pct(x.repairSuccessRate)} | >= 70% |
| Latencia aquecida p95 | ${x.rawWarmP95Ms} ms | ${x.protectedWarmP95Ms} ms | <= 2000 ms |
| Maximo de chamadas por decisao | 1 | ${x.maxPlannerCalls} | 2 |

O planner protegido permite uma unica correcao. Se ela falha, aplica fallback deterministico.

## Taxonomia de falhas

\`\`\`json
${JSON.stringify(x.failureTaxonomy, null, 2)}
\`\`\`

## Reparos mecanicos

\`\`\`json
${JSON.stringify(x.mechanicalRepairTaxonomy, null, 2)}
\`\`\`
`
}

function rate(items, predicate) {
  return items.length ? items.filter(predicate).length / items.length : 0
}

function percentile(values, quantile) {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.max(0, Math.ceil(quantile * sorted.length) - 1)]
}

function pct(value) {
  return `${Math.round(value * 100)}%`
}

function countBy(items, keyFn) {
  const counts = {}
  for (const item of items) {
    const key = keyFn(item) ?? 'UNKNOWN'
    counts[key] = (counts[key] ?? 0) + 1
  }
  return counts
}
