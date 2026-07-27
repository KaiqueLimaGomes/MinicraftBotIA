export function toExecutionTelemetry(result, {
  plannerLatencyMs = null,
  endToEndStartedAt = null
} = {}) {
  return {
    executionId: result.executionId,
    action: result.action,
    status: result.status,
    code: result.code,
    success: result.success,
    plannerLatencyMs,
    skillLatencyMs: result.durationMs,
    endToEndLatencyMs: endToEndStartedAt === null
      ? result.durationMs
      : Date.now() - endToEndStartedAt,
    canExecuteRejected: result.code === 'CAN_EXECUTE_REJECTED',
    timedOut: result.code === 'EXECUTION_TIMEOUT',
    abortSucceeded: result.code === 'EXECUTION_ABORTED' ||
      result.code === 'EXECUTION_TIMEOUT',
    falsePositive: result.code === 'VERIFY_PROGRESS_FAILED',
    partialProgress: result.evidence?.partialProgress === true,
    orphanEffect: result.evidence?.orphanEffect === true
  }
}
