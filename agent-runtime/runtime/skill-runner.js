import { randomUUID } from 'node:crypto'
import { createExecutionContext } from './execution-context.js'
import {
  ExecutionAbortedError,
  ExecutionBusyError,
  ExecutionModeError,
  ExecutionTimeoutError
} from './execution-errors.js'
import { LIMITED_ACTIONS } from './skill-registry.js'
import { stopNavigation } from '../primitives/navigation.js'
import { stopDigging } from '../primitives/digging.js'

function resultBase({ executionId, action, startedAt, source }) {
  return {
    executionId,
    action,
    source,
    startedAt: new Date(startedAt).toISOString()
  }
}

export class SkillRunner {
  #activeByBot = new WeakMap()

  constructor({
    registry,
    mode = process.env.EXECUTION_MODE ?? 'shadow',
    defaultTimeoutMs = 5_000,
    snapshotProvider = async () => ({})
  }) {
    this.registry = registry
    this.mode = mode
    this.defaultTimeoutMs = defaultTimeoutMs
    this.snapshotProvider = snapshotProvider
  }

  isRunning(bot) {
    return this.#activeByBot.has(bot)
  }

  abort(bot, reason = 'external_abort') {
    const active = this.#activeByBot.get(bot)
    if (!active) return false
    active.abortReason = reason
    active.controller.abort(reason)
    this.#stopBot(bot)
    return true
  }

  async run({ bot, action, params = {}, timeoutMs = this.defaultTimeoutMs }) {
    const executionId = randomUUID()
    const startedAt = Date.now()
    const base = resultBase({ executionId, action, startedAt, source: 'skill_runner' })

    if (this.mode !== 'limited') {
      return this.#rejected(base, new ExecutionModeError(
        `Execution mode "${this.mode}" does not permit world changes`
      ), startedAt)
    }

    if (!LIMITED_ACTIONS.has(action)) {
      return this.#rejected(base, new ExecutionModeError(
        `Action "${action}" is outside the limited allowlist`
      ), startedAt)
    }

    const skill = this.registry.get(action)
    if (!skill) {
      return this.#rejected(base, new ExecutionModeError(
        `Action "${action}" has no registered implementation`
      ), startedAt)
    }

    if (this.#activeByBot.has(bot)) {
      return this.#rejected(base, new ExecutionBusyError(
        `Bot is already running "${this.#activeByBot.get(bot).action}"`
      ), startedAt)
    }

    const controller = new AbortController()
    const active = { executionId, action, controller, abortReason: null }
    this.#activeByBot.set(bot, active)

    const isCurrent = () => this.#activeByBot.get(bot)?.executionId === executionId
    const context = createExecutionContext({
      executionId,
      action,
      bot,
      controller,
      startedAt,
      timeoutMs,
      isCurrent
    })

    let timer
    try {
      const snapshot = await this.snapshotProvider(bot)
      context.assertActive()

      const precondition = await skill.canExecute({ bot, params, snapshot, context })
      if (!precondition?.ok) {
        return {
          ...base,
          status: 'rejected',
          success: false,
          code: 'CAN_EXECUTE_REJECTED',
          reason: precondition?.reason ?? 'Skill precondition rejected',
          durationMs: Date.now() - startedAt
        }
      }

      const executionPromise = Promise.resolve(
        skill.execute({ bot, params, snapshot, context, precondition })
      )
      // A late rejection must be consumed even after the timeout wins the race.
      executionPromise.catch(() => {})

      const timeoutPromise = new Promise((_, reject) => {
        timer = setTimeout(() => {
          active.abortReason = 'timeout'
          reject(new ExecutionTimeoutError(
            `${action} timed out after ${timeoutMs}ms`
          ))
          controller.abort('timeout')
          this.#stopBot(bot)
        }, timeoutMs)
      })

      const abortPromise = new Promise((_, reject) => {
        controller.signal.addEventListener('abort', () => {
          if (active.abortReason !== 'timeout') {
            reject(new ExecutionAbortedError(
              `Execution aborted: ${active.abortReason ?? 'unknown'}`
            ))
          }
        }, { once: true })
      })

      const execution = await Promise.race([
        executionPromise,
        timeoutPromise,
        abortPromise
      ])
      context.assertActive()

      const verification = await skill.verifyProgress({
        bot,
        params,
        snapshot,
        context,
        precondition,
        execution
      })
      context.assertActive()

      const success = verification?.ok === true
      return {
        ...base,
        status: success ? 'succeeded' : 'failed',
        success,
        code: success ? 'SKILL_SUCCEEDED' : 'VERIFY_PROGRESS_FAILED',
        reason: verification?.reason ?? null,
        evidence: verification?.evidence ?? null,
        durationMs: Date.now() - startedAt
      }
    } catch (error) {
      return {
        ...base,
        status: error.code === 'EXECUTION_TIMEOUT' ? 'timed_out' : 'failed',
        success: false,
        code: error.code ?? 'SKILL_FAILED',
        reason: error.message,
        durationMs: Date.now() - startedAt
      }
    } finally {
      if (timer) clearTimeout(timer)
      controller.abort(active.abortReason ?? 'finished')
      this.#stopBot(bot)
      if (isCurrent()) this.#activeByBot.delete(bot)
    }
  }

  #stopBot(bot) {
    stopNavigation(bot)
    stopDigging(bot)
  }

  #rejected(base, error, startedAt) {
    return {
      ...base,
      status: 'rejected',
      success: false,
      code: error.code,
      reason: error.message,
      durationMs: Date.now() - startedAt
    }
  }
}
