import { supabase } from '../../lib/supabase';

export const prerender = false;

export const POST = async ({ request }) => {
    try {
        const data = await request.json();
        const { cliente, telefono, tipo, cantidad, largo, alto, factor, guardar } = data;

        // Precios base (en el siguiente paso los jalaremos del Configurador)
        const cfg = { riel: 50, jamba: 50, zoclo: 50, cercoFijo: 50, traslape: 50, cercoChapa: 50, mosquitero: 50, vidrio: 50, herrajes: 5 };
        let costoUnitario = 0;

        if (tipo === 'v2') {
            costoUnitario += (largo / 6.1) * cfg.riel;
            costoUnitario += ((largo + alto + largo) / 6.1) * cfg.jamba;
            costoUnitario += ((largo * 4) / 6) * cfg.zoclo;
            costoUnitario += (alto / 6.1) * cfg.cercoFijo;
            costoUnitario += ((alto * 2) / 6.1) * cfg.traslape;
            costoUnitario += (largo / 6.1) * cfg.cercoChapa;
            costoUnitario += (6.1 / 3.6) * cfg.mosquitero;
            costoUnitario += ((largo * alto) / 4.68) * cfg.vidrio;
            costoUnitario += cfg.herrajes;
        } else if (tipo === 'pta3') {
            costoUnitario += (largo / 6.1) * cfg.riel;
            costoUnitario += ((largo + alto + largo) / 6.1) * cfg.jamba;
            costoUnitario += ((largo * 4) / 6) * cfg.zoclo;
            costoUnitario += (alto / 6.1) * cfg.cercoFijo;
            costoUnitario += ((alto * 2) / 6.1) * cfg.traslape;
            costoUnitario += (largo / 6.1) * cfg.cercoChapa;
            costoUnitario += ((largo * alto) / 4.68) * cfg.vidrio;
            costoUnitario += cfg.herrajes;
        }

        const cant = cantidad > 0 ? cantidad : 1;
        const costoTotal = costoUnitario * cant;
        const precioVenta = costoTotal * factor;

        // SOLO guardamos en Supabase si el usuario le picó a "Enviar por WhatsApp"
        if (guardar === true) {
            if (!telefono || telefono.length < 10) {
                return new Response(JSON.stringify({
                    success: false,
                    message: 'Teléfono inválido para seguimiento'
                }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }

            const { error } = await supabase
                .from('cotizaciones')
                .insert([
                    {
                        cliente_nombre: cliente || 'Cliente WhatsApp',
                        total: precioVenta,
                        detalles_json: {
                            telefono: telefono,
                            tipo: tipo,
                            cantidad: cant,
                            largo: largo,
                            alto: alto,
                            costo_real: costoTotal,
                            factor_aplicado: factor,
                            estatus: 'Enviada por WhatsApp'
                        }
                    }
                ]);

            if (error) {
                console.error("Error de Supabase:", error);
                return new Response(JSON.stringify({
                    success: false,
                    message: error.message
                }), { status: 500, headers: { 'Content-Type': 'application/json' } });
            }
        }

        return new Response(JSON.stringify({
            success: true,
            guardado: guardar === true,
            costoReal: costoTotal,
            precioVenta: precioVenta
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error("Error en API:", error);
        return new Response(JSON.stringify({ success: false, message: 'Error interno al cotizar' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};