export type EnvReader = { get(name: string): string | undefined };

/** Public connection settings are shared; private keys never get VITE_ aliases. */
export function serverEnvironment(source: EnvReader): EnvReader {
  return {
    get(name) {
      if (name === "SUPABASE_SERVICE_ROLE_KEY")
        return (
          source.get("SUPABASE_SECRET_KEY")?.trim() ||
          source.get(name)?.trim() ||
          undefined
        );
      const value = source.get(name)?.trim();
      if (value) return value;
      if (name === "SUPABASE_URL")
        return source.get("VITE_SUPABASE_URL")?.trim();
      if (name === "SUPABASE_ANON_KEY")
        return (
          source.get("VITE_SUPABASE_PUBLISHABLE_KEY")?.trim() ||
          source.get("VITE_SUPABASE_ANON_KEY")?.trim()
        );
      return undefined;
    },
  };
}

export function missingServerSettings(env: EnvReader) {
  return [
    ["SUPABASE_URL", "VITE_SUPABASE_URL"],
    ["SUPABASE_ANON_KEY", "VITE_SUPABASE_PUBLISHABLE_KEY"],
    ["SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY"],
  ]
    .filter(([lookup]) => !env.get(lookup))
    .map(([, setting]) => setting);
}
