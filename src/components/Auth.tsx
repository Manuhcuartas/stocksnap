import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function Auth() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loginError, setLoginError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setLoginError('');
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) setLoginError('Credenciales incorrectas');
        setLoading(false);
    };

    return (
        <main className="min-h-screen bg-[#f4f4f0] flex items-center justify-center p-4">
            <div className="bg-white border-4 border-black p-6 w-full max-w-sm shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                <h1 className="text-3xl font-black uppercase tracking-tighter mb-6 text-center border-b-4 border-black pb-4">Acceso</h1>
                <form onSubmit={handleLogin} className="space-y-4">
                    <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="w-full border-2 border-black p-3" required />
                    <input type="password" placeholder="Contraseña" value={password} onChange={e => setPassword(e.target.value)} className="w-full border-2 border-black p-3" required />
                    {loginError && <p className="font-mono text-red-600 font-bold bg-red-100 p-2 border-2 border-red-600">{loginError}</p>}
                    <button type="submit" disabled={loading} className="w-full bg-black text-white font-black uppercase p-4 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)] active:translate-y-[4px] active:translate-x-[4px] active:shadow-none disabled:opacity-50">
                        {loading ? 'Cargando...' : 'Entrar'}
                    </button>
                </form>
            </div>
        </main>
    );
}