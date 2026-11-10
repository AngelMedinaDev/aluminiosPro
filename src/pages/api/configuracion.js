// src/pages/api/configuracion.js
import { createClient } from '@supabase/supabase-js';

export const prerender = false;

export const POST = async ({ request }) => {
    try {
        const body = await request.json();
        const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL || import.meta.env.SUPABASE_URL;
        const supabaseKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY || import.meta.env.SUPABASE_ANON_KEY;
        const supabase = createClient(supabaseUrl, supabaseKey);

        const { error } = await supabase
            .from('configuracion_precios')
            .upsert({
                id: 1,
                riel: Number(body.riel) || 0,
                jamba: Number(body.jamba) || 0,
                zoclo: Number(body.zoclo) || 0,
                cerco_fijo: Number(body.cerco_fijo) || 0,
                traslape: Number(body.traslape) || 0,
                cerco_chapa: Number(body.cerco_chapa) || 0,
                mosquitero: Number(body.mosquitero) || 0,
                vidrio: Number(body.vidrio) || 0,
                herrajes: Number(body.herrajes) || 0,
                factor: Number(body.factor) || 2.5,
                updated_at: new Date().toISOString()
            });

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