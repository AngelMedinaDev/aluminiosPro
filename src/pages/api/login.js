// src/pages/api/login.js
import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

export const prerender = false;

export const POST = async ({ request, cookies }) => {
    try {
        const { email, password } = await request.json();

        const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL || import.meta.env.SUPABASE_URL;
        const supabaseKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY || import.meta.env.SUPABASE_ANON_KEY;
        const supabase = createClient(supabaseUrl, supabaseKey);

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error || !data.session) {
            return new Response(JSON.stringify({
                success: false,
                message: 'Correo o contraseña incorrectos'
            }), { status: 401, headers: { 'Content-Type': 'application/json' } });
        }

        const nuevoSessionId = crypto.randomUUID();

        // Actualizamos la sesión activa en sesiones_usuarios
        const { error: errorSesion } = await supabase
            .from('sesiones_usuarios')
            .upsert({
                user_id: data.user.id,
                email: data.user.email,
                current_session_id: nuevoSessionId,
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' });

        if (errorSesion) {
            return new Response(JSON.stringify({
                success: false,
                message: 'Error en tabla sesiones_usuarios: ' + errorSesion.message
            }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }

        const cookieOptions = {
            path: '/',
            httpOnly: true,
            sameSite: 'lax',
            secure: false, // Necesario en false para que localhost en Chrome/Edge siempre guarde la cookie
            maxAge: 60 * 60 * 24 * 7
        };

        cookies.set('sb-access-token', data.session.access_token, cookieOptions);
        cookies.set('sb-refresh-token', data.session.refresh_token, cookieOptions);
        cookies.set('sb-session-lock', nuevoSessionId, cookieOptions);

        return new Response(JSON.stringify({
            success: true,
            sessionId: nuevoSessionId,
            user: { email: data.user.email }
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });

    } catch (err) {
        return new Response(JSON.stringify({
            success: false,
            message: 'Error interno: ' + err.message
        }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
};