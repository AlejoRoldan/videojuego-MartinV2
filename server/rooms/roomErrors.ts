import type { LiveRoomErrorCode } from "../../shared/liveRoomContract";

const DEFAULT_MESSAGES: Record<LiveRoomErrorCode, string> = {
  invalid_payload: "Revisa el nombre o los datos enviados.",
  session_invalid: "Tu acceso a la sala ya no es válido.",
  host_only: "Solo el anfitrión puede iniciar.",
  room_not_found: "La sala no existe o ya venció.",
  room_full: "La sala ya tiene cuatro jugadores.",
  room_already_started: "El partido ya comenzó.",
  not_enough_players: "Se necesitan al menos dos jugadores.",
  round_out_of_order: "Ese remate todavía no corresponde.",
  round_conflict: "Ese remate ya fue guardado con otro resultado.",
  room_completed: "La sala ya terminó.",
  rate_limited: "Espera unos segundos e inténtalo de nuevo.",
  internal_error: "No pudimos actualizar la sala.",
};

const STATUS_BY_CODE: Record<LiveRoomErrorCode, number> = {
  invalid_payload: 400,
  session_invalid: 401,
  host_only: 403,
  room_not_found: 404,
  room_full: 409,
  room_already_started: 409,
  not_enough_players: 409,
  round_out_of_order: 409,
  round_conflict: 409,
  room_completed: 410,
  rate_limited: 429,
  internal_error: 500,
};

export class RoomError extends Error {
  readonly status: number;

  constructor(readonly code: LiveRoomErrorCode, message = DEFAULT_MESSAGES[code]) {
    super(message);
    this.name = "RoomError";
    this.status = STATUS_BY_CODE[code];
  }
}

export function asRoomError(error: unknown): RoomError {
  return error instanceof RoomError ? error : new RoomError("internal_error");
}
