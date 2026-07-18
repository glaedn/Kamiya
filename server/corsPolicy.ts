export const LOCAL_DEVELOPMENT_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:3000"
] as const;

export function parseAllowedOrigins(configuredOrigins = process.env.KAMIYA_ALLOWED_ORIGIN): string[] {
  const source = configuredOrigins?.trim() || LOCAL_DEVELOPMENT_ORIGINS.join(",");

  return [...new Set(source.split(",").map((value) => value.trim()).filter(Boolean))];
}

export function isAllowedOrigin(origin: string | undefined, allowedOrigins: readonly string[]): boolean {
  return !origin || allowedOrigins.includes(origin);
}
