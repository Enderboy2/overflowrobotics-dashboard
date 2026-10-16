/**
 * Neon adds `channel_binding=require` to its connection strings. postgres-js would forward
 * unknown URL params to the server as runtime settings, so drop it (SSL is still required).
 */
export function databaseUrl(raw = process.env.DATABASE_URL ?? "") {
  try {
    const u = new URL(raw);
    u.searchParams.delete("channel_binding");
    if (!u.searchParams.has("sslmode") && !/localhost|127\.0\.0\.1/.test(u.hostname)) u.searchParams.set("sslmode", "require");
    return u.toString();
  } catch {
    return raw;
  }
}
