import fs from 'node:fs/promises'
import path from 'node:path'
import mineflayer from 'mineflayer'
import { createPlanner } from '../planner-benchmark/planner/planner.js'
import { validateDecision } from '../planner-benchmark/planner/validate-decision.js'
import { createStateSnapshot, snapshotFingerprint } from './state-snapshot.js'

const config = {
  host: process.env.MC_HOST ?? '127.0.0.1',
  port: Number(process.env.MC_PORT ?? 25565),
  username: process.env.MC_USERNAME ?? 'AgenteShadow',
  auth: process.env.MC_AUTH ?? 'offline'
}
if (process.env.MC_VERSION) config.version = process.env.MC_VERSION

const intervalMs = Number(process.env.SHADOW_INTERVAL_MS ?? 15000)
const durationMs = Number(process.env.SHADOW_DURATION_MS ?? 1200000)
const model = process.env.OLLAMA_MODEL ?? 'qwen3:4b-instruct-2507-q4_K_M'
const ollamaUrl = process.env.OLLAMA_URL ?? 'http://127.0.0.1:11434/api/generate'
const logPath = path.resolve('shadow-results', `shadow-${new Date().toISOString().replaceAll(':', '-')}.jsonl`)
const bot = mineflayer.createBot(config)
const planner = createPlanner({ generate })
let timer
let deciding = false
let previousAction = null

bot.once('spawn', async () => {
  console.log(`[shadow] ${bot.username} connected. No actions will be executed.`)
  await fs.mkdir(path.dirname(logPath), { recursive: true })
  await observe()
  timer = setInterval(observe, intervalMs)
  setTimeout(stop, durationMs)
})

bot.on('kicked', reason => console.error('[shadow:kicked]', reason))
bot.on('error', error => console.error('[shadow:error]', error))
bot.on('end', () => {
  if (timer) clearInterval(timer)
  console.log(`[shadow:end] Log: ${logPath}`)
})

async function observe() {
  if (deciding || !bot.entity) return
  deciding = true
  try {
    const before = createStateSnapshot(bot)
    const beforeFingerprint = snapshotFingerprint(before)
    const started = performance.now()
    const output = await planner.decide(before)
    const latencyMs = Math.round(performance.now() - started)
    const after = createStateSnapshot(bot)
    const stateChanged = beforeFingerprint !== snapshotFingerprint(after)
    const stillValid = validateDecision(output.decision, after).executable
    const repeated = previousAction === output.decision.action
    previousAction = output.decision.action
    const record = {
      type: 'shadow_decision',
      timestamp: new Date().toISOString(),
      latencyMs,
      stateChangedDuringInference: stateChanged,
      decisionStillExecutable: stillValid,
      repeatedAction: repeated,
      snapshot: before,
      stateAfterInference: after,
      planner: output
    }
    await appendRecord(record)
    console.log(`[shadow] ${output.decision.action} source=${output.source} validAfter=${stillValid} changed=${stateChanged} ${latencyMs}ms`)
  } catch (error) {
    await appendRecord({
      type: 'shadow_error', timestamp: new Date().toISOString(), message: error.message
    })
    console.error('[shadow:observe]', error)
  } finally {
    deciding = false
  }
}

async function appendRecord(record) {
  try {
    await fs.appendFile(logPath, `${JSON.stringify(record)}\n`, 'utf8')
  } catch (error) {
    console.error('[shadow:log]', error.message)
  }
}

async function generate(prompt) {
  const response = await fetch(ollamaUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      options: { temperature: 0.2, num_ctx: 4096, num_predict: 120 }
    })
  })
  if (!response.ok) throw new Error(`Ollama ${response.status}: ${await response.text()}`)
  return String((await response.json()).response ?? '').trim()
}

function stop() {
  if (timer) clearInterval(timer)
  bot.quit('Shadow mode completed')
}
