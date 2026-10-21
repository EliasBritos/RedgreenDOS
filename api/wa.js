import { sb, LANDING_ID } from './_supabase.js';
import { enviarEventosTikTok, eidValido } from './_tiktok.js';

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

export default async function handler(req, res) {
    const eid = eidValido(req.query.eid);
    const ttclid = String(req.query.ttclid || '').slice(0, 500);
    // Mismos event_id que usa openWA() en el navegador: ClickButton = eid + 'c', Contact = eid.
    const eventos = eid ? [
        { event: 'ClickButton', event_id: eid + 'c', content_name: 'WhatsApp Click' },
        { event: 'Contact', event_id: eid, content_name: 'WhatsApp Click' }
    ] : [];

    const [numero] = await Promise.all([elegirNumero(), enviarEventosTikTok(req, eventos, { ttclid })]);

    const url = `https://wa.me/${numero}?text=${encodeURIComponent(pick(WA_MSGS))}`;
    res.setHeader('Cache-Control', 'no-store');
    res.redirect(302, url);
}
