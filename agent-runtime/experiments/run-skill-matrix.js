import fs from 'node:fs/promises'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import mineflayer from 'mineflayer'
import pathfinderPackage from 'mineflayer-pathfinder'
import { Rcon } from 'rcon-client'
import { SkillRunner } from '../runtime/skill-runner.js'
import { createSkillRegistry } from '../runtime/skill-registry.js'
import { validateExperimentConfig } from './experiment-config.js'
import { createSafeMovements } from '../primitives/safe-movements.js'

const { pathfinder } = pathfinderPackage
const username = process.env.MC_USERNAME ?? 'AgenteExecutor'
const rconHost = process.env.MC_RCON_HOST ?? '127.0.0.1'
const rconPort = Number(process.env.MC_RCON_PORT ?? 25575)
const repetitions = Number(process.env.SKILL_REPETITIONS ?? 10)
const experimentId = '0007C'
const localPropertiesPath = path.resolve('../server/server.properties')
const localProperties = await fs.readFile(localPropertiesPath, 'utf8')
  .catch(() => '')
const localPassword = localProperties
  .split(/\r?\n/)
  .find((line) => line.startsWith('rcon.password='))
  ?.slice('rcon.password='.length)
const rconPassword = process.env.MC_RCON_PASSWORD ?? localPassword
const configValidation = validateExperimentConfig({
  rconHost,
  password: rconPassword,
  repetitions,
  allowRemote: process.env.ALLOW_REMOTE_RCON === 'true'
})
if (!configValidation.ok) {
  throw new Error(`Invalid experiment configuration: ${configValidation.reason}`)
}

const arena = {
  x: Number(process.env.SKILL_ARENA_X ?? 100),
  y: Number(process.env.SKILL_ARENA_Y ?? 120),
  z: Number(process.env.SKILL_ARENA_Z ?? 100)
}
const bot = mineflayer.createBot({
  host: process.env.MC_HOST ?? '127.0.0.1',
  port: Number(process.env.MC_PORT ?? 25565),
  username,
  version: process.env.MC_VERSION ?? '1.21.11',
  auth: process.env.MC_AUTH ?? 'offline'
})
bot.loadPlugin(pathfinder)

const rcon = await Rcon.connect({
  host: rconHost,
  port: rconPort,
  password: rconPassword
})
const results = []
const chains = []
let fatalError = null
let activeChain = null

function count(name) {
  return bot.inventory.items()
    .filter((item) => item.name === name)
    .reduce((sum, item) => sum + item.count, 0)
}

async function waitUntil(predicate, label, timeoutMs = 3_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (predicate()) return
    await delay(50)
  }
  throw new Error(`Preparation timeout: ${label}`)
}

async function command(value) {
  const response = await rcon.send(value)
  if (/unknown|incorrect|error/i.test(response)) {
    throw new Error(`RCON command failed: ${response}`)
  }
}

async function prepareCommon() {
  await command(`gamemode survival ${username}`)
  await command(`clear ${username}`)
  await command(`effect clear ${username}`)
  await command('gamerule minecraft:block_drops true')
  await waitUntil(() => bot.inventory.items().length === 0, 'empty inventory')
}

async function prepareArena() {
  const { x, y, z } = arena
  await command(`fill ${x - 5} ${y - 1} ${z - 5} ${x + 20} ${y - 1} ${z + 5} minecraft:stone`)
  await command(`fill ${x - 5} ${y} ${z - 5} ${x + 20} ${y + 5} ${z + 5} minecraft:air`)
  await command(`tp ${username} ${x + 0.5} ${y} ${z + 0.5}`)
  await waitUntil(
    () => Math.abs(bot.entity.position.x - (x + 0.5)) < 2 &&
      Math.abs(bot.entity.position.y - y) < 2 &&
      Math.abs(bot.entity.position.z - (z + 0.5)) < 2,
    'arena teleport'
  )
  await delay(1_500)
}

