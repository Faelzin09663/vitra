import { it, expect, vi } from "vitest";
import { navyBodyFat, measurementTrend } from "../src/lib/measurements";
import { photoPath, prepareProgressImage } from "../src/lib/progressImage";
import {
  createBodyHandler,
  type BodyDeps,
} from "../supabase/functions/_shared/body-analysis-handler";
import {
  parseBodyAnalysis,
  supportiveBodyResponse,
} from "../supabase/functions/_shared/body-schema";
import { AIProviderError } from "../supabase/functions/_shared/ai-provider";
import { adultConsent } from "../supabase/functions/_shared/ai-consent";
const id = "00000000-0000-4000-8000-000000000001";
it("o guard real verifica idade adulta e consentimentos independentes", () => {
  const consent = { version: 1, grantedAt: "2026-10-04T12:00:00Z" };
  for (const age of [null, 17, 18.5, 101, "30"])
    expect(
      adultConsent(
        { profile: { age }, preferences: { body_consent: consent } },
        "body_consent",
      ),
    ).toBe(false);
  expect(
    adultConsent(
      {
        profile: { age: 30 },
        preferences: { ai_consent: { ...consent, version: 2 } },
      },
      "body_consent",
    ),
  ).toBe(false);
  expect(
    adultConsent(
      { profile: { age: 30 }, preferences: { body_consent: consent } },
      "body_consent",
    ),
  ).toBe(true);
});
const request = (body: object, auth = true) =>
  new Request("https://local.test", {
    method: "POST",
    headers: auth ? { Authorization: "Bearer token" } : {},
    body: JSON.stringify(body),
  });
