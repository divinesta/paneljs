/** A deliberate, safe error that may be returned to an admin API caller. */
export class AdminApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "AdminApiError";
  }
}

export class AuthenticationError extends AdminApiError {
  constructor() {
    super(401, "AUTHENTICATION_REQUIRED", "Authentication required");
    this.name = "AuthenticationError";
  }
}

export class PermissionDeniedError extends AdminApiError {
  constructor() {
    super(403, "PERMISSION_DENIED", "Permission denied");
    this.name = "PermissionDeniedError";
  }
}

export class ModelNotFoundError extends AdminApiError {
  constructor() {
    super(404, "MODEL_NOT_FOUND", "Model not found");
    this.name = "ModelNotFoundError";
  }
}

export class RecordNotFoundError extends AdminApiError {
  constructor() {
    super(404, "RECORD_NOT_FOUND", "Record not found");
    this.name = "RecordNotFoundError";
  }
}
