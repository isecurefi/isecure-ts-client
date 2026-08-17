import { WSChannel } from "../../src/index.js";
import { authenticate, configFromEnv } from "../shared/auth.js";

async function main(): Promise<void> {
  const client = new WSChannel(configFromEnv());
  await authenticate(client);

  const files = await client.listFiles({ Status: "ALL" });
  console.log(JSON.stringify(files, null, 2));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
