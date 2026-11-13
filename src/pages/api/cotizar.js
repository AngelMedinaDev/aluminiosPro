// src/pages/api/cotizar.js
import { createClient } from '@supabase/supabase-js';

export const prerender = false;

export const POST = async ({ request }) => {
    try {
        const data = await request.json();
        const {
            empresa_id = null,
            vendedor_nombre = 'Titular',
            cliente = '',
            telefono = '',
            tipo = 'v2',
            cantidad = 1,
            largo = 0,
            alto = 0,
            factor = 2.5,
            partidas = [],
            guardar = false
        } = data;

        const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL || import.meta.env.SUPABASE_URL;
        const supabaseKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY || import.meta.env.SUPABASE_ANON_KEY;
        const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

        let cfg = { riel: 50, jamba: 50, zoclo: 50, cerco_fijo: 50, traslape: 50, cerco_chapa: 50, mosquitero: 50, vidrio: 50, herrajes: 5, factor: 2.5 };
        if (supabase) {
            const { data: preciosDB } = await supabase
                .from('configuracion_precios')
                .select('*')
                .eq('id', 1)
                .maybeSingle();
            if (preciosDB) cfg = preciosDB;
        }

        const calcularPieza = (t, l, a, c, f) => {
            let unitario = 0;
            const largoNum = Number(l) || 0;
            const altoNum = Number(a) || 0;
            const cantNum = Number(c) > 0 ? Number(c) : 1;
            const factorNum = Number(f) > 0 ? Number(f) : (Number(cfg.factor) || 2.5);

            if (t === 'v2') {
                unitario += (largoNum / 6.1) * Number(cfg.riel);
                unitario += ((largoNum + altoNum + largoNum) / 6.1) * Number(cfg.jamba);
                unitario += ((largoNum * 4) / 6) * Number(cfg.zoclo);
                unitario += (altoNum / 6.1) * Number(cfg.cerco_fijo);
                unitario += ((altoNum * 2) / 6.1) * Number(cfg.traslape);
                unitario += (largoNum / 6.1) * Number(cfg.cerco_chapa);
                unitario += (6.1 / 3.6) * Number(cfg.mosquitero);
                unitario += ((largoNum * altoNum) / 4.68) * Number(cfg.vidrio);
                unitario += Number(cfg.herrajes);
            } else if (t === 'pta3') {
                unitario += (largoNum / 6.1) * Number(cfg.riel);
                unitario += ((largoNum + altoNum + largoNum) / 6.1) * Number(cfg.jamba);
                unitario += ((largoNum * 4) / 6) * Number(cfg.zoclo);
                unitario += (altoNum / 6.1) * Number(cfg.cerco_fijo);
                unitario += ((altoNum * 2) / 6.1) * Number(cfg.traslape);
                unitario += (largoNum / 6.1) * Number(cfg.cerco_chapa);
                unitario += ((largoNum * altoNum) / 4.68) * Number(cfg.vidrio);
                unitario += Number(cfg.herrajes);
            }

            const costoTotal = unitario * cantNum;
            const precioVenta = costoTotal * factorNum;
            return { costoTotal, precioVenta, cantNum, largoNum, altoNum, factorNum };
        };

        if (!guardar) {
            const res = calcularPieza(tipo, largo, alto, cantidad, factor);
            return new Response(JSON.stringify({
                success: true,
                guardado: false,
                costoReal: res.costoTotal,
                precioVenta: res.precioVenta
            }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        const listaParaProcesar = Array.isArray(partidas) && partidas.length > 0
            ? partidas
            : [{ tipo, cantidad, largo, alto, factor }];

        let granCostoReal = 0;
        let granPrecioVenta = 0;
        const partidasCalculadas = listaParaProcesar.map(item => {
            const calc = calcularPieza(item.tipo, item.largo, item.alto, item.cantidad, item.factor);
            granCostoReal += calc.costoTotal;
            granPrecioVenta += calc.precioVenta;
            return {
                tipo: item.tipo,
                cantidad: calc.cantNum,
                largo: calc.largoNum,
                alto: calc.altoNum,
                factor: calc.factorNum,
                costo_real: calc.costoTotal,
                subtotal: calc.precioVenta
            };
        });

        if (!supabase) {
            return new Response(JSON.stringify({
                success: false,
                costoReal: granCostoReal,
                precioVenta: granPrecioVenta,
                message: 'Faltan variables de Supabase'
            }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        const primera = partidasCalculadas[0];
        const resumenTexto = partidasCalculadas.length > 1
            ? `${partidasCalculadas.length} partidas (${partidasCalculadas.reduce((a, b) => a + b.cantidad, 0)} pzas)`
            : null;

        const ahoraISO = new Date().toISOString();

        const { data: insertado, error } = await supabase
            .from('cotizaciones')
            .insert([
                {
                    empresa_id: empresa_id || null,
                    vendedor_nombre: vendedor_nombre || 'Titular',
                    cliente_nombre: cliente || 'Cliente WhatsApp',
                    cliente_telefono: telefono,
                    total: granPrecioVenta,
                    estatus: 'Pendiente',
                    detalles_json: {
                        telefono: telefono,
                        tipo: resumenTexto || primera.tipo,
                        cantidad: partidasCalculadas.length > 1 ? 1 : primera.cantidad,
                        largo: primera.largo,
                        alto: primera.alto,
                        costo_real: granCostoReal,
                        factor_aplicado: primera.factor,
                        partidas: partidasCalculadas,
                        vendedor_creador: vendedor_nombre || 'Titular',
                        estatus: 'Pendiente',
                        historial_fechas: {
                            creado: ahoraISO
                        }
                    }
                }
            ])
            .select('id')
            .single();

        if (error) {
            return new Response(JSON.stringify({
                success: false,
                costoReal: granCostoReal,
                precioVenta: granPrecioVenta,
                partidas: partidasCalculadas,
                message: 'Supabase dijo: ' + error.message
            }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        return new Response(JSON.stringify({
            success: true,
            guardado: true,
            cotizacionId: insertado?.id,
            costoReal: granCostoReal,
            precioVenta: granPrecioVenta,
            partidas: partidasCalculadas
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