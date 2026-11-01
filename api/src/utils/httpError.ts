export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }

  static badRequest(message: string, details?: unknown) {
    return new HttpError(400, "bad_request", message, details);
  }
  static unauthorized(message = "Authentication required") {
    return new HttpError(401, "unauthorized", message);
  }
  static forbidden(message = "You don't have access to this resource") {
    return new HttpError(403, "forbidden", message);
  }
  static notFound(what = "Resource") {
    return new HttpError(404, "not_found", `${what} not found`);
  }
  static conflict(message: string) {
    return new HttpError(409, "conflict", message);
  }
}
