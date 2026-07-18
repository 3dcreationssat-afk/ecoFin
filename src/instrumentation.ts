export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { assertDatabaseExists, configureDatabaseUrl } = await import("./server/db/database-url");
  const configured = configureDatabaseUrl();
  assertDatabaseExists(configured.path);
  const { prisma } = await import("./server/db/prisma");
  const workspaces = await prisma.workspaceMetadata.findMany({ take: 2 });
  if (workspaces.length !== 1) {
    throw new Error(
      `Database identity check failed: expected one workspace identity, found ${workspaces.length}.`,
    );
  }
  const workspace = workspaces[0];
  const expectedId = process.env.FINANCIAL_COMPASS_EXPECTED_WORKSPACE_ID;
  if (expectedId && workspace.id !== expectedId) {
    throw new Error("Database identity check failed: configured workspace ID does not match.");
  }
  console.info(
    `[Financial Compass] database=${configured.path} workspace=${workspace.id} type=${workspace.workspaceType}`,
  );
}
