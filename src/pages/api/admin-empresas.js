// src/pages/api/admin-empresas.js
import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

export const prerender = false;

export const POST = async ({ request }) => {
    try {
        const body = await request.json();
        const { accion } = body;

        const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL || import.meta.env.SUPABASE_URL;
        const supabaseKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY || import.meta.env.SUPABASE_ANON_KEY;
        const supabase = createClient(supabaseUrl, supabaseKey);

        const authClient = createClient(supabaseUrl, supabaseKey, {
            auth: { persistSession: false, autoRefreshToken: false }
        });

        // ACCIÓN 1: CREAR NUEVO TALLER CON PLAN Y FECHA DE VENCIMIENTO
        if (accion === 'crear') {
            const nombre_taller = (body.nombre_taller || '').trim();
            const telefono = String(body.telefono || '').replace(/\D/g, '');
            const pin_acceso = String(body.pin_acceso || '').replace(/\D/g, '');
            const logo_url = body.logo_url || '';
            const plan_nombre = body.plan_nombre || 'Plan Pro';
            const fecha_vencimiento = body.fecha_vencimiento || null;

            if (!nombre_taller || telefono.length !== 10 || pin_acceso.length !== 4) {
                return new Response(JSON.stringify({
                    success: false,
                    message: 'Pon el nombre del taller, celular de 10 dígitos y PIN de 4 números.'
                }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }

            const emailInterno = `${telefono}@aluminiospro.app`;
            const passwordInterno = `AP-pin-${pin_acceso}`;
            const tokenActivacion = crypto.randomUUID();

            const { data: signUpData, error: signUpErr } = await authClient.auth.signUp({
                email: emailInterno,
                password: passwordInterno
            });

            if (signUpErr || !signUpData?.user) {
                return new Response(JSON.stringify({
                    success: false,
                    message: 'No se pudo registrar ese celular (verifica que no esté repetido): ' + (signUpErr?.message || '')
                }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }

            const { data: nuevaEmpresa, error: empErr } = await supabase
                .from('empresas')
                .insert([{
                    nombre_taller,
                    telefono,
                    pin_acceso,
                    logo_url,
                    plan_nombre,
                    fecha_vencimiento,
                    suscripcion_activa: true,
                    tiene_crm: Boolean(body.tiene_crm),
                    tiene_excel: Boolean(body.tiene_excel),
                    tiene_pdf: Boolean(body.tiene_pdf),
                    token_activacion: tokenActivacion,
                    token_usado: false
                }])
                .select()
                .single();

            if (empErr) throw empErr;

            await supabase
                .from('sesiones_usuarios')
                .upsert({
                    user_id: signUpData.user.id,
                    email: emailInterno,
                    nombre_vendedor: 'Dueño / Titular',
                    telefono,
                    pin_acceso,
                    rol: 'vendedor',
                    empresa_id: nuevaEmpresa.id,
                    current_session_id: crypto.randomUUID(),
                    token_activacion: tokenActivacion,
                    token_usado: false
                }, { onConflict: 'user_id' });

            return new Response(JSON.stringify({ success: true, empresa: nuevaEmpresa }), {
                status: 200, headers: { 'Content-Type': 'application/json' }
            });
        }

        // ACCIÓN 2: AGREGAR LICENCIA / VENDEDOR EXTRA
        if (accion === 'agregar_vendedor') {
            const empresa_id = Number(body.empresa_id);
            const nombre_vendedor = (body.nombre_vendedor || 'Vendedor').trim();
            const telefono = String(body.telefono || '').replace(/\D/g, '');
            const pin_acceso = String(body.pin_acceso || '').replace(/\D/g, '');

            if (!empresa_id || telefono.length !== 10 || pin_acceso.length !== 4) {
                return new Response(JSON.stringify({
                    success: false,
                    message: 'Selecciona el taller, celular de 10 dígitos y PIN de 4 números.'
                }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }

            const emailInterno = `${telefono}@aluminiospro.app`;
            const passwordInterno = `AP-pin-${pin_acceso}`;
            const tokenActivacion = crypto.randomUUID();

            const { data: signUpData, error: signUpErr } = await authClient.auth.signUp({
                email: emailInterno,
                password: passwordInterno
            });

            if (signUpErr || !signUpData?.user) {
                return new Response(JSON.stringify({
                    success: false,
                    message: 'Ese número de celular ya está registrado: ' + (signUpErr?.message || '')
                }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }

            const { error: sesErr } = await supabase
                .from('sesiones_usuarios')
                .upsert({
                    user_id: signUpData.user.id,
                    email: emailInterno,
                    nombre_vendedor,
                    telefono,
                    pin_acceso,
                    rol: 'vendedor',
                    empresa_id: empresa_id,
                    current_session_id: crypto.randomUUID(),
                    token_activacion: tokenActivacion,
                    token_usado: false
                }, { onConflict: 'user_id' });

            if (sesErr) throw sesErr;

            return new Response(JSON.stringify({ success: true }), {
                status: 200, headers: { 'Content-Type': 'application/json' }
            });
        }

        // ACCIÓN 3: PRENDER / APAGAR FUNCIONES
        if (accion === 'toggle') {
            const { id, campo, valor } = body;
            const { error } = await supabase
                .from('empresas')
                .update({ [campo]: Boolean(valor) })
                .eq('id', Number(id));

            if (error) throw error;
            return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        // ACCIÓN 4: ACTUALIZAR PLAN O FECHA DE VENCIMIENTO EN VIVO
        if (accion === 'actualizar_campo') {
            const { id, campo, valor } = body;
            const { error } = await supabase
                .from('empresas')
                .update({ [campo]: valor })
                .eq('id', Number(id));

            if (error) throw error;
            return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        // ACCIÓN 5: REGENERAR LINK MÁGICO DE UN USUARIO
        if (accion === 'regenerar_link_usuario') {
            const nuevoToken = crypto.randomUUID();
            const { error } = await supabase
                .from('sesiones_usuarios')
                .update({ token_activacion: nuevoToken, token_usado: false })
                .eq('user_id', body.user_id);

            if (error) throw error;
            return new Response(JSON.stringify({ success: true, token: nuevoToken }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        return new Response(JSON.stringify({ success: false, message: 'Acción no válida' }), { status: 400 });

    } catch (err) {
        return new Response(JSON.stringify({
            success: false,
            message: err.message
        }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
};