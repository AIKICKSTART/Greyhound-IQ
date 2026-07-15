import { z } from "zod";

const WATCHDOG_BASE =
  process.env.WATCHDOG_BASE_URL ?? "https://watchdog.grv.org.au";

const identifierSchema = z.union([
  z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/),
]);
const shortTextSchema = z.string().trim().min(1).max(200);
const optionalShortTextSchema = shortTextSchema.nullish();
const participantNameSchema = z.string().trim().max(200).nullish();
const participantDogIdSchema = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim().length === 0 ? null : value,
  identifierSchema.nullish(),
);
const timestampSchema = z
  .string()
  .trim()
  .min(8)
  .max(64)
  .refine(isValidProviderTimestamp, "invalid timestamp");
const optionalTimestampSchema = timestampSchema.nullish();

const boundedNumber = (minimum: number, maximum: number) =>
  z
    .union([
      z.number(),
      z.string().trim().regex(/^-?\d+(?:\.\d+)?$/).transform(Number),
    ])
    .pipe(z.number().finite().min(minimum).max(maximum));

const optionalNumber = (minimum: number, maximum: number) =>
  boundedNumber(minimum, maximum).nullish();

const watchdogUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(2_048)
  .refine(isAllowedWatchdogUrl, "URL outside the Watchdog provider boundary")
  .transform((value) => new URL(value, WATCHDOG_BASE).toString());

const watchdogMeetingSchema = z
  .object({
    id: identifierSchema,
    trackCode: z.string().trim().min(1).max(32).nullish(),
    trackName: optionalShortTextSchema,
    slot: z.string().trim().min(1).max(32).nullish(),
    statusCode: z
      .string()
      .trim()
      .min(1)
      .max(32)
      .regex(/^[A-Za-z0-9 _-]+$/)
      .nullish(),
    meetingDate: optionalTimestampSchema,
    startTime: optionalTimestampSchema,
    countRaces: optionalNumber(0, 64),
    isInterstate: z.boolean().nullish(),
  })
  .refine(
    (meeting) => Boolean(meeting.meetingDate ?? meeting.startTime),
    "meeting timestamp required",
  );

const watchdogRaceSchema = z
  .object({
    id: identifierSchema,
    number: optionalNumber(1, 64),
    raceNumber: optionalNumber(1, 64),
    meetingId: identifierSchema.nullish(),
    sponsor: optionalShortTextSchema,
    distance: optionalNumber(1, 5_000),
    grade: z.string().trim().min(1).max(80).nullish(),
    gradeCode: z.string().trim().min(1).max(32).nullish(),
    firstPrize: optionalNumber(0, 100_000_000),
    secondPrize: optionalNumber(0, 100_000_000),
    thirdPrize: optionalNumber(0, 100_000_000),
    fourthPrize: optionalNumber(0, 100_000_000),
    fifthPrize: optionalNumber(0, 100_000_000),
    sixthPrize: optionalNumber(0, 100_000_000),
    seventhPrize: optionalNumber(0, 100_000_000),
    eighthPrize: optionalNumber(0, 100_000_000),
    videoId: z
      .string()
      .trim()
      .min(6)
      .max(64)
      .regex(/^[A-Za-z0-9_-]+$/)
      .nullish(),
    photoFinishUrl: watchdogUrlSchema.nullish(),
    declaration: z.string().trim().min(1).max(80).nullish(),
    startTime: optionalTimestampSchema,
    trackCode: z.string().trim().min(1).max(32).nullish(),
  })
  .refine((race) => Boolean(race.number ?? race.raceNumber), "race number required");

