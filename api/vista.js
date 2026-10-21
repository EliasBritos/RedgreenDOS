import { enviarEventosTikTok, eidValido } from './_tiktok.js';

// ViewContent server-side: la landing lo llama con sendBeacon al cargar, con el mismo
// event_id que el ViewContent del Pixel del navegador (asi TikTok los deduplica).
export default async function handler(req, res) {
    const eid = eidValido(req.query.eid);
    const ttclid = String(req.query.ttclid || '').slice(0, 500);

    if (eid) await enviarEventosTikTok(req, [{ event: 'ViewContent', event_id: eid }], { ttclid });

    res.setHeader('Cache-Control', 'no-store');
    res.status(204).end();
}
