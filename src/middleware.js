// src/middleware.js
import { defineMiddleware } from 'astro:middleware';
import { createClient } from '@supabase/supabase-js';

export const onRequest = defineMiddleware(async (context, next) => {
    const { url, cookies, redirect, locals } = context;
    const pathname = url.pathname;

    // Rutas públicas
    if (
        pathname === '/login' ||
        pathname === '/api/login' ||
        pathname === '/api/logout' ||
        pathname.startsWith('/cotizacion/') ||
        pathname.startsWith('/_astro') ||
        pathname.includes('.')
    ) {
        return next();
    }

    const token = cookies.get('sb-access-token')?.value;
    const deviceSessionId = cookies.get('sb-session-lock')?.value;

    if (!token || !deviceSessionId) {
        cookies.delete('sb-access-token', { path: '/' });
        cookies.delete('sb-refresh-token', { path: '/' });
        cookies.delete('sb-session-lock', { path: '/' });
        return redirect('/login');
    }

    const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL || import.meta.env.SUPABASE_URL;
    const supabaseKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY || import.meta.env.SUPABASE_ANON_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data?.user) {
        cookies.delete('sb-access-token', { path: '/' });
        cookies.delete('sb-refresh-token', { path: '/' });
        cookies.delete('sb-session-lock', { path: '/' });
        return redirect('/login');
    }

    // CANDADO ESTRICTO DE UN SOLO DISPOSITIVO EN sesiones_usuarios
    const { data: sesionDB, error: sesionError } = await supabase
        .from('sesiones_usuarios')
        .select('current_session_id, rol, empresa_id')
        .eq('user_id', data.user.id)
        .maybeSingle();

    if (sesionError || !sesionDB || sesionDB.current_session_id !== deviceSessionId) {
        cookies.delete('sb-access-token', { path: '/' });
        cookies.delete('sb-refresh-token', { path: '/' });
        cookies.delete('sb-session-lock', { path: '/' });

        if (pathname.startsWith('/api/')) {
            return new Response(JSON.stringify({
                success: false,
                kick: true,
                message: 'Tu cuenta fue abierta en otro dispositivo.'
            }), { status: 401, headers: { 'Content-Type': 'application/json' } });
        }

        return redirect('/login?motivo=otro_dispositivo');
    }

    locals.user = data.user;
    locals.perfil = sesionDB;

    return next();
});