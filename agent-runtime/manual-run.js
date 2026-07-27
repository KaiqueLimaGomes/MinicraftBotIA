import mineflayer from 'mineflayer'
import pathfinderPackage from 'mineflayer-pathfinder'
import { createSafeMovements } from './primitives/safe-movements.js'
import { SkillRunner } from './runtime/skill-runner.js'
import { createSkillRegistry } from './runtime/skill-registry.js'

const { pathfinder } = pathfinderPackage

const action = process.env.MANUAL_ACTION
if (!action) {
  throw new Error('Set MANUAL_ACTION to one limited action')
}

const bot = mineflayer.createBot({
  host: process.env.MC_HOST ?? '127.0.0.1',
  port: Number(process.env.MC_PORT ?? 25565),
  username: process.env.MC_USERNAME ?? 'AgenteExecutor',
  version: process.env.MC_VERSION ?? '1.21.11',
  auth: process.env.MC_AUTH ?? 'offline'
})

bot.loadPlugin(pathfinder)

const runner = new SkillRunner({
  registry: createSkillRegistry(),
  mode: process.env.EXECUTION_MODE ?? 'shadow',
  defaultTimeoutMs: action === 'collect_wood' ? 90_000 : 5_000,
  snapshotProvider: async (currentBot) => ({
    position: currentBot.entity?.position
      ? {
          x: currentBot.entity.position.x,
          y: currentBot.entity.position.y,
          z: currentBot.entity.position.z
        }
      : null,
    inventory: currentBot.inventory.items().map(({ name, count }) => ({
      name,
      count
    }))
  })
})

bot.once('spawn', async () => {
  bot.pathfinder.setMovements(createSafeMovements(bot))
  const result = await runner.run({ bot, action })
  console.log(JSON.stringify(result, null, 2))
  bot.quit('Manual skill run completed')
})

bot.on('error', (error) => {
  console.error(`[agent-runtime] ${error.message}`)
})
