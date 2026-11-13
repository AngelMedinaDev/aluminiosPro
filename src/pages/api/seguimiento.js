// src/pages/api/seguimiento.js
import { createClient } from '@supabase/supabase-js';

export const prerender = false;

export const POST = async ({ request }) => {
    try {
        const body = await request.json();
        const {
            id,
            accion = 'cambiar_estatus',
            estatusActual,
            vendedorAccion = 'Titular',
            detallesActuales = {}
        } = body;

        const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL || import.meta.env.SUPABASE_URL;
        const supabaseKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY || import.meta.env.SUPABASE_ANON_KEY;
        const supabase = createClient(supabaseUrl, supabaseKey);

        const ahoraISO = new Date().toISOString();

        // ACCIÓN A: REGISTRAR QUE SE LE DIO SEGUIMIENTO POR WHATSAPP
        if (accion === 'registrar_contacto') {
            const nuevosDetalles = {
                ...detallesActuales,
                ultimo_seguimiento_por: vendedorAccion,
                fecha_ultimo_seguimiento: ahoraISO
            };

            const { error } = await supabase
                .from('cotizaciones')
                .update({
                    ultimo_seguimiento_por: vendedorAccion,
                    fecha_ultimo_seguimiento: ahoraISO,
                    detalles_json: nuevosDetalles
                })
                .eq('id', Number(id));

            if (error) throw error;

            return new Response(JSON.stringify({ success: true, fecha: ahoraISO }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // ACCIÓN B: CAMBIAR ESTATUS (VENDIDO / DESCARTADO / PENDIENTE) Y GUARDAR FECHA EXACTA
        const nuevosDetalles = {
            ...detallesActuales,
            estatus: estatusActual,
            estatus_cambiado_por: vendedorAccion,
            fecha_cambio_estatus: ahoraISO
        };

        const { error } = await supabase
            .from('cotizaciones')
            .update({
                estatus: estatusActual,
                fecha_cambio_estatus: ahoraISO,
                detalles_json: nuevosDetalles
            })
            .eq('id', Number(id));

        if (error) throw error;

        return new Response(JSON.stringify({ success: true, fecha: ahoraISO }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        return new Response(JSON.stringify({
            success: false,
            message: error.message
        }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
};