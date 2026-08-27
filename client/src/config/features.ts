export const features = {
  remoteRooms: import.meta.env.VITE_REMOTE_ROOMS_ENABLED !== "false",
} as const;
