/**
 * Seed script — populates the database with realistic sample data
 * for Australian greyhound racing so the site works on first load.
 *
 * Run with: npm run seed
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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

// Realistic trainer names
const TRAINERS = [
  "Jason Thompson", "David Greene", "Mark Riley", "Lisa Delaney",
  "Paul Stuart", "Donna Knight", "Graeme Bate", "James Langton",
  "Anthony Azzopardi", "Lorraine Atchison", "Keith Lester",
  "Robert Britton", "Jeffrey Britton", "Kel Greenough",
  "Peter Rocket", "Steve White", "Wayne Vassallo", "Corey Pell",
];

// Realistic sire names (well-known Australian sires)
const SIRES = [
  "Barcia Bale", "Fernando Bale", "Kinloch Brae", "Premier Fantasy",
  "Spiral Nikita", "Superior Panama", "Surf Lorian", "Turrito Bale",
  "Awesome Assasin", "Magic Sprite", "Outa Credit", "Bogie LeBron",
];

// Name generator components
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
  "Ripple", "Rocket", "Rogue", "Royale", "Runner", "Rush", "Rhythm",
  "Sabre", "Sensation", "Shadow", "Shark", "Shield", "Shock", "Sky",
  "Slammer", "Sniper", "Solitaire", "Sonic", "Spark", "Spirit", "Spirit",
  "Star", "Starr", "Sterling", "Storm", "Strike", "Sundance", "Sunset",
  "Superstar", "Surprise", "Survivor", "Sword", "Tactic", "Talent",
  "Tango", "Tempest", "Thunder", "Tiger", "Titan", "Tornado", "Treasure",
  "Trick", "Triumph", "Trooper", "Turbo", "Tycoon", "Typhoon", "Universe",
  "Viper", "Vortex", "Voyage", "Warrior", "Whisper", "Wild", "Wing",
  "Winner", "Wizard", "Wonder", "Xtreme", "Yield", "Zenith", "Zone",
  "Action", "Affair", "Arrow", "Avenue", "Baby", "Bandit", "Banjo",
  "Beauty", "Bliss", "Bolt", "Bonus", "Boy", "Breaker", "Brother",
  "Buck", "Caper", "Cash", "Catcher", "Champ", "Chance", "Charge",
  "Cheetah", "Cobber", "Cuddle", "Cup", "Dasher", "Dawn", "Deal",
  "Digger", "Diva", "Drift", "Duke", "Dutchess", "Eddy", "Edition",
  "Energy", "Epilogue", "Era", "Event", "Express", "Eyes", "Factor",
  "Fella", "Fever", "Fidget", "Figure", "Film", "Finisher", "Flick",
  "Flirt", "Flo", "Flower", "Flyer", "Font", "Fountain", "Free",
  "Frenzy", "Friend", "Frost", "Gal", "Game", "Gate", "Gear",
  "Gem", "Giant", "Glider", "Goblet", "Grace", "Grain", "Grand",
  "Gunner", "Hammer", "Hand", "Havoc", "Heart", "Heist", "Hint",
  "Holiday", "Honey", "Hook", "Hope", "Hopper", "Horn", "Hub",
  "Hype", "Ice", "Idol", "Image", "Ink", "Instance", "Intent",
  "Irl", "Isle", "Jive", "Joust", "Junction", "Junket", "Kapa",
  "Keeper", "Kelp", "Khana", "Kicker", "Kiss", "Knot", "Label",
  "Lake", "Lambo", "Lark", "Lasso", "Legend", "Lie", "Lingo",
  "Loft", "Logic", "Look", "Loop", "Lotto", "Lucky", "Lunar",
];

const DOG_COLOURS = ["Black", "Brindle", "Fawn", "Blue", "White", "Black & White"];
const SEXES = ["M", "F"];
const GRADES = ["Maiden", "Tier 3", "Grade 5", "Grade 4", "Grade 3", "Grade 2", "Grade 1", "Mixed 4/5", "Free For All"];

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateDogName(): string {
  return `${randomChoice(NAME_PREFIXES)} ${randomChoice(NAME_SUFFIXES)}`;
}

async function main() {
  console.log("🌱 Seeding GreyhoundIQ database...\n");

  // Clear existing data
  await prisma.result.deleteMany();
  await prisma.formEntry.deleteMany();
  await prisma.runner.deleteMany();
  await prisma.race.deleteMany();
  await prisma.meeting.deleteMany();
  await prisma.dog.deleteMany();
  await prisma.trainer.deleteMany();
  await prisma.track.deleteMany();

  // 1. Create tracks
  console.log("Creating tracks...");
  const trackIds: Record<string, string> = {};
  for (const t of TRACKS) {
    const track = await prisma.track.create({ data: t });
    trackIds[t.name] = track.id;
  }
  console.log(`  ✓ ${TRACKS.length} tracks`);

  // 2. Create trainers
  console.log("Creating trainers...");
  const trainerIds: string[] = [];
  for (const name of TRAINERS) {
    const state = randomChoice(["NSW", "VIC", "QLD", "SA", "WA", "TAS"]);
    const trainer = await prisma.trainer.create({
      data: { name, state, licenseNumber: `AU-${Math.floor(Math.random() * 999999)}` },
    });
    trainerIds.push(trainer.id);
  }
  console.log(`  ✓ ${TRAINERS.length} trainers`);

  // 3. Create sires (as dogs first — they need to exist for relations)
  console.log("Creating sire dogs...");
  const sireIds: Record<string, string> = {};
  for (const sireName of SIRES) {
    const sire = await prisma.dog.create({
      data: {
        name: sireName,
        sex: "M",
        colour: randomChoice(DOG_COLOURS),
        whelpDate: new Date(2015 + Math.floor(Math.random() * 5), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
      },
    });
    sireIds[sireName] = sire.id;
  }

  // 4. Create brood bitches
  console.log("Creating brood bitches...");
  const damIds: string[] = [];
  for (let i = 0; i < 30; i++) {
    const dam = await prisma.dog.create({
      data: {
        name: generateDogName(),
        sex: "F",
        colour: randomChoice(DOG_COLOURS),
        whelpDate: new Date(2016 + Math.floor(Math.random() * 4), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
      },
    });
    damIds.push(dam.id);
  }

  // 5. Create racing dogs (400 of them)
  console.log("Creating racing dogs...");
  const dogIds: string[] = [];
  for (let i = 0; i < 400; i++) {
    const sireName = randomChoice(SIRES);
    const dog = await prisma.dog.create({
      data: {
        name: generateDogName(),
        sex: randomChoice(SEXES),
        colour: randomChoice(DOG_COLOURS),
        whelpDate: new Date(2021 + Math.floor(Math.random() * 3), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
        sireId: sireIds[sireName],
        damId: randomChoice(damIds),
        trainerId: randomChoice(trainerIds),
        earBrand: `AU${Math.floor(Math.random() * 999999).toString().padStart(6, "0")}`,
      },
    });
    dogIds.push(dog.id);
  }
  console.log(`  ✓ 400 racing dogs`);

  // 6. Create form history for each dog (past races)
  console.log("Creating form history...");
  let formCount = 0;
  for (const dogId of dogIds) {
    const numStarts = Math.floor(Math.random() * 30) + 3;
    for (let i = 0; i < numStarts; i++) {
      const trackName = randomChoice(TRACKS).name;
      const distance = randomChoice([400, 450, 500, 515, 520, 525, 600]);
      const finish = Math.random() < 0.15 ? 1 : Math.floor(Math.random() * 8) + 1;
      const time = distance / 10 + Math.random() * 2;

      await prisma.formEntry.create({
        data: {
          dogId,
          trackId: trackIds[trackName],
          date: new Date(2024, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
          boxNumber: Math.floor(Math.random() * 8) + 1,
          finish,
          time: parseFloat(time.toFixed(2)),
          distance,
          grade: randomChoice(GRADES),
          weight: parseFloat((28 + Math.random() * 8).toFixed(1)),
        },
      });
      formCount++;
    }
  }
  console.log(`  ✓ ${formCount} form entries`);

  // 7. Create today's meetings and races
  console.log("Creating today's meetings...");
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todaysTracks = [...TRACKS].sort(() => Math.random() - 0.5).slice(0, 5);
  let raceCount = 0;
  let runnerCount = 0;

  for (const t of todaysTracks) {
    const meeting = await prisma.meeting.create({
      data: {
        trackId: trackIds[t.name],
        meetingDate: today,
        meetingType: randomChoice(["TAB", "Non-TAB", "Twilight"]),
      },
    });

    const numRaces = Math.floor(Math.random() * 5) + 8; // 8-12 races
    for (let r = 0; r < numRaces; r++) {
      const raceTime = new Date(today);
      raceTime.setHours(17 + Math.floor(r / 4), (r % 4) * 15, 0, 0);

      const distance = randomChoice([400, 450, 500, 515, 520, 525, 600]);
      const race = await prisma.race.create({
        data: {
          meetingId: meeting.id,
          raceNumber: r + 1,
          raceTime,
          distance,
          grade: randomChoice(GRADES),
          prizeMoney: parseFloat((2000 + Math.random() * 8000).toFixed(0)),
        },
      });
      raceCount++;

      // Add 8 runners per race
      const raceDogs = [...dogIds].sort(() => Math.random() - 0.5).slice(0, 8);
      for (let box = 0; box < 8; box++) {
        const runner = await prisma.runner.create({
          data: {
            raceId: race.id,
            dogId: raceDogs[box],
            boxNumber: box + 1,
            weight: parseFloat((28 + Math.random() * 8).toFixed(1)),
            trainerId: randomChoice(trainerIds),
            scratched: Math.random() < 0.03,
          },
        });
        runnerCount++;
      }
    }
  }
  console.log(`  ✓ ${todaysTracks.length} meetings, ${raceCount} races, ${runnerCount} runners`);

  // 8. Create yesterday's meeting with results
  console.log("Creating yesterday's results...");
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const yesterTracks = [...TRACKS].sort(() => Math.random() - 0.5).slice(0, 4);
  let resultsCount = 0;

  for (const t of yesterTracks) {
    const meeting = await prisma.meeting.create({
      data: {
        trackId: trackIds[t.name],
        meetingDate: yesterday,
        meetingType: "TAB",
      },
    });

    const numRaces = Math.floor(Math.random() * 3) + 7;
    for (let r = 0; r < numRaces; r++) {
      const raceTime = new Date(yesterday);
      raceTime.setHours(17 + Math.floor(r / 4), (r % 4) * 15, 0, 0);

      const distance = randomChoice([400, 450, 500, 515, 520, 525, 600]);
      const race = await prisma.race.create({
        data: {
          meetingId: meeting.id,
          raceNumber: r + 1,
          raceTime,
          distance,
          grade: randomChoice(GRADES),
          prizeMoney: parseFloat((2000 + Math.random() * 8000).toFixed(0)),
        },
      });

      const raceDogs = [...dogIds].sort(() => Math.random() - 0.5).slice(0, 8);
      // Random finishing order
      const finishOrder = [1, 2, 3, 4, 5, 6, 7, 8].sort(() => Math.random() - 0.5);

      for (let box = 0; box < 8; box++) {
        const runner = await prisma.runner.create({
          data: {
            raceId: race.id,
            dogId: raceDogs[box],
            boxNumber: box + 1,
            weight: parseFloat((28 + Math.random() * 8).toFixed(1)),
            trainerId: randomChoice(trainerIds),
          },
        });

        const time = distance / 10 + Math.random() * 2;
        await prisma.result.create({
          data: {
            runnerId: runner.id,
            raceId: race.id,
            finishingPosition: finishOrder[box],
            runningTime: parseFloat(time.toFixed(2)),
            margin: finishOrder[box] === 1 ? 0 : parseFloat((Math.random() * 5).toFixed(2)),
            splitTime: parseFloat((distance / 10 + Math.random()).toFixed(2)),
          },
        });
        resultsCount++;
      }
    }
  }
  console.log(`  ✓ ${resultsCount} results`);

  console.log("\n✅ Seed complete!\n");
  console.log("Summary:");
  console.log(`  Tracks: ${TRACKS.length}`);
  console.log(`  Trainers: ${TRAINERS.length}`);
  console.log(`  Sires: ${SIRES.length}`);
  console.log(`  Racing dogs: 400`);
  console.log(`  Form entries: ${formCount}`);
  console.log(`  Today's races: ${raceCount}`);
  console.log(`  Yesterday's results: ${resultsCount}`);
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
