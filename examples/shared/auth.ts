import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import {
  parseMode,
  type AuthPromptAdapter,
  type AuthState,
  type IWSChannel,
  type Mode,
  type WSChannel,
} from "../../src/index.js";

export function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value;
}

export function configFromEnv(overrides: Partial<IWSChannel> = {}): IWSChannel {
  return {
    ApiKey: process.env.ISECURE_API_KEY ?? "0",
    Company: requiredEnv("ISECURE_COMPANY"),
    Name: requiredEnv("ISECURE_NAME"),
    Password: overrides.Password ?? requiredEnv("ISECURE_PASSWORD"),
    Phone: requiredEnv("ISECURE_PHONE"),
    PublicKey: overrides.PublicKey ?? requiredEnv("ISECURE_PUBLIC_KEY_PEM"),
    BaseUrl: process.env.ISECURE_BASE_URL ?? "https://ws-api.test.isecure.fi/v2",
    Email: overrides.Email ?? requiredEnv("ISECURE_EMAIL"),
    Mode: parseMode(process.env.ISECURE_MODE ?? "data"),
    Bank: process.env.ISECURE_BANK ?? "nordea",
    ...overrides,
  };
}

class EnvOrTerminalPromptAdapter implements AuthPromptAdapter {
  constructor(private readonly mode: Mode) {}

  async requestMfaCode(state: Extract<AuthState, { status: "needs_mfa" }>): Promise<string> {
    return this.valueOrPrompt("MFA_CODE", `${state.method.toUpperCase()} MFA code: `);
  }

  async requestEmailCode(): Promise<string> {
    return this.valueOrPrompt("EMAIL_CODE", "Email verification code: ");
  }

  async requestPhoneCode(): Promise<string> {
    return this.valueOrPrompt("PHONE_CODE", "Phone verification code: ");
  }

  private async valueOrPrompt(suffix: string, question: string): Promise<string> {
    const modeValue = process.env[`ISECURE_${this.mode.toUpperCase()}_${suffix}`];
    const sharedValue = process.env[`ISECURE_${suffix}`];
    return modeValue ?? sharedValue ?? ask(question);
  }
}

async function ask(question: string): Promise<string> {
  const rl = createInterface({ input, output });
  try {
    return await rl.question(question);
  } finally {
    rl.close();
  }
}

export async function authenticate(client: WSChannel): Promise<void> {
  const state = await client.loginWithPrompt(new EnvOrTerminalPromptAdapter(client.props.Mode));

  if (state.status === "stalled") {
    throw new Error(
      `Login stalled on ${state.step} after ${state.transitions} transitions; an accepted verification did not advance login.`,
    );
  }
  if (state.status === "failed") {
    throw new Error(`Login failed (${state.reason}): ${state.responseText}`);
  }
  if (state.status !== "authenticated") {
    throw new Error(`Login did not authenticate: ${state.status}`);
  }
}
