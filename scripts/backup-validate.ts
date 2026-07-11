import { validateBackupPackage } from "../src/server/data/backup";
import { prisma } from "../src/server/db/prisma";

const file = process.argv[2];
if (!file) {
  console.error("Usage: npm run backup:validate -- <backup-file>");
  process.exit(1);
}

validateBackupPackage(file)
  .then((result) => {
    console.log(
      JSON.stringify(
        {
          valid: result.valid,
          compatibility: result.compatibility,
          integrityCheck: result.integrityCheck,
          transactions: result.manifest.counts.transactions,
        },
        null,
        2,
      ),
    );
  })
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
