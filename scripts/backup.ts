import { createLocalBackup } from "../src/server/data/backup";
import { prisma } from "../src/server/db/prisma";

createLocalBackup()
  .then(({ record }) => {
    console.log(`Created backup ${record.filename}`);
  })
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
