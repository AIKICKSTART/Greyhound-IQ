/**
 * Seed script — populates the database with realistic sample data
 * for Australian greyhound racing so the site works on first load.
 *
 * Batched with createMany + client-generated ids to keep round-trips low
 * (the DB is a remote Supabase pooler; per-row inserts are far too slow).
 *
 * Run with: npm run db:seed
 */
import "../scripts/load-env";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";

const prisma = new PrismaClient();

const id = () => randomUUID();

async function createManyChunked<T>(
  create: (args: { data: T[] }) => Promise<unknown>,
  rows: T[],
  size = 1000
) {
  for (let i = 0; i < rows.length; i += size) {
    await create({ data: rows.slice(i, i + size) });
  }
}

// Realistic Australian greyhound tracks
const TRACKS = [
  { name: "Wentworth Park", state: "NSW", surface: "Sand", circumference: 520, straightLength: 100, hasIsolynx: false },
  { name: "Richmond", state: "NSW", surface: "Loam", circumference: 320, straightLength: 75, hasIsolynx: false },
  { name: "Bulli", state: "NSW", surface: "Sand", circumference: 300, straightLength: 70, hasIsolynx: false },
  { name: "The Meadows", state: "VIC", surface: "Sand", circumference: 525, straightLength: 105, hasIsolynx: true },
  { name: "Sandown Park", state: "VIC", surface: "Sand", circumference: 515, straightLength: 100, hasIsolynx: true },
  { name: "Geelong", state: "VIC", surface: "Sand", circumference: 400, straightLength: 80, hasIsolynx: false },
  { name: "Ballarat", state: "VIC", surface: "Sand", circumference: 450, straightLength: 85, hasIsolynx: false },
  { name: "Albion Park", state: "QLD", surface: "Loam", circumference: 520, straightLength: 100, hasIsolynx: false },
  { name: "Ipswich", state: "QLD", surface: "Sand", circumference: 380, straightLength: 75, hasIsolynx: false },
  { name: "Angle Park", state: "SA", surface: "Sand", circumference: 450, straightLength: 90, hasIsolynx: false },
  { name: "Mandurah", state: "WA", surface: "Sand", circumference: 400, straightLength: 80, hasIsolynx: false },
  { name: "Hobart", state: "TAS", surface: "Sand", circumference: 461, straightLength: 90, hasIsolynx: false },
  { name: "Launceston", state: "TAS", surface: "Sand", circumference: 480, straightLength: 95, hasIsolynx: false },
];

const TRAINERS = [
  "Jason Thompson", "David Greene", "Mark Riley", "Lisa Delaney",
  "Paul Stuart", "Donna Knight", "Graeme Bate", "James Langton",
  "Anthony Azzopardi", "Lorraine Atchison", "Keith Lester",
  "Robert Britton", "Jeffrey Britton", "Kel Greenough",
  "Peter Rocket", "Steve White", "Wayne Vassallo", "Corey Pell",
];

const SIRES = [
  "Barcia Bale", "Fernando Bale", "Kinloch Brae", "Premier Fantasy",
  "Spiral Nikita", "Superior Panama", "Surf Lorian", "Turrito Bale",
  "Awesome Assasin", "Magic Sprite", "Outa Credit", "Bogie LeBron",
];

