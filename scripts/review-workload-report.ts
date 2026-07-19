import { reviewWorkloadReport } from "../src/server/data/review-workload";
import { prisma } from "../src/server/db/prisma";

reviewWorkloadReport()
  .then((report) => console.log(JSON.stringify(report, null, 2)))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Review workload report failed.");
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
