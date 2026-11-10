// src/pages/api/seguimiento.js
import { createClient } from '@supabase/supabase-js';

export const prerender = false;

export const POST = async ({ request }) => {
    try {
        const { id, estatusActual, detallesActuales } = await request.json();

        const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL || import.meta.env.SUPABASE_URL;
        const supabaseKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY || import.meta.env.SUPABASE_ANON_KEY;
        const supabase = createClient(supabaseUrl, supabaseKey);

        const nuevosDetalles = {
            ...(detallesActuales || {}),
            estatus: estatusActual
        };

        const { error } = await supabase
            .from('cotizaciones')
            .update({
                estatus: estatusActual,
                detalles_json: nuevosDetalles
            })
            .eq('id', id);

        if (error) throw error;

        return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(JSON.stringify({ success: false, message: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};