const NAME_PREFIXES = [
  "Akina", "Aston", "Bago", "Black", "Blue", "Campbell", "Canya", "Catch",
  "Check", "Chocolate", "Cindy", "Citi", "Coral", "Cosmic", "Coty", "Crazy",
  "Daithi", "Dakota", "Dashing", "Demon", "Einstein", "Electric", "Elite",
  "Exciting", "Fair", "Fancy", "Federal", "Ferrari", "Flying", "Freak",
  "Got", "Grand", "Hallelujah", "Hard", "Holy", "Ima", "Infra", "Iron",
  "Itsa", "Jigsaw", "Johanna", "Jolly", "Jump", "Kingsley", "Knocka",
  "Konica", "Lake", "Lethal", "Light", "Lights", "Lismore", "Lizard",
  "Loka", "Looma", "Lucky", "Magic", "Majestic", "Manny", "Master",
  "Matsui", "Midnight", "Mind", "Morning", "My", "Mystic", "Nettie",
  "Nikita", "Noble", "Noosa", "Not", "Now", "Off", "Oh", "One", "Our",
  "Platinum", "Pocket", "Postman", "Power", "Prime", "Princess", "Queen",
  "Radiant", "Raging", "Rapid", "Raven", "React", "Red", "Remarkable",
  "Rhine", "Riptide", "Riveting", "Rocket", "Royal", "Rupers", "Shadow",
  "Shima", "Shock", "Silent", "Silver", "Simply", "Sleepy", "Smart",
  "Smooth", "Solar", "Sox", "Space", "Spring", "Stars", "Staunch",
  "Steel", "Sterling", "Stock", "Stonic", "Storm", "Strawberry", "Sun",
  "Super", "Sweet", "Tactical", "Tahlia", "Tara", "Thunder", "Tigger",
  "Tinker", "Tornado", "Torvi", "Toxic", "Track", "Trouble", "Turbo",
  "Unbeatable", "Unreal", "Urban", "Valiant", "Vander", "Velocity",
  "Venom", "Verra", "Vicious", "Violet", "Vodka", "Vocal", "Wagga",
  "Walking", "Wanted", "Watch", "West", "Whispering", "White", "Wild",
  "Winner", "Winx", "Wizard", "Wonder", "Xcite", "Xpress", "Xtra",
  "Yass", "Yogi", "Zen", "Zippy", "Zonda", "Zweck",
];

const NAME_SUFFIXES = [
  "Bale", "Belle", "Blast", "Bomb", "Bounder", "Boy", "Breeze", "Bullet",
  "Buster", "Capital", "Chain", "Charger", "Chaser", "Chief", "Class",
  "Comet", "Cruiser", "Delta", "Demon", "Destiny", "Diamond", "Dream",
  "Duchess", "Dynamo", "Eagle", "Echo", "Emperor", "Falcon", "Fancy",
  "Fever", "Fire", "Flame", "Flash", "Force", "Fox", "Freedom", "Fury",
  "Galaxy", "Gazelle", "Ghost", "Girl", "Glory", "Goddess", "Gold",
  "Grace", "Haze", "Heart", "Heaven", "Hero", "High", "Hunter", "Icon",
  "Impact", "Inferno", "Jewel", "Jinx", "Joker", "Joy", "Jumper", "Justice",
  "Kash", "King", "Kisses", "Knight", "Legend", "Lightning", "Lion",
  "Lord", "Magic", "Majesty", "Marauder", "Master", "Maestro", "Maverick",
  "Max", "Mirage", "Missile", "Mistress", "Myth", "Nemesis", "Ninja",
  "Nitro", "Nova", "Nugget", "Omega", "Oracle", "Outlaw", "Panther",
  "Pearl", "Phantom", "Phoenix", "Power", "Predator", "Premier", "Prince",
  "Princess", "Pride", "Prime", "Punch", "Queen", "Quest", "Racer",
  "Ranger", "Rascal", "Raven", "Rebel", "Reign", "Rhythm", "Riot",
  "Ripple", "Rocket", "Rogue", "Royale", "Runner", "Rush",
  "Sabre", "Sensation", "Shadow", "Shark", "Shield", "Shock", "Sky",
  "Slammer", "Sniper", "Solitaire", "Sonic", "Spark", "Spirit",
  "Star", "Starr", "Sterling", "Storm", "Strike", "Sundance", "Sunset",
  "Superstar", "Surprise", "Survivor", "Sword", "Tactic", "Talent",
  "Tango", "Tempest", "Thunder", "Tiger", "Titan", "Tornado", "Treasure",
  "Trick", "Triumph", "Trooper", "Turbo", "Tycoon", "Typhoon", "Universe",
  "Viper", "Vortex", "Voyage", "Warrior", "Whisper", "Wild", "Wing",
  "Winner", "Wizard", "Wonder", "Xtreme", "Yield", "Zenith", "Zone",
];

