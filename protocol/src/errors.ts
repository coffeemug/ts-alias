export class AliasError extends Error {
  constructor(public identifier: string, message?: string) {
    super(message);
    this.name = "AliasError";
  }
}
