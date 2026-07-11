import { readFileSync } from "node:fs";
import { restoreBackup } from "../src/server/data/backup";
import { prisma } from "../src/server/db/prisma";

const file = process.argv[2];
const yesForTest = process.argv.includes("--yes-for-test");
if (!file) {
  console.error("Usage: npm run restore -- <backup-file> [--yes-for-test]");
  process.exit(1);
}

restoreBackup(readFileSync(file), {
  confirmation: yesForTest ? "RESTORE BACKUP" : (process.env.RESTORE_CONFIRMATION ?? ""),
})
  .then((result) => {
    console.log(`Restored backup. Safety backup: ${result.safetyBackup.filename}`);
  })
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
