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

        // 1. CÁLCULO DEL PRECIO (Siempre se ejecuta primero y nunca falla por culpa de la BD)
        const cfg = { riel: 50, jamba: 50, zoclo: 50, cercoFijo: 50, traslape: 50, cercoChapa: 50, mosquitero: 50, vidrio: 50, herrajes: 5 };
        let costoUnitario = 0;

        const l = Number(largo) || 0;
        const a = Number(alto) || 0;
        const c = Number(cantidad) > 0 ? Number(cantidad) : 1;
        const f = Number(factor) > 0 ? Number(factor) : 2.5;

        if (tipo === 'v2') {
            costoUnitario += (l / 6.1) * cfg.riel;
            costoUnitario += ((l + a + l) / 6.1) * cfg.jamba;
            costoUnitario += ((l * 4) / 6) * cfg.zoclo;
            costoUnitario += (a / 6.1) * cfg.cercoFijo;
            costoUnitario += ((a * 2) / 6.1) * cfg.traslape;
            costoUnitario += (l / 6.1) * cfg.cercoChapa;
            costoUnitario += (6.1 / 3.6) * cfg.mosquitero;
            costoUnitario += ((l * a) / 4.68) * cfg.vidrio;
            costoUnitario += cfg.herrajes;
        } else if (tipo === 'pta3') {
            costoUnitario += (l / 6.1) * cfg.riel;
            costoUnitario += ((l + a + l) / 6.1) * cfg.jamba;
            costoUnitario += ((l * 4) / 6) * cfg.zoclo;
            costoUnitario += (a / 6.1) * cfg.cercoFijo;
            costoUnitario += ((a * 2) / 6.1) * cfg.traslape;
            costoUnitario += (l / 6.1) * cfg.cercoChapa;
            costoUnitario += ((l * a) / 4.68) * cfg.vidrio;
            costoUnitario += cfg.herrajes;
        }

        const costoTotal = costoUnitario * c;
        const precioVenta = costoTotal * f;

        // Si solo estamos calculando en vivo (guardar === false), regresamos el precio de inmediato
        if (!guardar) {
            return new Response(JSON.stringify({
                success: true,
                guardado: false,
                costoReal: costoTotal,
                precioVenta: precioVenta
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // 2. GUARDADO EN SUPABASE (Solo entra aquí cuando le picas al botón de WhatsApp)
        const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL || import.meta.env.SUPABASE_URL;
        const supabaseKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY || import.meta.env.SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseKey || supabaseKey.includes('asegúrate')) {
            return new Response(JSON.stringify({
                success: false,
                costoReal: costoTotal,
                precioVenta: precioVenta,
                message: 'Falta poner la llave completa de SUPABASE_ANON_KEY en tu archivo .env'
            }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

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
                        factor_aplicado: f
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
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        return new Response(JSON.stringify({
            success: false,
            costoReal: 0,
            precioVenta: 0,
            message: 'Detalle técnico: ' + error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};