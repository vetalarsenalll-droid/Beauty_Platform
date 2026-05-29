export class CrmAgentActionError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "CrmAgentActionError";
  }
}

export class CrmAgentValidationError extends CrmAgentActionError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "ACTION_VALIDATION_FAILED", details);
    this.name = "CrmAgentValidationError";
  }
}

export class CrmAgentPermissionError extends CrmAgentActionError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "ACTION_PERMISSION_DENIED", details);
    this.name = "CrmAgentPermissionError";
  }
}

export class CrmAgentConflictError extends CrmAgentActionError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "ACTION_CONFLICT", details);
    this.name = "CrmAgentConflictError";
  }
}

export class CrmAgentNotFoundError extends CrmAgentActionError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "ACTION_TARGET_NOT_FOUND", details);
    this.name = "CrmAgentNotFoundError";
  }
}

export class CrmAgentPolicyError extends CrmAgentActionError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "ACTION_POLICY_BLOCKED", details);
    this.name = "CrmAgentPolicyError";
  }
}

export class CrmAgentExecutionError extends CrmAgentActionError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "ACTION_EXECUTION_FAILED", details);
    this.name = "CrmAgentExecutionError";
  }
}
