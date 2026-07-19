import { getStore } from "@netlify/blobs";

const STORE_NAME = "rutapet-envios";
const json = (data, status = 200) =>
  Response.json(data, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff"
    }
  });

function normalizeGuide(value) {
  return String(value || "").trim().replace(/\s+/g, "").toUpperCase();
}

function isValidGuide(value) {
  return /^RP[A-Z0-9-]{4,30}$/.test(value);
}

function authorized(request) {
  const configured = process.env.ADMIN_PASSWORD;
  const supplied = request.headers.get("x-admin-key");
  return Boolean(configured && supplied && supplied === configured);
}

export default async (request) => {
  try {
    const store = getStore(STORE_NAME);
    const url = new URL(request.url);
    const method = request.method.toUpperCase();

    if (method === "GET") {
      const guia = normalizeGuide(url.searchParams.get("guia"));
      if (!isValidGuide(guia)) return json({ error: "Número de guía inválido." }, 400);

      const envio = await store.get(guia, { type: "json", consistency: "strong" });
      if (!envio) return json({ error: "Guía no encontrada. Verifica el número." }, 404);

      return json({ envio });
    }

    if (method === "POST") {
      if (!authorized(request)) return json({ error: "Contraseña administrativa incorrecta." }, 401);

      let body;
      try { body = await request.json(); }
      catch { return json({ error: "Los datos enviados no son válidos." }, 400); }

      const guia = normalizeGuide(body.guia);
      if (!isValidGuide(guia)) return json({ error: "Usa una guía como RP000001." }, 400);

      const envio = {
        guia,
        estado: String(body.estado || "Recogida confirmada").slice(0, 80),
        ubicacion: String(body.ubicacion || "").slice(0, 160),
        actualizacion: String(body.actualizacion || new Date().toLocaleDateString("es-DO")).slice(0, 40),
        entrega: String(body.entrega || "").slice(0, 40),
        observaciones: String(body.observaciones || "").slice(0, 500),
        actualizadoEn: new Date().toISOString()
      };

      await store.setJSON(guia, envio);
      return json({ ok: true, envio });
    }

    if (method === "DELETE") {
      if (!authorized(request)) return json({ error: "Contraseña administrativa incorrecta." }, 401);
      const guia = normalizeGuide(url.searchParams.get("guia"));
      if (!isValidGuide(guia)) return json({ error: "Número de guía inválido." }, 400);
      await store.delete(guia);
      return json({ ok: true });
    }

    return json({ error: "Método no permitido." }, 405);
  } catch (error) {
    console.error(error);
    return json({ error: "Error interno del sistema de rastreo." }, 500);
  }
};

export const config = {
  path: "/api/envio"
};