/* Cloudflare Pages Function — proxy seguro hacia la API de Gemini.
   Ruta: POST /api/chat
   La clave de Gemini vive como variable secreta en Cloudflare (GEMINI_API_KEY),
   NUNCA en el código del navegador. El front manda el historial de chat y acá
   se reenvía a Gemini con el "system prompt" (cerebro) de genética de Drosophila. */

// Modelo de Gemini (capa gratis). Si en la prueba diera "model not found",
// se cambia solo esta línea (p. ej. gemini-2.0-flash o gemini-3-flash).
const MODEL = 'gemini-2.5-flash';

const SYSTEM_PROMPT = `Sos un asistente experto en genética de Drosophila melanogaster, integrado en "DrosoTracker", una app que sigue el ciclo de vida de moscas en un laboratorio. Tu trabajo es ayudar a diseñar esquemas de cruzas para cumplir un objetivo experimental.

Contexto de la app: cada cruza tiene un genotipo, una temperatura de incubación (afecta los tiempos de desarrollo) y un objetivo, que puede ser: cruza genética, amplificación de línea, mantenimiento de stock, cohorte de envejecimiento o disección larval (L1/L2/L3).

Cómo respondés:
- En español, claro y conciso, con tono de colega de laboratorio. La persona es bióloga y entiende términos técnicos, así que podés usarlos directamente.
- Conocés el sistema binario GAL4/UAS, cromosomas (X, 2, 3, 4), balanceadores (CyO, TM3, TM6B, FM7, etc.), marcadores dominantes, recombinación, recolección de vírgenes y los tiempos de desarrollo según temperatura.
- Cuando te piden un esquema de cruza, proponé los pasos concretos (qué cruzar con qué, qué genotipo esperar en cada generación, qué seleccionar) de forma ordenada.
- Si te falta información clave (qué stocks/genotipos tiene disponibles, en qué cromosoma está el transgén, si hay balanceadores), preguntá antes de asumir.
- Sé honesto sobre la incertidumbre: si no estás seguro de en qué cromosoma está un elemento o de un detalle de un stock, decilo y pedí que lo verifique. NO inventes números de stock (Bloomington/VDRC) ni datos específicos que no te hayan dado.
- Recordá que sos un asistente: la persona experta valida el diseño final.
- Mantené las respuestas enfocadas y prácticas; evitá relleno.`;

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export async function onRequestPost({ request, env }) {
  const key = (env.GEMINI_API_KEY || '').trim();  // .trim() por si la clave trae espacios/saltos al copiar
  if (!key) {
    return json({ error: 'Falta configurar la clave GEMINI_API_KEY en Cloudflare (Settings → Variables and Secrets).' });
  }

  let body;
  try { body = await request.json(); } catch { return json({ error: 'Pedido inválido.' }); }

  const messages = Array.isArray(body.messages) ? body.messages : [];
  // Convertir el historial del chat al formato de Gemini.
  const contents = messages
    .filter(m => m && m.text)
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: String(m.text).slice(0, 8000) }],
    }));

  if (!contents.length) return json({ error: 'No hay mensaje para responder.' });

  const payload = {
    system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents,
    generationConfig: { temperature: 0.4, maxOutputTokens: 1400 },
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

  let r, data;
  try {
    r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(payload),
    });
    data = await r.json();
  } catch (e) {
    return json({ error: 'No se pudo contactar a Gemini. Reintentá en un momento.' });
  }

  if (!r.ok) {
    const msg = (data && data.error && data.error.message) || `Error ${r.status} de Gemini.`;
    return json({ error: msg });
  }

  // Bloqueo por seguridad/contenido o respuesta vacía
  const cand = data.candidates && data.candidates[0];
  const text = cand && cand.content && cand.content.parts
    ? cand.content.parts.map(p => p.text || '').join('').trim()
    : '';

  if (!text) {
    return json({ error: 'Gemini no devolvió respuesta (puede ser un límite de uso o un bloqueo de contenido). Reintentá.' });
  }

  return json({ text });
}
