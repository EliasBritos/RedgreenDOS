// Envio server-side a TikTok Events API. Cada evento lleva el mismo event_id que el
// evento del Pixel del navegador, asi TikTok los deduplica.
// Sin TIKTOK_ACCESS_TOKEN no hace nada (el Pixel del navegador sigue funcionando igual).
export const TIKTOK_PIXEL_ID = 'DBCH97BC77UEENV8ACI0';

export function parseCookies(header = '') {
    const out = {};
    header.split(';').forEach((part) => {
        const i = part.indexOf('=');
        if (i > 0) {
            try { out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim()); } catch { /* cookie rota */ }
        }
    });
    return out;
}

export const eidValido = (v) => (/^[a-f0-9]{8,64}$/i.test(v || '') ? v : '');

// eventos: [{ event: 'Contact', event_id: '...' }, ...]
export async function enviarEventosTikTok(req, eventos, { ttclid } = {}) {
    const token = process.env.TIKTOK_ACCESS_TOKEN;
    if (!eventos.length) return;
    if (!token) {
        console.warn('[tiktok] falta TIKTOK_ACCESS_TOKEN en Vercel: no se envian eventos server-side');
        return;
    }

    const cookies = parseCookies(req.headers.cookie);
    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    const ahora = Math.floor(Date.now() / 1000);
    const user = {
        ttclid: ttclid || undefined,
        ttp: cookies._ttp || undefined,
        ip: ip || undefined,
        user_agent: req.headers['user-agent'] || undefined
    };
    const page = { url: req.headers.referer || `https://${req.headers.host}/` };

    const payload = {
        event_source: 'web',
        event_source_id: TIKTOK_PIXEL_ID,
        data: eventos.map((e) => ({
            event: e.event,
            event_time: ahora,
            event_id: e.event_id,
            user,
            page,
            properties: { content_name: e.content_name || 'Landing Red Green' }
        }))
    };
    if (process.env.TIKTOK_TEST_EVENT_CODE) payload.test_event_code = process.env.TIKTOK_TEST_EVENT_CODE;

    try {
        const res = await fetch('https://business-api.tiktok.com/open_api/v1.3/event/track/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Access-Token': token },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(1500)
        });
        const out = await res.json().catch(() => null);
        if (!res.ok || !out || out.code !== 0) console.error('[tiktok] Events API error:', JSON.stringify(out));
        else console.log('[tiktok] OK', eventos.map((e) => e.event).join('+'));
    } catch (e) {
        console.error('[tiktok] Events API fallo:', e.message);
    }
}
