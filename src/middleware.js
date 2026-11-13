// src/middleware.js
import { defineMiddleware } from 'astro:middleware';
import { createClient } from '@supabase/supabase-js';

export const onRequest = defineMiddleware(async (context, next) => {
    const { url, cookies, redirect, locals } = context;
    const pathname = url.pathname;

    // Rutas públicas libres
    if (
        pathname === '/login' ||
        pathname === '/activar' ||
        pathname === '/cotizacion' ||
        pathname.startsWith('/cotizacion/') ||
        pathname === '/api/login' ||
        pathname === '/api/logout' ||
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

    const { data: sesionDB, error: sesionError } = await supabase
        .from('sesiones_usuarios')
        .select('current_session_id, rol, empresa_id, nombre_vendedor, telefono')
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

    let empresa = {
        id: null,
        nombre_taller: 'Aluminios Pro',
        logo_url: '',
        suscripcion_activa: true,
        tiene_crm: true,
        tiene_excel: true,
        tiene_pdf: true,
        plan_nombre: 'Admin Master',
        fecha_vencimiento: null
    };

    if (sesionDB.empresa_id) {
        const { data: empData } = await supabase
            .from('empresas')
            .select('*')
            .eq('id', sesionDB.empresa_id)
            .maybeSingle();

        if (empData) {
            empresa = empData;
            if (empData.suscripcion_activa === false) {
                cookies.delete('sb-access-token', { path: '/' });
                cookies.delete('sb-refresh-token', { path: '/' });
                cookies.delete('sb-session-lock', { path: '/' });
                return redirect('/login?motivo=suspendido');
            }
        }
    }

    if (pathname === '/seguimiento' && !empresa.tiene_crm && sesionDB.rol !== 'admin') {
        return redirect('/');
    }

    locals.user = data.user;
    locals.perfil = {
        ...sesionDB,
        nombre_mostrar: sesionDB.nombre_vendedor || (sesionDB.rol === 'admin' ? 'Super Admin' : 'Titular')
    };
    locals.empresa = empresa;

    return next();
});