import "./load-env";
import { runCommunityFlowProbe } from "../src/lib/community-flow-probe";
import { prisma } from "../src/lib/db";

const strictRealtime = process.argv.includes("--strict-realtime");

main().catch((err) => {
  console.error("Community flow check failed:");
  console.error(String(err));
  process.exit(1);
});

async function main() {
  try {
    await runCommunityFlowProbe({
      liveKitMode: "fake",
      strictRealtime,
    });
    console.log("Community flow check passed");
  } finally {
    await prisma.$disconnect();
  }
}
