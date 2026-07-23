import "./load-env";
import { runMessagingRoundtripProbe } from "../src/lib/community-flow-probe";
import { prisma } from "../src/lib/db";

main().catch((err) => {
  console.error("Messaging roundtrip check failed:");
  console.error(String(err));
  process.exit(1);
});

async function main() {
  try {
    console.log(JSON.stringify(await runMessagingRoundtripProbe()));
  } finally {
    await prisma.$disconnect();
  }
}