function deps(patch: Partial<BodyDeps> = {}): BodyDeps {
  return {
    authenticate: vi.fn(async () => id),
    hasConsent: vi.fn(async () => true),
    allowRequest: vi.fn(async () => true),
    loadPhotos: vi.fn(async () => ({
      photos: [
        {
          id,
          angle: "frente",
          note: "",
          mimeType: "image/jpeg",
          base64: "AAAA",
        },
      ],
    })),
    provider: {
      model: "mock",
      generateStructured: vi.fn(async () =>
        JSON.stringify({
          ...supportiveBodyResponse(),
          status: "analyzed",
          reason: "Boa consistência.",
        }),
      ),
    },
    ...patch,
  };
}
it("fórmulas só com medidas válidas e séries completas", () => {
  expect(navyBodyFat("male", 180, 40, 90)).toBe(18.4);
  expect(navyBodyFat("female", 165, 34, 75, 100)).toBeGreaterThan(15);
  expect(navyBodyFat("female", 165, 34, 75)).toBeNull();
  expect(navyBodyFat("male", 180, 50, 40)).toBeNull();
  const t = measurementTrend(
    [
      { user_id: id, date: "2026-10-01", waist: 90, note: "" },
      { user_id: id, date: "2026-10-04", waist: 88, note: "" },
    ],
    "waist",
  );
  expect(t.firstDelta).toBe(-2);
});
it("caminhos ficam no titular e imagens exportam apenas pixels", async () => {
  expect(photoPath(id, id)).toBe(`${id}/${id}.jpg`);
  expect(() => photoPath("../other", id)).toThrow();
  const draw = vi.fn(),
    toBlob = vi.fn((cb: (b: Blob) => void) =>
      cb(new Blob(["pixels"], { type: "image/jpeg" })),
    );
  vi.stubGlobal(
    "Image",
    class {
      src = "";
      width = 3200;
      height = 2400;
      decode = async () => {};
    },
  );
  vi.stubGlobal("URL", {
    createObjectURL: vi.fn(() => "blob:local"),
    revokeObjectURL: vi.fn(),
  });
  const spy = vi.spyOn(document, "createElement").mockReturnValue({
    width: 0,
    height: 0,
    getContext: () => ({ drawImage: draw }),
    toBlob,
  } as unknown as HTMLCanvasElement);
  try {
    const b = await prepareProgressImage(
      new File(["EXIF GPS"], "foto.jpg", { type: "image/jpeg" }),
    );
    expect(await b.text()).toBe("pixels");
    expect(draw.mock.calls[0].slice(3)).toEqual([1600, 1200]);
    expect(toBlob).toHaveBeenCalledWith(
      expect.any(Function),
      "image/jpeg",
      0.8,
    );
  } finally {
    spy.mockRestore();
    vi.unstubAllGlobals();
  }
});
it("JWT, consentimento/adulto e quota obrigatórios", async () => {
  expect(
    (await createBodyHandler(deps())(request({ photoIds: [id] }, false)))
      .status,
  ).toBe(401);
  expect(
    (
      await createBodyHandler(deps({ hasConsent: async () => false }))(
        request({ photoIds: [id] }),
      )
    ).status,
  ).toBe(403);
  expect(
    (
      await createBodyHandler(deps({ allowRequest: async () => false }))(
        request({ photoIds: [id] }),
      )
    ).status,
  ).toBe(429);
});
it("rejeita URLs, IDs de outro usuário e ângulos diferentes", async () => {
  expect(
    (
      await createBodyHandler(deps())(
        request({ photoIds: [id], url: "https://attacker" }),
      )
    ).status,
  ).toBe(400);
  expect(
    (
      await createBodyHandler(
        deps({ loadPhotos: async () => ({ photos: [] }) }),
      )(request({ photoIds: [id] }))
    ).status,
  ).toBe(404);
});
it("recusa imagem inadequada estruturadamente e rejeita termos proibidos", async () => {
  const refused = {
    ...supportiveBodyResponse(),
    status: "refused",
    reason: "Imagem não adequada para esta análise.",
  };
  expect(parseBodyAnalysis(JSON.stringify(refused)).status).toBe("refused");
  expect(() =>
    parseBodyAnalysis(
      JSON.stringify({ ...refused, reason: "Gordura corporal 20%" }),
    ),
  ).toThrow();
  expect(() =>
    parseBodyAnalysis(
      JSON.stringify({ ...refused, changes: ["Outra pessoa"] }),
    ),
  ).toThrow();
  expect(
    (
      await createBodyHandler(
        deps({
          provider: {
            model: "mock",
            generateStructured: async () => JSON.stringify(refused),
          },
        }),
      )(request({ photoIds: [id] }))
    ).status,
  ).toBe(200);
});
it("sofrimento evita envio ao provedor; bloqueios não vazam detalhes", async () => {
  const d = deps({
    loadPhotos: async () => ({
      photos: [
        {
          id,
          angle: "frente",
          note: "odeio meu corpo",
          mimeType: "image/jpeg",
          base64: "AAAA",
        },
      ],
    }),
  });
  const response = await createBodyHandler(d)(request({ photoIds: [id] }));
  expect((await response.json()).analysis.status).toBe("support");
  expect(d.provider.generateStructured).not.toHaveBeenCalled();
  expect(
    (
      await createBodyHandler(
        deps({
          provider: {
            model: "mock",
            generateStructured: async () => {
              throw new AIProviderError("blocked");
            },
          },
        }),
      )(request({ photoIds: [id] }))
    ).status,
  ).toBe(422);
});

it("rejects comparisons across angles and preserves chronological image context", async () => {
  const second = "00000000-0000-4000-8000-000000000002";
  const rows = [
    {
      id,
      angle: "frente",
      date: "2026-10-04",
      note: "",
      mimeType: "image/jpeg" as const,
      base64: "AAAA",
    },
    {
      id: second,
      angle: "lado",
      date: "2026-10-01",
      note: "",
      mimeType: "image/jpeg" as const,
      base64: "BBBB",
    },
  ];
  expect(
    (
      await createBodyHandler(
        deps({ loadPhotos: async () => ({ photos: rows }) }),
      )(request({ photoIds: [id, second] }))
    ).status,
  ).toBe(400);
  rows[1].angle = "frente";
  const d = deps({ loadPhotos: async () => ({ photos: rows }) });
  expect(
    (await createBodyHandler(d)(request({ photoIds: [id, second] }))).status,
  ).toBe(200);
  const call = vi.mocked(d.provider.generateStructured).mock.calls[0][0];
  expect(call.parts[1]).toMatchObject({ base64: "BBBB" });
  expect(call.parts[0]).toMatchObject({
    text: expect.stringContaining("2026-10-01"),
  });
});
