import fs from 'node:fs/promises'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import mineflayer from 'mineflayer'
import pathfinderPackage from 'mineflayer-pathfinder'
import vec3Package from 'vec3'
import { Rcon } from 'rcon-client'
import { SkillRunner } from '../runtime/skill-runner.js'
import { createSkillRegistry } from '../runtime/skill-registry.js'
import { createSafeMovements } from '../primitives/safe-movements.js'

const { pathfinder } = pathfinderPackage
const { Vec3 } = vec3Package
const experimentId = process.env.PHYSICAL_EXPERIMENT ?? '0007A'
const serverVersion = process.env.PHYSICAL_SERVER_VERSION
const movement = process.env.PHYSICAL_MOVEMENT ?? 'none'
const gamePort = Number(process.env.MC_PORT)
const rconPort = Number(process.env.MC_RCON_PORT)
const repetitions = Number(process.env.PHYSICAL_REPETITIONS ?? 5)
const warmupMs = Number(process.env.PHYSICAL_WARMUP_MS ?? 5_000)
const username = `Executor${serverVersion?.replaceAll('.', '')}`
const propertiesPath = path.resolve(process.env.MC_SERVER_PROPERTIES)
const properties = await fs.readFile(propertiesPath, 'utf8')
const rconPassword = properties
  .split(/\r?\n/)
  .find((line) => line.startsWith('rcon.password='))
  ?.slice('rcon.password='.length)

if (!['1.21.11', '1.21.8'].includes(serverVersion)) {
  throw new Error('PHYSICAL_SERVER_VERSION must be 1.21.11 or 1.21.8')
}
if (!['none', 'pathfinder'].includes(movement)) {
  throw new Error('PHYSICAL_MOVEMENT must be none or pathfinder')
}
if (!rconPassword || !gamePort || !rconPort) {
  throw new Error('Missing local server/RCON configuration')
}

const arena = { x: 140, y: 120, z: 140 }
const target = { x: arena.x + 2, y: arena.y, z: arena.z }
const digAttempts = []
const results = []
let fatalError = null

const bot = mineflayer.createBot({
  host: '127.0.0.1',
  port: gamePort,
  username,
  version: serverVersion,
  auth: 'offline'
})
bot.loadPlugin(pathfinder)
const rcon = await Rcon.connect({
  host: '127.0.0.1',
  port: rconPort,
  password: rconPassword
})

async function command(value) {
  const response = await rcon.send(value)
  if (/unknown|incorrect|error/i.test(response)) {
    throw new Error(`RCON command failed: ${response}`)
  }
}

async function waitUntil(predicate, label, timeoutMs = 5_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (predicate()) return
    await delay(50)
  }
  throw new Error(`Preparation timeout: ${label}`)
}

async function prepare(sample) {
  await command(`gamemode survival ${username}`)
  await command(`clear ${username}`)
  await command(`effect clear ${username}`)
  await command(serverVersion === '1.21.11'
    ? 'gamerule minecraft:block_drops true'
    : 'gamerule doTileDrops true')
  const { x, y, z } = arena
  await command(`fill ${x - 10} ${y - 1} ${z - 5} ${x + 10} ${y - 1} ${z + 5} minecraft:stone`)
  await command(`fill ${x - 10} ${y} ${z - 5} ${x + 10} ${y + 5} ${z + 5} minecraft:air`)
  const startX = movement === 'none' ? x + 0.5 : x - 6.5
  await command(`tp ${username} ${startX} ${y} ${z + 0.5}`)
  await waitUntil(
    () => Math.abs(bot.entity.position.x - startX) < 1 &&
      Math.abs(bot.entity.position.y - y) < 1,
    `teleport sample ${sample}`
  )
  await delay(warmupMs)
  await command(`setblock ${target.x} ${target.y} ${target.z} minecraft:oak_log`)
  await waitUntil(
    () => bot.blockAt(new Vec3(target.x, target.y, target.z))?.name === 'oak_log',
    `target block sample ${sample}`
  )
}

async function executeCondition() {
  bot.pathfinder.setMovements(createSafeMovements(bot))
  const runner = new SkillRunner({
    registry: createSkillRegistry(),
    mode: 'limited',
    defaultTimeoutMs: 90_000,
    snapshotProvider: async () => ({
      onGround: bot.entity.onGround,
      position: {
        x: bot.entity.position.x,
        y: bot.entity.position.y,
        z: bot.entity.position.z
      },
      inventory: bot.inventory.items().map(({ name, count }) => ({ name, count }))
    })
  })

  for (let sample = 1; sample <= repetitions; sample += 1) {
    await prepare(sample)
    const result = await runner.run({
      bot,
      action: 'collect_wood',
      params: {
        target,
        serverVersion,
        attemptNumber: sample,
        recordDigAttempt: (attempt) => digAttempts.push(attempt),
        postDigVerificationMs: 1_000
      }
    })
    results.push({ sample, ...result })
    console.log(
      `[${experimentId}] ${serverVersion}/${movement} ${sample}/${repetitions} ` +
      `${result.status} ${result.code} ${result.durationMs}ms`
    )
  }
}

async function writeReport() {
  const condition = `${serverVersion}-${movement}`
  const report = {
    experiment: experimentId,
    condition,
    serverVersion,
    movement,
    repetitions,
    status: results.length === repetitions && !fatalError
      ? 'COMPLETE'
      : 'INCOMPLETE',
    fatalError,
    results,
    digAttempts
  }
  const directory = path.resolve(`experiment-results/${experimentId}`)
  await fs.mkdir(directory, { recursive: true })
  await fs.writeFile(
    path.join(directory, `${condition}.json`),
    `${JSON.stringify(report, null, 2)}\n`
  )
}

try {
  await new Promise((resolve, reject) => {
    bot.once('spawn', resolve)
    bot.once('error', reject)
  })
  await delay(1_000)
  await executeCondition()
} catch (error) {
  fatalError = error.message
  process.exitCode = 1
} finally {
  await writeReport()
  try {
    await command(`clear ${username}`)
  } catch {
    // Keep the original condition result.
  }
  bot.quit(`${experimentId} condition completed`)
  await rcon.end()
}