const watchdogParticipantSchema = z.object({
  id: identifierSchema.nullish(),
  raceId: identifierSchema,
  rugNumber: optionalNumber(0, 64),
  box: z
    .union([boundedNumber(0, 64), z.string().trim().min(1).max(32)])
    .nullish(),
  isLateScratching: z.boolean().nullish(),
  dogId: participantDogIdSchema,
  dogName: participantNameSchema,
  trainer: optionalShortTextSchema,
  trainerId: identifierSchema.nullish(),
  owner: optionalShortTextSchema,
  last5: z.string().trim().min(1).max(32).nullish(),
  averageFirstSplitSpeed: optionalNumber(0, 200),
  resultPlace: optionalNumber(0, 64),
  resultWeight: optionalNumber(0, 100),
  resultMargin: z
    .union([boundedNumber(-1_000, 1_000), z.string().trim().min(1).max(32)])
    .nullish(),
  resultTime: optionalNumber(0, 1_000),
  resultFirstSplitTime: optionalNumber(0, 1_000),
  comments: z.string().trim().min(1).max(1_000).nullish(),
  sireName: optionalShortTextSchema,
  sireId: identifierSchema.nullish(),
  damName: optionalShortTextSchema,
  damId: identifierSchema.nullish(),
  colour: z.string().trim().min(1).max(40).nullish(),
  whelpedDate: optionalTimestampSchema,
  sex: z.string().trim().min(1).max(16).nullish(),
  careerPrizeMoney: optionalNumber(0, 100_000_000),
  pir: z.string().trim().min(1).max(128).nullish(),
  runLine: z.string().trim().min(1).max(128).nullish(),
  jumpStyle: z.string().trim().min(1).max(128).nullish(),
});

const watchdogPayloadSchema = z
  .object({
    meetings: uniqueRecords(
      watchdogMeetingSchema,
      128,
      (meeting) => String(meeting.id),
    ).optional(),
    races: uniqueRecords(watchdogRaceSchema, 2_048, (race) => String(race.id)).optional(),
    participants: uniqueRecords(
      watchdogParticipantSchema,
      32_768,
      (participant) =>
        participant.id == null
          ? `${participant.raceId}:${participant.dogId}:${participant.box ?? participant.rugNumber ?? ""}`
          : String(participant.id),
      (participant) =>
        participant.dogId != null && Boolean(participant.dogName?.trim()),
    ).optional(),
  })
  .refine(
    (payload) =>
      payload.meetings !== undefined ||
      payload.races !== undefined ||
      payload.participants !== undefined,
    "recognized Watchdog collection required",
  );

export type WatchdogPayload = z.infer<typeof watchdogPayloadSchema>;
export type WatchdogMeeting = NonNullable<WatchdogPayload["meetings"]>[number];
export type WatchdogRace = NonNullable<WatchdogPayload["races"]>[number];
export type WatchdogParticipant = NonNullable<
  WatchdogPayload["participants"]
>[number];

export function parseWatchdogPayload(payload: unknown): WatchdogPayload {
  const parsed = watchdogPayloadSchema.safeParse(payload);
  if (!parsed.success) throw new Error("watchdog.response_invalid");
  return parsed.data;
}

function uniqueRecords<T extends z.ZodTypeAny>(
  schema: T,
  maximum: number,
  keyFor: (value: z.output<T>) => string,
  keep: (value: z.output<T>) => boolean = () => true,
) {
  return z
    .array(schema)
    .max(maximum)
    .transform((records) => records.filter(keep))
    .superRefine((records, context) => {
      const keys = new Set<string>();
      for (const [index, record] of records.entries()) {
        const key = keyFor(record);
        if (keys.has(key)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "duplicate provider record",
            path: [index],
          });
        }
        keys.add(key);
      }
    });
}

function isValidProviderTimestamp(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:$|[Tt ])/.exec(value);
  if (!match || !Number.isFinite(Date.parse(value))) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [
    31,
    leapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth[month - 1];
}

function isAllowedWatchdogUrl(value: string) {
  try {
    const base = new URL(WATCHDOG_BASE);
    const candidate = new URL(value, base);
    const allowedHosts = new Set([
      base.hostname.toLowerCase(),
      "watchdog.grv.org.au",
      "fasttrack.grv.org.au",
      "www.grv.org.au",
    ]);
    if (candidate.username || candidate.password) return false;
    return (
      candidate.origin === base.origin ||
      (candidate.protocol === "https:" &&
        allowedHosts.has(candidate.hostname.toLowerCase()))
    );
  } catch {
    return false;
  }
}
