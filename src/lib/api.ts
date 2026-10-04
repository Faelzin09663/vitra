import { supabase } from "./supabase";
type Responses = {
  "analyze-meal": { analysis: unknown; model: string };
  "analyze-body-photos": { analysis: unknown; model: string };
  coach: {
    response: unknown;
    source: { from: string; to: string; records: number };
  };
  "delete-account": { deleted: boolean };
};
class APIError extends Error {
  constructor(
    message: string,
    readonly context?: Response,
  ) {
    super(message);
  }
}
export function apiURL(name: string) {
  const base = import.meta.env.VITE_API_URL?.trim() || "/api";
  const url = new URL(
    base.replace(/\/$/, "") + "/" + encodeURIComponent(name),
    window.location.origin,
  );
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error("URL do servidor Vitra inválida.");
  return url.href;
}
export async function invokeAPI<N extends keyof Responses>(
  name: N,
  options: { body: unknown },
): Promise<
  { data: Responses[N]; error: null } | { data: null; error: APIError }
> {
  try {
    if (!supabase)
      return {
        data: null,
        error: new APIError("Configure a conexão do Vitra."),
      };
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    if (session.error || !token)
      return {
        data: null,
        error: new APIError("Entre na sua conta novamente."),
      };
    const response = await fetch(apiURL(name), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(options.body),
      signal: AbortSignal.timeout(90000),
      credentials: "omit",
      redirect: "error",
    });
    const data = await response
      .clone()
      .json()
      .catch(() => null);
    if (
      !response.ok ||
      !data ||
      typeof data !== "object" ||
      Array.isArray(data)
    )
      return {
        data: null,
        error: new APIError(
          typeof data?.error === "string"
            ? data.error.slice(0, 500)
            : "Servidor Vitra indisponível. Confira a conexão e o .env do backend.",
          response,
        ),
      };
    return { data: data as Responses[N], error: null };
  } catch {
    return {
      data: null,
      error: new APIError(
        "Não foi possível acessar o servidor Vitra. Confira a conexão e tente novamente.",
      ),
    };
  }
}
