// src/pages/api/logout.js
export const prerender = false;

export const POST = async ({ cookies, redirect }) => {
    cookies.delete('sb-access-token', { path: '/' });
    cookies.delete('sb-refresh-token', { path: '/' });
    return redirect('/login');
}