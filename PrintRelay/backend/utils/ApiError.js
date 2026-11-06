export class ApiError extends Error {
  constructor(status, message, details, code) {
    super(message);
    this.status = status;
    this.details = details;
    this.code = code;
  }
  static badRequest(msg, details, code) { return new ApiError(400, msg, details, code); }
  static unauthorized(msg = 'Please sign in to continue', code) { return new ApiError(401, msg, undefined, code); }
  static forbidden(msg = 'You do not have permission to do that', code) { return new ApiError(403, msg, undefined, code); }
  static notFound(msg = 'Not found') { return new ApiError(404, msg); }
  static conflict(msg, details, code) { return new ApiError(409, msg, details, code); }
  static unprocessable(msg, details, code) { return new ApiError(422, msg, details, code); }
}
