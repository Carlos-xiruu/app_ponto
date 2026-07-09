// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import Login from './Login';
import Dashboard from './Dashboard';
import BaterPonto from './BaterPonto';
import { LogOut, Hexagon, Loader2 } from 'lucide-react';

export default function App() {
  const [sessao, setSessao] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    // 1. Verifica a sessão atual ao abrir o app
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSessao(session);
      if (session) checkRole(session.user.id);
      else setCarregando(false);
    });

    // 2. Fica escutando mudanças na rede (Login, Logout, Expiração de token)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessao(session);
      if (session) {
        checkRole(session.user.id);
      } else {
        setIsAdmin(false);
        setCarregando(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // 3. Consulta a tabela de perfis para descobrir se é Gestor ou Peão
  const checkRole = async (userId: string) => {
    setCarregando(true);
    const { data, error } = await supabase
      .from('perfis')
      .select('is_admin')
      .eq('id', userId)
      .single();

    if (!error && data) {
      setIsAdmin(data.is_admin);
    }
    setCarregando(false);
  };

  // Minha função de Força Bruta para Logout Instantâneo
  const fazerLogout = () => {
    // 1. Limpa todo o cache e o histórico de sessão instantaneamente
    localStorage.clear();
    sessionStorage.clear();
    
    // 2. Avisa o Supabase que a conta saiu (mas sem o "await", para não travar a tela esperando resposta)
    supabase.auth.signOut();
    
    // 3. Força o redirecionamento imediato do navegador para a tela principal (Login)
    window.location.replace('/');
  };

  // TELA DE CARREGAMENTO (Protege o sistema enquanto verifica o banco)
  if (carregando) {
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center font-sans">
        <Loader2 size={48} className="text-emerald-500 animate-spin mb-4" />
        <div className="flex items-center gap-2 text-emerald-500 font-['Montserrat'] font-bold tracking-wider text-lg">
          Sincronizando Sistema...
        </div>
      </div>
    );
  }

  // SE NÃO TEM SESSÃO: Mostra a porta de entrada (Login)
  if (!sessao) {
    return <Login />;
  }

  // SE ESTÁ LOGADO: Mostra a Navbar Premium + A tela correta
  return (
    <div className="min-h-screen bg-[#020617] flex flex-col font-['Inter']">
      
      {/* NAVBAR PREMIUM ENTERPRISE */}
      <header className="bg-[#0f172a]/80 backdrop-blur-md border-b border-slate-800 px-6 py-4 flex justify-between items-center print:hidden sticky top-0 z-40 shadow-lg">
        <div className="flex items-center gap-2 text-emerald-500 font-['Montserrat'] font-bold tracking-wider text-lg">
          <Hexagon size={24} className="fill-emerald-500/20" />
          PONTO<span className="text-white">SEGURO</span>
        </div>
        
        {/* Meu botão com a injeção do logout  */}
        <button 
          onClick={fazerLogout} 
          className="flex items-center gap-2 text-slate-400 hover:text-red-400 transition-colors text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-red-500/10"
        >
          <LogOut size={18} />
          <span className="hidden sm:inline">Encerrar Sessão</span>
        </button>
      </header>

      {/* ÁREA DE CONTEÚDO (O Comutador Inteligente) */}
      <main className="flex-1 overflow-y-auto">
        {isAdmin ? <Dashboard /> : <BaterPonto />}
      </main>
      
    </div>
  );
}