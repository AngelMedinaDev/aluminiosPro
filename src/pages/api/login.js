// src/pages/api/login.js
import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

export const prerender = false;

export const POST = async ({ request, cookies }) => {
    try {
        const body = await request.json();
        const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL || import.meta.env.SUPABASE_URL;
        const supabaseKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY || import.meta.env.SUPABASE_ANON_KEY;
        const supabase = createClient(supabaseUrl, supabaseKey);

        let emailFinal = '';
        let passwordFinal = '';

        // Si entra con Teléfono + PIN de 4 dígitos (Flujo para Maestros Alumineros)
        if (body.telefono && body.pin) {
            const telLimpio = String(body.telefono).replace(/\D/g, '');
            const pinLimpio = String(body.pin).replace(/\D/g, '');
            emailFinal = `${telLimpio}@aluminiospro.app`;
            passwordFinal = `AP-pin-${pinLimpio}`;
        } else {
            // Respaldo por si entras con tu correo directo de Super Admin
            emailFinal = (body.email || '').trim();
            passwordFinal = body.password || '';
        }

        const { data, error } = await supabase.auth.signInWithPassword({
            email: emailFinal,
            password: passwordFinal
        });

        if (error || !data.session) {
            return new Response(JSON.stringify({
                success: false,
                message: body.email 
                    ? `Supabase Auth: ${error?.message || 'Credenciales inválidas'}`
                    : 'Número de celular o PIN incorrecto'
            }), { status: 401, headers: { 'Content-Type': 'application/json' } });
        }

        // Revisar si el usuario pertenece a una empresa y si su suscripción sigue activa
        const { data: sesionPrevia } = await supabase
            .from('sesiones_usuarios')
            .select('empresa_id, rol')
            .eq('user_id', data.user.id)
            .maybeSingle();

        if (sesionPrevia?.empresa_id) {
            const { data: emp } = await supabase
                .from('empresas')
                .select('suscripcion_activa')
                .eq('id', sesionPrevia.empresa_id)
                .maybeSingle();

            if (emp && emp.suscripcion_activa === false) {
                return new Response(JSON.stringify({
                    success: false,
                    message: 'Tu suscripción está pausada. Contacta al administrador para renovarla.'
                }), { status: 403, headers: { 'Content-Type': 'application/json' } });
            }
        }

        const nuevoSessionId = crypto.randomUUID();

        const { error: errorSesion } = await supabase
            .from('sesiones_usuarios')
            .upsert({
                user_id: data.user.id,
                email: data.user.email,
                rol: sesionPrevia?.rol || 'admin',
                empresa_id: sesionPrevia?.empresa_id || null,
                current_session_id: nuevoSessionId,
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' });

        if (errorSesion) {
            return new Response(JSON.stringify({
                success: false,
                message: 'Error de sesión: ' + errorSesion.message
            }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }

        // Cookie por 1 año (365 días) para no molestar al maestro aluminero
        const cookieOptions = {
            path: '/',
            httpOnly: true,
            sameSite: 'lax',
            secure: false,
            maxAge: 60 * 60 * 24 * 365
        };

        cookies.set('sb-access-token', data.session.access_token, cookieOptions);
        cookies.set('sb-refresh-token', data.session.refresh_token, cookieOptions);
        cookies.set('sb-session-lock', nuevoSessionId, cookieOptions);

        return new Response(JSON.stringify({
            success: true
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });

    } catch (err) {
        return new Response(JSON.stringify({
            success: false,
            message: 'Error interno: ' + err.message
        }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
};