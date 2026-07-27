export class ExecutionModeError extends Error {
  constructor(message) {
    super(message)
    this.name = 'ExecutionModeError'
    this.code = 'EXECUTION_MODE_REJECTED'
  }
}

export class ExecutionBusyError extends Error {
  constructor(message) {
    super(message)
    this.name = 'ExecutionBusyError'
    this.code = 'EXECUTION_BUSY'
  }
}

export class ExecutionTimeoutError extends Error {
  constructor(message) {
    super(message)
    this.name = 'ExecutionTimeoutError'
    this.code = 'EXECUTION_TIMEOUT'
  }
}

export class ExecutionAbortedError extends Error {
  constructor(message = 'Execution aborted') {
    super(message)
    this.name = 'ExecutionAbortedError'
    this.code = 'EXECUTION_ABORTED'
  }
}