function snapshot() {
  return {
    health: bot.health,
    food: bot.food,
    position: {
      x: bot.entity.position.x,
      y: bot.entity.position.y,
      z: bot.entity.position.z
    },
    inventory: bot.inventory.items().map(({ name, count: itemCount }) => ({
      name,
      count: itemCount
    }))
  }
}

async function runOne(runner, action, sample, params = {}) {
  const result = await runner.run({ bot, action, params })
  results.push({
    action,
    sample,
    ...result,
    finishedAt: new Date().toISOString()
  })
  console.log(
    `[experiment] ${action} ${sample}/${repetitions} ` +
    `${result.status} ${result.durationMs}ms`
  )
  return result
}

async function runMatrix() {
  bot.pathfinder.setMovements(createSafeMovements(bot))
  const craftRunner = new SkillRunner({
    registry: createSkillRegistry(),
    mode: 'limited',
    defaultTimeoutMs: 5_000,
    snapshotProvider: async () => snapshot()
  })

  for (let sample = 1; sample <= repetitions; sample += 1) {
    await prepareCommon()
    await command(`give ${username} minecraft:oak_log 1`)
    await waitUntil(() => count('oak_log') === 1, 'oak log')
    await runOne(craftRunner, 'craft_planks', sample)
  }

  for (let sample = 1; sample <= repetitions; sample += 1) {
    await prepareCommon()
    await command(`give ${username} minecraft:oak_planks 4`)
    await waitUntil(() => count('oak_planks') === 4, 'oak planks')
    await runOne(craftRunner, 'craft_crafting_table', sample)
  }

  const chainRunner = new SkillRunner({
    registry: createSkillRegistry(),
    mode: 'limited',
    defaultTimeoutMs: 90_000,
    snapshotProvider: async () => snapshot()
  })
  for (let sample = 1; sample <= repetitions; sample += 1) {
    await prepareCommon()
    await prepareArena()
    const target = { x: arena.x + 10, y: arena.y, z: arena.z }
    await command(`setblock ${target.x} ${target.y} ${target.z} minecraft:oak_log`)
    await waitUntil(
      () => bot.blockAt(bot.entity.position.offset(9.5, 0, -0.5))?.name === 'oak_log',
      'distant oak log'
    )
    await delay(2_000)
    activeChain = { target, extraBlockChanges: [] }
    const collect = await runOne(chainRunner, 'collect_wood', sample, {
      serverVersion: process.env.MC_VERSION ?? '1.21.11'
    })
    const planks = await runOne(chainRunner, 'craft_planks', sample)
    const table = await runOne(chainRunner, 'craft_crafting_table', sample)
    const chain = {
      sample,
      treeFoundAutomatically: collect.evidence?.target?.x === target.x,
      logCollected: collect.success,
      planksCrafted: planks.success,
      tableCrafted: table.success,
      success: collect.success && planks.success && table.success &&
        count('crafting_table') === 1,
      extraBlockChanges: activeChain.extraBlockChanges
    }
    chains.push(chain)
    activeChain = null
    console.log(
      `[${experimentId}] chain ${sample}/${repetitions} ` +
      `${chain.success ? 'succeeded' : 'failed'} ` +
      `extraBlockChanges=${chain.extraBlockChanges.length}`
    )
  }
}

bot.on('blockUpdate', (oldBlock, newBlock) => {
  if (!activeChain || oldBlock.type === newBlock.type) return
  const position = oldBlock.position
  const insideArena =
    position.x >= arena.x - 5 &&
    position.x <= arena.x + 20 &&
    position.y >= arena.y - 1 &&
    position.y <= arena.y + 5 &&
    position.z >= arena.z - 5 &&
    position.z <= arena.z + 5
  if (!insideArena) return
  const isTarget = position.x === activeChain.target.x &&
    position.y === activeChain.target.y &&
    position.z === activeChain.target.z
  if (!isTarget) {
    activeChain.extraBlockChanges.push({
      x: position.x,
      y: position.y,
      z: position.z,
      before: oldBlock.name,
      after: newBlock.name
    })
  }
})