const DOG_COLOURS = ["Black", "Brindle", "Fawn", "Blue", "White", "Black & White"];
const SEXES = ["M", "F"];
const GRADES = ["Maiden", "Tier 3", "Grade 5", "Grade 4", "Grade 3", "Grade 2", "Grade 1", "Mixed 4/5", "Free For All"];
const RACE_DISTANCES = [400, 450, 500, 515, 520, 525, 600];

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateDogName(): string {
  return `${randomChoice(NAME_PREFIXES)} ${randomChoice(NAME_SUFFIXES)}`;
}

function whelp(minYear: number, span: number): Date {
  return new Date(minYear + Math.floor(Math.random() * span), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1);
}

async function main() {
  console.log("🌱 Seeding GreyhoundIQ database (batched)...\n");

  // Clear existing data (child -> parent to respect FKs)
  await prisma.messageMedia.deleteMany();
  await prisma.listingMedia.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.post.deleteMany();
  await prisma.thread.deleteMany();
  await prisma.forumCategory.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.mediaAsset.deleteMany();
  await prisma.dogOwnership.deleteMany();
  await prisma.memoryEntry.deleteMany();
  await prisma.conversationContext.deleteMany();
  await prisma.agentRun.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.report.deleteMany();
  await prisma.profile.deleteMany();
  await prisma.user.deleteMany();
  await prisma.result.deleteMany();
  await prisma.formEntry.deleteMany();
  await prisma.runner.deleteMany();
  await prisma.race.deleteMany();
  await prisma.meeting.deleteMany();
  await prisma.dog.deleteMany();
  await prisma.trainer.deleteMany();
  await prisma.track.deleteMany();

  // 1. Tracks
  const trackRows = TRACKS.map((t) => ({ id: id(), ...t }));
  await prisma.track.createMany({ data: trackRows });
  const trackIds: Record<string, string> = Object.fromEntries(trackRows.map((t) => [t.name, t.id]));
  console.log(`  ✓ ${trackRows.length} tracks`);

  // 2. Trainers
  const trainerRows = TRAINERS.map((name) => ({
    id: id(),
    name,
    state: randomChoice(["NSW", "VIC", "QLD", "SA", "WA", "TAS"]),
    licenseNumber: `AU-${Math.floor(Math.random() * 999999)}`,
  }));
  await prisma.trainer.createMany({ data: trainerRows });
  const trainerIds = trainerRows.map((t) => t.id);
  console.log(`  ✓ ${trainerRows.length} trainers`);

  // 3. Sires
  const sireRows = SIRES.map((name) => ({
    id: id(),
    name,
    sex: "M",
    colour: randomChoice(DOG_COLOURS),
    whelpDate: whelp(2015, 5),
  }));
  await prisma.dog.createMany({ data: sireRows });
  const sireIds: Record<string, string> = Object.fromEntries(sireRows.map((s) => [s.name, s.id]));

  // 4. Brood bitches
  const damRows = Array.from({ length: 30 }, () => ({
    id: id(),
    name: generateDogName(),
    sex: "F",
    colour: randomChoice(DOG_COLOURS),
    whelpDate: whelp(2016, 4),
  }));
  await prisma.dog.createMany({ data: damRows });
  const damIds = damRows.map((d) => d.id);

  // 5. Racing dogs (earBrand made unique via index to avoid collisions)
  const dogRows = Array.from({ length: 400 }, (_, i) => ({
    id: id(),
    name: generateDogName(),
    sex: randomChoice(SEXES),
    colour: randomChoice(DOG_COLOURS),
    whelpDate: whelp(2021, 3),
    sireId: sireIds[randomChoice(SIRES)],
    damId: randomChoice(damIds),
    trainerId: randomChoice(trainerIds),
    earBrand: `AU${(100000 + i).toString()}`,
  }));
  await prisma.dog.createMany({ data: dogRows });
  const dogIds = dogRows.map((d) => d.id);
  console.log(`  ✓ ${sireRows.length} sires, ${damRows.length} dams, ${dogRows.length} racing dogs`);

  // 6. Form history
  const formRows: {
    id: string; dogId: string; trackId: string; date: Date;
    boxNumber: number; finish: number; time: number; distance: number; grade: string; weight: number;
  }[] = [];
  for (const dogId of dogIds) {
    const numStarts = Math.floor(Math.random() * 30) + 3;
    for (let i = 0; i < numStarts; i++) {
      const distance = randomChoice(RACE_DISTANCES);
      const finish = Math.random() < 0.15 ? 1 : Math.floor(Math.random() * 8) + 1;
      formRows.push({
        id: id(),
        dogId,
        trackId: trackIds[randomChoice(TRACKS).name],
        date: new Date(2024, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
        boxNumber: Math.floor(Math.random() * 8) + 1,
        finish,
        time: parseFloat((distance / 10 + Math.random() * 2).toFixed(2)),
        distance,
        grade: randomChoice(GRADES),
        weight: parseFloat((28 + Math.random() * 8).toFixed(1)),
      });
    }
  }
  await createManyChunked((a) => prisma.formEntry.createMany(a), formRows);
  console.log(`  ✓ ${formRows.length} form entries`);

  // Collect meetings/races/runners/results across both days, then batch-insert.
  const meetingRows: { id: string; trackId: string; meetingDate: Date; meetingType: string }[] = [];
  const raceRows: { id: string; meetingId: string; raceNumber: number; raceTime: Date; distance: number; grade: string; prizeMoney: number }[] = [];
  const runnerRows: { id: string; raceId: string; dogId: string; boxNumber: number; weight: number; trainerId: string; startingPrice: number; scratched: boolean }[] = [];
  const resultRows: { id: string; runnerId: string; raceId: string; finishingPosition: number; runningTime: number; margin: number; splitTime: number }[] = [];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  function buildMeeting(trackName: string, date: Date, type: string, numRaces: number, withResults: boolean) {
    const meetingId = id();
    meetingRows.push({ id: meetingId, trackId: trackIds[trackName], meetingDate: date, meetingType: type });
    for (let r = 0; r < numRaces; r++) {
      const raceId = id();
      const raceTime = new Date(date);
      raceTime.setHours(17 + Math.floor(r / 4), (r % 4) * 15, 0, 0);
      const distance = randomChoice(RACE_DISTANCES);
      raceRows.push({
        id: raceId, meetingId, raceNumber: r + 1, raceTime, distance,
        grade: randomChoice(GRADES), prizeMoney: parseFloat((2000 + Math.random() * 8000).toFixed(0)),
      });
      const raceDogs = [...dogIds].sort(() => Math.random() - 0.5).slice(0, 8);
      const finishOrder = [1, 2, 3, 4, 5, 6, 7, 8].sort(() => Math.random() - 0.5);
      for (let box = 0; box < 8; box++) {
        const runnerId = id();
        runnerRows.push({
          id: runnerId, raceId, dogId: raceDogs[box], boxNumber: box + 1,
          weight: parseFloat((28 + Math.random() * 8).toFixed(1)),
          trainerId: randomChoice(trainerIds),
          startingPrice: parseFloat((1.5 + Math.random() * 20).toFixed(2)),
          scratched: !withResults && Math.random() < 0.03,
        });
        if (withResults) {
          resultRows.push({
            id: id(), runnerId, raceId, finishingPosition: finishOrder[box],
            runningTime: parseFloat((distance / 10 + Math.random() * 2).toFixed(2)),
            margin: finishOrder[box] === 1 ? 0 : parseFloat((Math.random() * 5).toFixed(2)),
            splitTime: parseFloat((distance / 10 + Math.random()).toFixed(2)),
          });
        }
      }
    }
  }

  // 7. Today + next 6 days of meetings (upcoming, no results)
  for (let d = 0; d <= 6; d++) {
    const day = new Date(today);
    day.setDate(day.getDate() + d);
    for (const t of [...TRACKS].sort(() => Math.random() - 0.5).slice(0, d === 0 ? 5 : 3)) {
      buildMeeting(t.name, day, randomChoice(["TAB", "Non-TAB", "Twilight"]), Math.floor(Math.random() * 5) + 8, false);
    }
  }
  // 8. Yesterday's meetings (with results)
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  for (const t of [...TRACKS].sort(() => Math.random() - 0.5).slice(0, 4)) {
    buildMeeting(t.name, yesterday, "TAB", Math.floor(Math.random() * 3) + 7, true);
  }
  // 8b. A week of historical results so stats/records have depth
  for (let d = 2; d <= 8; d++) {
    const day = new Date(today);
    day.setDate(day.getDate() - d);
    for (const t of [...TRACKS].sort(() => Math.random() - 0.5).slice(0, 4)) {
      buildMeeting(t.name, day, "TAB", Math.floor(Math.random() * 3) + 7, true);
    }
  }

  await prisma.meeting.createMany({ data: meetingRows });
  await createManyChunked((a) => prisma.race.createMany(a), raceRows);
  await createManyChunked((a) => prisma.runner.createMany(a), runnerRows);
  await createManyChunked((a) => prisma.result.createMany(a), resultRows);
  console.log(`  ✓ ${meetingRows.length} meetings, ${raceRows.length} races, ${runnerRows.length} runners, ${resultRows.length} results`);

  // 9. Users across every tier (matched to WorkOS by email; tier drives ProGate)
  const USERS = [
    { email: "free@greyhoundiq.test", name: "Freddie Free", tier: "free", role: "member", kennel: null },
    { email: "pro@greyhoundiq.test", name: "Patricia Pro", tier: "pro", role: "trainer", kennel: "Riverside Racing" },
    { email: "proplus@greyhoundiq.test", name: "Quentin Quant", tier: "pro_plus", role: "breeder", kennel: "Bale Bloodlines" },
    { email: "admin@greyhoundiq.test", name: "Adele Admin", tier: "pro_plus", role: "admin", kennel: null },
  ];
  const userRows = USERS.map((u) => ({ id: id(), email: u.email, name: u.name, subscriptionTier: u.tier }));
  await prisma.user.createMany({ data: userRows });
  const profileRows = USERS.map((u, i) => ({
    id: id(),
    userId: userRows[i].id,
    displayName: u.name,
    bio: `${u.role[0].toUpperCase()}${u.role.slice(1)} on GreyhoundIQ.`,
    state: randomChoice(["NSW", "VIC", "QLD", "SA", "WA", "TAS"]),
    kennelName: u.kennel ?? undefined,
    kennelPrefix: u.kennel ? u.kennel.split(" ")[0] : undefined,
    role: u.role,
    verified: u.role !== "member",
  }));
  await prisma.profile.createMany({ data: profileRows });
  const profileIds = profileRows.map((p) => p.id);
  console.log(`  ✓ ${userRows.length} users + profiles`);

  // 10. Dog ownership
  const ownershipRows: { id: string; dogId: string; profileId: string; role: string; verified: boolean }[] = [];
  for (const profileId of profileIds) {
    for (const dogId of [...dogIds].sort(() => Math.random() - 0.5).slice(0, 4)) {
      ownershipRows.push({ id: id(), dogId, profileId, role: randomChoice(["owner", "breeder", "trainer", "co-owner"]), verified: Math.random() < 0.6 });
    }
  }
  await prisma.dogOwnership.createMany({ data: ownershipRows });
  console.log(`  ✓ ${ownershipRows.length} ownership links`);

  // 11. Forum
  const CATEGORIES = [
    { name: "General Discussion", slug: "general", description: "Talk all things greyhound racing." },
    { name: "Form & Tips", slug: "form-tips", description: "Share your reads and get feedback." },
    { name: "Breeding", slug: "breeding", description: "Bloodlines, matings, and litters." },
    { name: "Buy, Sell & Stud", slug: "marketplace", description: "Marketplace chatter." },
  ];
  const THREAD_TITLES = [
    "Box 1 bias at Wentworth Park — real or myth?",
    "Best value sire for staying types?",
    "Sandown 515 sectionals — who's flying?",
    "First-time owner — what should I look for?",
    "Anyone tracking the new Isolynx timing data?",
  ];
  const POST_BODIES = [
    "Good question — I've seen the same pattern over the last month.",
    "Depends on the distance, but the data backs you up.",
    "Disagree, the sample size is too small to call it.",
    "Anyone got the split times for that one?",
    "Welcome aboard! Start with the form guide and box stats.",
  ];
  const categoryRows = CATEGORIES.map((c, i) => ({ id: id(), name: c.name, slug: c.slug, description: c.description, sortOrder: i }));
  await prisma.forumCategory.createMany({ data: categoryRows });
  const threadRows: { id: string; categoryId: string; title: string; authorId: string; pinned: boolean; views: number }[] = [];
  const postRows: { id: string; threadId: string; authorId: string; body: string }[] = [];
  for (const c of categoryRows) {
    const numThreads = Math.floor(Math.random() * 2) + 2;
    for (let t = 0; t < numThreads; t++) {
      const threadId = id();
      threadRows.push({ id: threadId, categoryId: c.id, title: randomChoice(THREAD_TITLES), authorId: randomChoice(profileIds), pinned: t === 0 && Math.random() < 0.4, views: Math.floor(Math.random() * 800) });
      for (let p = 0; p < Math.floor(Math.random() * 4) + 1; p++) {
        postRows.push({ id: id(), threadId, authorId: randomChoice(profileIds), body: randomChoice(POST_BODIES) });
      }
    }
  }
  await prisma.thread.createMany({ data: threadRows });
  await prisma.post.createMany({ data: postRows });
  console.log(`  ✓ ${categoryRows.length} categories, ${threadRows.length} threads, ${postRows.length} posts`);

  // 12. Marketplace listings
  const LISTING_TYPES = ["pup_for_sale", "dog_for_sale", "stud_service", "wanted", "share"];
  const listingRows = Array.from({ length: 12 }, () => {
    const type = randomChoice(LISTING_TYPES);
    const status = randomChoice(["active", "active", "active", "sold"]);
    return {
      id: id(),
      profileId: randomChoice(profileIds),
      type,
      title: type === "stud_service" ? `Stud service — ${randomChoice(SIRES)}` : `${generateDogName()} — ${type.replace(/_/g, " ")}`,
      description: "Well-bred, sound, ready to go. Genuine enquiries only.",
      price: type === "wanted" ? null : parseFloat((1000 + Math.random() * 9000).toFixed(0)),
      currency: "AUD",
      state: randomChoice(["NSW", "VIC", "QLD", "SA", "WA", "TAS"]),
      dogId: Math.random() < 0.5 ? randomChoice(dogIds) : undefined,
      status,
      expiresAt: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 90),
      soldAt:
        status === "sold"
          ? new Date(today.getFullYear(), today.getMonth(), today.getDate() - 3)
          : undefined,
    };
  });
  await prisma.listing.createMany({ data: listingRows });
  console.log(`  ✓ ${listingRows.length} listings`);

  // 13. Direct messages
  const MSG_BODIES = ["Hi — is the listing still available?", "Great race today, congrats!", "Can you send the pedigree?", "What's your best price?"];
  const messageRows = Array.from({ length: 10 }, () => {
    const sender = randomChoice(profileIds);
    let recipient = randomChoice(profileIds);
    while (recipient === sender) recipient = randomChoice(profileIds);
    return { id: id(), senderId: sender, recipientId: recipient, body: randomChoice(MSG_BODIES), read: Math.random() < 0.5 };
  });
  await prisma.message.createMany({ data: messageRows });
  console.log(`  ✓ ${messageRows.length} messages`);

  // 14. Agent runs (AI feature history)
  const AGENT_TYPES = ["race_analyst", "breeding_advisor", "form_reader", "moderator"];
  const agentRows = Array.from({ length: 15 }, () => {
    const agentType = randomChoice(AGENT_TYPES);
    const done = Math.random() < 0.85;
    return {
      id: id(),
      agentType,
      inputJson: JSON.stringify({ sample: true, agentType }),
      outputJson: done ? JSON.stringify({ summary: "Sample structured output", confidence: parseFloat(Math.random().toFixed(2)) }) : null,
      status: done ? "completed" : randomChoice(["pending", "running", "failed"]),
      promptTokens: done ? Math.floor(Math.random() * 2000) + 200 : null,
      completionTokens: done ? Math.floor(Math.random() * 1500) + 100 : null,
      durationMs: done ? Math.floor(Math.random() * 8000) + 500 : null,
      completedAt: done ? new Date() : null,
    };
  });
  await prisma.agentRun.createMany({ data: agentRows });
  console.log(`  ✓ ${agentRows.length} agent runs`);

  console.log("\n✅ Seed complete!");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
