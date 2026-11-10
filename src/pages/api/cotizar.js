// src/pages/api/cotizar.js
import { createClient } from '@supabase/supabase-js';

export const prerender = false;

export const POST = async ({ request }) => {
    try {
        const data = await request.json();
        const {
            cliente = '',
            telefono = '',
            tipo = 'v2',
            cantidad = 1,
            largo = 0,
            alto = 0,
            factor = 2.5,
            guardar = false
        } = data;

        const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL || import.meta.env.SUPABASE_URL;
        const supabaseKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY || import.meta.env.SUPABASE_ANON_KEY;
        const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

        // 1. Obtener precios configurados en Supabase (o usar respaldo si aún no se crea la tabla)
        let cfg = { riel: 50, jamba: 50, zoclo: 50, cerco_fijo: 50, traslape: 50, cerco_chapa: 50, mosquitero: 50, vidrio: 50, herrajes: 5 };
        if (supabase) {
            const { data: preciosDB } = await supabase
                .from('configuracion_precios')
                .select('*')
                .eq('id', 1)
                .single();
            if (preciosDB) cfg = preciosDB;
        }

        let costoUnitario = 0;
        const l = Number(largo) || 0;
        const a = Number(alto) || 0;
        const c = Number(cantidad) > 0 ? Number(cantidad) : 1;
        const f = Number(factor) > 0 ? Number(factor) : (Number(cfg.factor) || 2.5);

        if (tipo === 'v2') {
            costoUnitario += (l / 6.1) * Number(cfg.riel);
            costoUnitario += ((l + a + l) / 6.1) * Number(cfg.jamba);
            costoUnitario += ((l * 4) / 6) * Number(cfg.zoclo);
            costoUnitario += (a / 6.1) * Number(cfg.cerco_fijo);
            costoUnitario += ((a * 2) / 6.1) * Number(cfg.traslape);
            costoUnitario += (l / 6.1) * Number(cfg.cerco_chapa);
            costoUnitario += (6.1 / 3.6) * Number(cfg.mosquitero);
            costoUnitario += ((l * a) / 4.68) * Number(cfg.vidrio);
            costoUnitario += Number(cfg.herrajes);
        } else if (tipo === 'pta3') {
            costoUnitario += (l / 6.1) * Number(cfg.riel);
            costoUnitario += ((l + a + l) / 6.1) * Number(cfg.jamba);
            costoUnitario += ((l * 4) / 6) * Number(cfg.zoclo);
            costoUnitario += (a / 6.1) * Number(cfg.cerco_fijo);
            costoUnitario += ((a * 2) / 6.1) * Number(cfg.traslape);
            costoUnitario += (l / 6.1) * Number(cfg.cerco_chapa);
            costoUnitario += ((l * a) / 4.68) * Number(cfg.vidrio);
            costoUnitario += Number(cfg.herrajes);
        }

        const costoTotal = costoUnitario * c;
        const precioVenta = costoTotal * f;

        if (!guardar) {
            return new Response(JSON.stringify({
                success: true,
                guardado: false,
                costoReal: costoTotal,
                precioVenta: precioVenta
            }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        if (!supabase) {
            return new Response(JSON.stringify({
                success: false,
                costoReal: costoTotal,
                precioVenta: precioVenta,
                message: 'Faltan variables de Supabase'
            }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        const { error } = await supabase
            .from('cotizaciones')
            .insert([
                {
                    cliente_nombre: cliente || 'Cliente WhatsApp',
                    cliente_telefono: telefono,
                    total: precioVenta,
                    estatus: 'Pendiente',
                    detalles_json: {
                        telefono: telefono,
                        tipo: tipo,
                        cantidad: c,
                        largo: l,
                        alto: a,
                        costo_real: costoTotal,
                        factor_aplicado: f,
                        estatus: 'Pendiente'
                    }
                }
            ]);

        if (error) {
            return new Response(JSON.stringify({
                success: false,
                costoReal: costoTotal,
                precioVenta: precioVenta,
                message: 'Supabase dijo: ' + error.message
            }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        return new Response(JSON.stringify({
            success: true,
            guardado: true,
            costoReal: costoTotal,
            precioVenta: precioVenta
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });

    } catch (error) {
        return new Response(JSON.stringify({
            success: false,
            costoReal: 0,
            precioVenta: 0,
            message: 'Detalle técnico: ' + error.message
        }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
};