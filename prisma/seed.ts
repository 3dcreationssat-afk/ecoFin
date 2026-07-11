import { seedDemoData } from "../src/server/data/seed-demo";

seedDemoData("seed")
  .then((household) => {
    console.log(`Seeded synthetic household ${household.name}`);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
