import { sb, LANDING_ID } from './_supabase.js';

const TIKTOK_PIXEL_ID = 'DBCGVU3C77UAPSNVTNQ0';

// Si Supabase no responde, el boton igual funciona con esta lista (eleccion al azar).
const FALLBACK_NUMEROS = [
    '5491133633742',
    '5491133633748',
    '5491133633847',
    '5491176243646',
    '5493548591305',
    '5493548603069',
    '5493548616968'
];

const WA_MSGS = [
    'Hola! Quiero reclamar mi bono del 50%…',
    'Hola! Me gustaría reclamar el bono del 50%, ¿me ayudan?',
    'Buenas! Quiero activar el bono del 50%, ¿cómo hago?',
    'Hola! Vi la promo del 50% de bono y quiero aprovecharla.',
    'Buenas, quiero acceder al bono del 50%, ¿me indican cómo?',
    'Hola! Vengo por la promo del bono 50%, ¿cómo lo reclamo?',
    'Buenas! Quería consultar cómo obtener el bono del 50%.',
    'Hola! ¿Me pueden dar el bono del 50% de bienvenida?',
    'Buenas! Estoy interesado en aprovechar el bono del 50%.',
    'Hola! Quiero usar la promo del 50%, ¿me ayudan?',
    'Buenas! ¿Cómo hago para reclamar el bono del 50%?'
];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function parseCookies(header = '') {
    const out = {};
    header.split(';').forEach((part) => {
        const i = part.indexOf('=');
        if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
    });
    return out;
}

async function elegirNumero() {
    try {
        const numero = await sb('rpc/next_wa_numero', { method: 'POST', body: { p_landing: LANDING_ID } });
        if (numero) return numero;
        console.warn('[wa] no hay numeros activos en Supabase, uso fallback');
    } catch (e) {
        console.error('[wa] error Supabase, uso fallback:', e.message);
    }
    return pick(FALLBACK_NUMEROS);
}

// Contact server-side (TikTok Events API). Usa el mismo eid que el Contact del Pixel para deduplicar.
// Sin TIKTOK_ACCESS_TOKEN no hace nada (el Pixel del navegador sigue funcionando igual).
async function enviarContacto(req, { eid, ttclid }) {
    const token = process.env.TIKTOK_ACCESS_TOKEN;
    if (!token || !eid) return;

    const cookies = parseCookies(req.headers.cookie);
    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim();

    const payload = {
        event_source: 'web',
        event_source_id: TIKTOK_PIXEL_ID,
        data: [{
            event: 'Contact',
            event_time: Math.floor(Date.now() / 1000),
            event_id: eid,
            user: {
                ttclid: ttclid || undefined,
                ttp: cookies._ttp || undefined,
                ip: ip || undefined,
                user_agent: req.headers['user-agent'] || undefined
            },
            page: {
                url: req.headers.referer || `https://${req.headers.host}/`
            },
            properties: { content_name: 'WhatsApp Click' }
        }]
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
        if (!res.ok || (out && out.code !== 0)) console.error('[wa] TikTok Events API error:', JSON.stringify(out));
    } catch (e) {
        console.error('[wa] TikTok Events API fallo:', e.message);
    }
}

export default async function handler(req, res) {
    const eid = /^[a-f0-9]{8,64}$/i.test(req.query.eid || '') ? req.query.eid : '';
    const ttclid = String(req.query.ttclid || '').slice(0, 500);

    const [numero] = await Promise.all([elegirNumero(), enviarContacto(req, { eid, ttclid })]);

    const url = `https://wa.me/${numero}?text=${encodeURIComponent(pick(WA_MSGS))}`;
    res.setHeader('Cache-Control', 'no-store');
    res.redirect(302, url);
}
