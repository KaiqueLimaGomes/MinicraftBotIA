import fs from 'node:fs/promises'
import path from 'node:path'
import mineflayer from 'mineflayer'
import { createPlanner } from '../planner-benchmark/planner/planner.js'
import { validateDecision } from '../planner-benchmark/planner/validate-decision.js'
import { registeredBaseFromEnv } from './shadow-config.js'
import { snapshotMatchesExpectation } from './matrix-analysis.js'
import { getMatrixPhase } from './matrix-phases.js'
import {
  createStateSnapshot,
  snapshotDecisionFingerprint,
  snapshotWorldFingerprint
} from './state-snapshot.js'

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
const ollamaTimeoutMs = Number(process.env.OLLAMA_TIMEOUT_MS ?? 10000)
const matrixPhase = process.env.SHADOW_PHASE ? getMatrixPhase(process.env.SHADOW_PHASE) : null
const maxSnapshots = Number(process.env.SHADOW_MAX_SNAPSHOTS ?? (matrixPhase ? 3 : Infinity))
const logPath = path.resolve('shadow-results', `shadow-${new Date().toISOString().replaceAll(':', '-')}.jsonl`)
const snapshotOptions = {
  shelterStatus: process.env.SHELTER_STATUS ?? 'unknown',
  base: registeredBaseFromEnv(process.env)
}
const bot = mineflayer.createBot(config)
const planner = createPlanner({ generate })
let timer
let deciding = false
let previousObservation = null
let spawned = false
let connectionFailureHandled = false
let snapshotCount = 0
let stopping = false

bot.once('spawn', async () => {
  spawned = true
  console.log(`[shadow] ${bot.username} connected. No actions will be executed.`)
  await fs.mkdir(path.dirname(logPath), { recursive: true })
  await observe()
  if (!stopping) timer = setInterval(observe, intervalMs)
  if (!stopping) setTimeout(stop, durationMs)
})

bot.on('kicked', reason => console.error('[shadow:kicked]', reason))
bot.on('error', error => {
  console.error('[shadow:error]', error)
  if (!spawned && !connectionFailureHandled) {
    connectionFailureHandled = true
    appendRecord({
      type: 'shadow_connection_error',
      timestamp: new Date().toISOString(),
      code: error.code ?? null,
      message: error.message
    }).finally(() => {
      if (timer) clearInterval(timer)
      bot._client?.end('Connection failed')
      bot._client?.socket?.destroy()
      setTimeout(() => process.exit(1), 250)
    })
  }
})
bot.on('end', () => {
  if (timer) clearInterval(timer)
  console.log(`[shadow:end] Log: ${logPath}`)
})

async function observe() {
  if (deciding || !bot.entity) return
  deciding = true
  try {
    const before = createStateSnapshot(bot, snapshotOptions)
    const beforeDecisionFingerprint = snapshotDecisionFingerprint(before)
    const beforeWorldFingerprint = snapshotWorldFingerprint(before)
    const started = performance.now()
    const output = await planner.decide(before)
    const latencyMs = Math.round(performance.now() - started)
    const after = createStateSnapshot(bot, snapshotOptions)
    const worldChangedDuringInference =
      beforeWorldFingerprint !== snapshotWorldFingerprint(after)
    const decisionStateChangedDuringInference =
      beforeDecisionFingerprint !== snapshotDecisionFingerprint(after)
    const stillValid = validateDecision(output.decision, after).catalogExecutable
    const relation = decisionRelation(
      previousObservation,
      beforeDecisionFingerprint,
      output.decision.action
    )
    previousObservation = {
      fingerprint: beforeDecisionFingerprint,
      action: output.decision.action
    }
    const snapshotValidation = matrixPhase
      ? snapshotMatchesExpectation(before, matrixPhase.expectedSnapshot)
      : null
    const expectedActionMatched = matrixPhase
      ? matrixPhase.expectedActions.includes(output.decision.action)
      : null
    const record = {
      type: 'shadow_decision',
      timestamp: new Date().toISOString(),
      latencyMs,
      worldChangedDuringInference,
      decisionStateChangedDuringInference,
      stateChangedDuringInference: decisionStateChangedDuringInference,
      decisionStillExecutable: stillValid,
      decisionRelation: relation,
      snapshot: before,
      stateAfterInference: after,
      planner: output
      ,
      matrix: matrixPhase ? {
        phase: matrixPhase.number,
        description: matrixPhase.description,
        expectedActions: matrixPhase.expectedActions,
        expectedSnapshot: matrixPhase.expectedSnapshot,
        snapshotValidation,
        expectedActionMatched
      } : null
    }
    await appendRecord(record)
    snapshotCount++
    console.log(`[shadow] ${output.decision.action} source=${output.source} validAfter=${stillValid} decisionChanged=${decisionStateChangedDuringInference} ${latencyMs}ms`)
    if (matrixPhase) {
      console.log(`[matrix ${matrixPhase.number}] snapshot=${snapshotValidation.matches} expectedAction=${expectedActionMatched} sample=${snapshotCount}/${maxSnapshots}`)
    }
    if (snapshotCount >= maxSnapshots) stop()
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
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), ollamaTimeoutMs)
  try {
    const response = await fetch(ollamaUrl, {
      method: 'POST',
      signal: controller.signal,
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
  } finally {
    clearTimeout(timeout)
  }
}

function stop() {
  if (stopping) return
  stopping = true
  if (timer) clearInterval(timer)
  bot.quit('Shadow mode completed')
}

function decisionRelation(previous, fingerprint, action) {
  if (!previous) return 'first_observation'
  const sameState = previous.fingerprint === fingerprint
  const sameDecision = previous.action === action
  if (sameState && sameDecision) return 'same_state_same_decision'
  if (sameState) return 'same_state_different_decision'
  if (sameDecision) return 'changed_state_same_decision'
  return 'changed_state_different_decision'
}
