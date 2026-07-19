import "server-only";

import { z } from "zod";

const environmentSchema = z.enum(["sandbox", "production"]);

export type PlaidEnvironmentName = z.infer<typeof environmentSchema>;

export function getPlaidConfiguration() {
  const clientId = process.env.PLAID_CLIENT_ID?.trim();
  const secret = process.env.PLAID_SECRET?.trim();
  const environmentResult = environmentSchema.safeParse(process.env.PLAID_ENV?.trim());
  const encryptionKey = process.env.PLAID_TOKEN_ENCRYPTION_KEY?.trim();
  const redirectUri = process.env.PLAID_REDIRECT_URI?.trim() || undefined;
  const webhookUrl = process.env.PLAID_WEBHOOK_URL?.trim() || undefined;
  const realConnectionsEnabled = process.env.PLAID_REAL_CONNECTIONS_ENABLED === "true";
  const configured = Boolean(clientId && secret && environmentResult.success && encryptionKey);

  return {
    configured,
    environment: environmentResult.success ? environmentResult.data : null,
    redirectUri,
    webhookUrl,
    realConnectionsEnabled,
    missing: [
      !clientId && "PLAID_CLIENT_ID",
      !secret && "PLAID_SECRET",
      !environmentResult.success && "PLAID_ENV",
      !encryptionKey && "PLAID_TOKEN_ENCRYPTION_KEY",
    ].filter(Boolean) as string[],
  };
}

export function requirePlaidSecrets() {
  const publicConfiguration = getPlaidConfiguration();
  if (!publicConfiguration.configured || !publicConfiguration.environment) {
    throw new Error(`Plaid is not configured. Missing: ${publicConfiguration.missing.join(", ")}.`);
  }
  return {
    clientId: process.env.PLAID_CLIENT_ID!.trim(),
    secret: process.env.PLAID_SECRET!.trim(),
    environment: publicConfiguration.environment,
    redirectUri: publicConfiguration.redirectUri,
    webhookUrl: publicConfiguration.webhookUrl,
    realConnectionsEnabled: publicConfiguration.realConnectionsEnabled,
  };
}
