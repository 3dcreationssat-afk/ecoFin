import { backupDashboard } from "../src/server/data/backup";
import { prisma } from "../src/server/db/prisma";

backupDashboard()
  .then(({ records }) => {
    for (const record of records) {
      console.log(
        `${record.id} ${record.status} ${record.filename} ${record.createdAt.toISOString()}`,
      );
    }
  })
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
