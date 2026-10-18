import { ISecureError } from "./errors.js";

export type RegistrationPasswordIssue =
  "too_short" | "missing_uppercase" | "missing_lowercase" | "missing_number" | "missing_symbol";

// Current published WS API Register contract (wsapi_v2.json), not a login restriction.
const MINIMUM_LENGTH = 20;
const MESSAGES: Record<RegistrationPasswordIssue, string> = {
  too_short: `Use at least ${MINIMUM_LENGTH} characters.`,
  missing_uppercase: "Include an uppercase letter (A-Z).",
  missing_lowercase: "Include a lowercase letter (a-z).",
  missing_number: "Include a number (0-9).",
  missing_symbol: "Include a special character, such as !, @, # or _.",
};
// Cognito's documented symbol set; other Unicode characters do not satisfy this requirement.
// https://docs.aws.amazon.com/cognito/latest/developerguide/managing-users-passwords.html
const SYMBOLS = "^$*.[]{}()?\"!@#%&/\\,><':;|_~`=+-";

/** Local registration failure. Contains only fixed issue codes/messages, never the password. */
export class ISecurePasswordValidationError extends ISecureError {
  readonly issues: readonly RegistrationPasswordIssue[];

  constructor(issues: readonly RegistrationPasswordIssue[]) {
    super(`Password does not meet registration requirements. ${issues.map((issue) => MESSAGES[issue]).join(" ")}`);
    this.name = "ISecurePasswordValidationError";
    this.issues = Object.freeze([...issues]);
  }
}

/**
 * Checks the published WS API registration policy without network requests or changing the input.
 * Throws ISecurePasswordValidationError listing all unmet requirements. Server checks remain final;
 * encryption separately checks its key-dependent UTF-8 byte limit. Do not apply this to login.
 */
export function validateRegistrationPassword(password: string): void {
  const characters = Array.from(password);
  const issues: RegistrationPasswordIssue[] = [];
  if (characters.length < MINIMUM_LENGTH) issues.push("too_short");
  if (!/[A-Z]/u.test(password)) issues.push("missing_uppercase");
  if (!/[a-z]/u.test(password)) issues.push("missing_lowercase");
  if (!/[0-9]/u.test(password)) issues.push("missing_number");
  if (!characters.some((character) => SYMBOLS.includes(character)) && !password.slice(1, -1).includes(" ")) {
    issues.push("missing_symbol");
  }
  if (issues.length > 0) throw new ISecurePasswordValidationError(issues);
}
