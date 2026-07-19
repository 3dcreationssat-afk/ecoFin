import "server-only";

import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";
import { requirePlaidSecrets } from "./config";

let cachedClient: PlaidApi | undefined;

export function plaidClient() {
  if (cachedClient) return cachedClient;
  const configuration = requirePlaidSecrets();
  cachedClient = new PlaidApi(
    new Configuration({
      basePath: PlaidEnvironments[configuration.environment],
      baseOptions: {
        headers: {
          "PLAID-CLIENT-ID": configuration.clientId,
          "PLAID-SECRET": configuration.secret,
        },
      },
    }),
  );
  return cachedClient;
}
