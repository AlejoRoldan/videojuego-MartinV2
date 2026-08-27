import { z } from "zod";
import { LIVE_ROOM_CODE_ALPHABET, LIVE_ROOM_CODE_LENGTH } from "../../shared/liveRoomContract";

const allowedNickname = /^[A-Za-zÀ-ÖØ-öø-ÿ0-9 _-]+$/;
const codePattern = new RegExp(`^[${LIVE_ROOM_CODE_ALPHABET}]{${LIVE_ROOM_CODE_LENGTH}}$`);

export const nicknameSchema = z
  .string()
  .trim()
  .min(1)
  .max(14)
  .regex(allowedNickname)
  .transform((value) => value.normalize("NFKC").replace(/\s+/g, " "));

export const trackSchema = z.enum(["tables-2-5", "tables-6-9"]);
export const roomCodeSchema = z.string().trim().toUpperCase().regex(codePattern);

export const createRoomSchema = z
  .object({
    nickname: nicknameSchema,
    track: trackSchema,
  })
  .strict();

export const joinRoomSchema = z
  .object({
    action: z.literal("join"),
    nickname: nicknameSchema,
  })
  .strict();

export const startRoomSchema = z
  .object({
    action: z.literal("start"),
  })
  .strict();

export const shotSchema = z
  .object({
    action: z.literal("shot"),
    roundIndex: z.number().int().min(0).max(2),
    scored: z.boolean(),
    firstTry: z.boolean(),
    responseTimeMs: z.number().finite().min(0).max(120_000).transform((value) => Math.trunc(value)),
  })
  .strict();

export const roomActionSchema = z.discriminatedUnion("action", [joinRoomSchema, startRoomSchema, shotSchema]);
