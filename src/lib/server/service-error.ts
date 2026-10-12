// An error from an outside service (Gemini, Adaption) that is safe to show to the user.
// `code` lets the browser pick the right message (for example "not_configured"); `status` is the HTTP status
// our own API answers with. The message never contains keys or raw service responses.
export class ServiceError<Code extends string = string> extends Error {
  code: Code;
  status: number;

  constructor(message: string, code: Code, status: number) {
    super(message);
    this.name = "ServiceError";
    this.code = code;
    this.status = status;
  }
}
