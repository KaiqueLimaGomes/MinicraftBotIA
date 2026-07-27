import { ExecutionAbortedError } from './execution-errors.js'

export function createExecutionContext({
  executionId,
  action,
  bot,
  controller,
  startedAt,
  timeoutMs,
  isCurrent
}) {
  const assertActive = () => {
    if (controller.signal.aborted || !isCurrent()) {
      throw new ExecutionAbortedError()
    }
  }

  return Object.freeze({
    executionId,
    action,
    bot,
    signal: controller.signal,
    startedAt,
    deadlineAt: startedAt + timeoutMs,
    assertActive,
    isCurrent
  })
}
