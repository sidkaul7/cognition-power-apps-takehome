export class AppError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have permission to do this.") {
    super(message, 403);
  }
}

export class UnauthenticatedError extends AppError {
  constructor(message = "Sign in to continue.") {
    super(message, 401);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Record not found.") {
    super(message, 404);
  }
}

/** A business rule blocked the change, such as the two-person rule or an invalid status change. */
export class RuleError extends AppError {
  constructor(message: string) {
    super(message, 409);
  }
}