function percentile95(values) {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.ceil(sorted.length * 0.95) - 1]
}

async function writeReports() {
  const actions = ['craft_planks', 'craft_crafting_table', 'collect_wood']
  const summary = Object.fromEntries(actions.map((action) => {
    const rows = results.filter((row) => row.action === action)
    return [action, {
      samples: rows.length,
      successes: rows.filter((row) => row.success).length,
      p95Ms: percentile95(rows.map((row) => row.durationMs))
    }]
  }))
  const report = {
    experiment: experimentId,
    generatedAt: new Date().toISOString(),
    status: results.length === repetitions * 5 &&
      chains.length === repetitions &&
      !fatalError
      ? 'COMPLETE'
      : 'INCOMPLETE',
    repetitions,
    summary,
    chainSummary: {
      samples: chains.length,
      successes: chains.filter((row) => row.success).length,
      treesFoundAutomatically: chains.filter(
        (row) => row.treeFoundAutomatically
      ).length,
      logsCollected: chains.filter((row) => row.logCollected).length,
      planksCrafted: chains.filter((row) => row.planksCrafted).length,
      tablesCrafted: chains.filter((row) => row.tableCrafted).length,
      extraBlockChanges: chains.reduce(
        (sum, row) => sum + row.extraBlockChanges.length,
        0
      )
    },
    passed: results.filter((row) => row.action === 'craft_planks').length ===
      repetitions * 2 &&
      summary.craft_planks.successes === repetitions * 2 &&
      results.filter((row) =>
        row.action === 'craft_crafting_table'
      ).length === repetitions * 2 &&
      summary.craft_crafting_table.successes === repetitions * 2 &&
      chains.length === repetitions &&
      chains.every((row) => row.success && row.extraBlockChanges.length === 0),
    fatalError,
    results,
    chains
  }
  const outputDirectory = path.resolve(`experiment-results/${experimentId}`)
  await fs.mkdir(outputDirectory, { recursive: true })
  await fs.writeFile(
    path.join(outputDirectory, `${experimentId}-latest.json`),
    `${JSON.stringify(report, null, 2)}\n`
  )
  const lines = [
    `# Experimento ${experimentId} - cadeia limitada end-to-end`,
    '',
    `Status: ${report.status}`,
    `Passed: ${report.passed}`,
    '',
    '| Skill | Success | Samples | p95 |',
    '|---|---:|---:|---:|',
    ...actions.map((action) => {
      const row = summary[action]
      return `| ${action} | ${row.successes} | ${row.samples} | ${row.p95Ms ?? '-'} ms |`
    })
  ]
  lines.push(
    '',
    `Cadeias: ${report.chainSummary.successes}/${report.chainSummary.samples}`,
    `Arvores encontradas automaticamente: ${report.chainSummary.treesFoundAutomatically}/${report.chainSummary.samples}`,
    `Alteracoes extras de blocos: ${report.chainSummary.extraBlockChanges}`
  )
  if (fatalError) lines.push('', `Fatal error: ${fatalError}`)
  await fs.writeFile(
    path.join(outputDirectory, `${experimentId}-latest.md`),
    `${lines.join('\n')}\n`
  )
}

try {
  await new Promise((resolve, reject) => {
    bot.once('spawn', resolve)
    bot.once('error', reject)
  })
  await delay(1_000)
  await runMatrix()
} catch (error) {
  fatalError = error.message
  process.exitCode = 1
} finally {
  await writeReports()
  try {
    await prepareCommon()
  } catch {
    // Preserve the original result if final cleanup fails.
  }
  bot.quit('Automated skill experiment completed')
  await rcon.end()
}
