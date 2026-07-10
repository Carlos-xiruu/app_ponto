// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import Login from './Login';
import Dashboard from './Dashboard';
import BaterPonto from './BaterPonto';
import { LogOut, Hexagon, Loader2, KeyRound, Save } from 'lucide-react';

export default function App() {
  const [sessao, setSessao] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [carregando, setCarregando] = useState(true);
  
  // Meus novos estados para interceptar a recuperação de senha
  const [precisaMudarSenha, setPrecisaMudarSenha] = useState(false);
  const [novaSenha, setNovaSenha] = useState('');
  const [atualizandoSenha, setAtualizandoSenha] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSessao(session);
      if (session) checkRole(session.user.id);
      else setCarregando(false);
    });

    // O Motor que escuta todos os eventos de segurança
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSessao(session);

      // A Mágica: Se o login veio de um link de recuperação, ativa a trava!
      if (event === 'PASSWORD_RECOVERY') {
        setPrecisaMudarSenha(true);
      }

      if (session) {
        checkRole(session.user.id);
      } else {
        setIsAdmin(false);
        setCarregando(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

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

  const fazerLogout = () => {
    localStorage.clear();
    sessionStorage.clear();
    supabase.auth.signOut();
    window.location.replace('/');
  };

  // Minha função que envia a nova senha para o servidor e destranca o aplicativo
  const salvarNovaSenha = async (e) => {
    e.preventDefault();
    setAtualizandoSenha(true);
    const { error } = await supabase.auth.updateUser({ password: novaSenha });
    
    if (error) {
      alert('Erro ao atualizar senha: ' + error.message);
    } else {
      alert('Senha atualizada com sucesso! Seu acesso está liberado.');
      setPrecisaMudarSenha(false); // Destranca a tela e deixa ele usar o app
    }
    setAtualizandoSenha(false);
  };

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

  if (!sessao) {
    return <Login />;
  }

  // --- INTERCEPTAÇÃO DE SENHA ---
  if (precisaMudarSenha) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center p-6 font-['Inter'] relative overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="w-full max-w-md bg-[#0f172a]/80 backdrop-blur-xl border border-slate-700 rounded-3xl p-8 shadow-2xl relative z-10">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700 mb-4 shadow-lg">
              <KeyRound size={32} className="text-blue-500" />
            </div>
            <h2 className="text-2xl font-bold text-white font-['Montserrat']">Criar Nova Senha</h2>
            <p className="text-sm text-slate-400 mt-2">Você usou o link de recuperação. Digite sua nova senha corporativa abaixo para liberar o sistema.</p>
          </div>
          <form onSubmit={salvarNovaSenha} className="flex flex-col gap-4">
            <div>
              <label className="block text-slate-400 text-xs font-semibold uppercase mb-2">Sua Nova Senha</label>
              <input 
                type="password" 
                value={novaSenha} 
                onChange={e => setNovaSenha(e.target.value)} 
                required 
                minLength={6} 
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 text-white focus:border-blue-500 outline-none transition-colors" 
                placeholder="No mínimo 6 caracteres" 
              />
            </div>
            <button 
              type="submit" 
              disabled={atualizandoSenha} 
              className="mt-4 w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-blue-900/20 flex justify-center items-center gap-2 disabled:opacity-50"
            >
              {atualizandoSenha ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />} Salvar Nova Senha
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- O APP NORMAL SEGUE ABAIXO ---
  return (
    <div className="min-h-screen bg-[#020617] font-['Inter']">
      
      <header className="bg-[#0f172a]/80 backdrop-blur-md border-b border-slate-800 px-6 py-4 flex justify-between items-center print:hidden sticky top-0 z-40 shadow-lg">
        <div className="flex items-center gap-2 text-emerald-500 font-['Montserrat'] font-bold tracking-wider text-lg">
          <Hexagon size={24} className="fill-emerald-500/20" />
          PONTO<span className="text-white">SEGURO</span>
        </div>
        
        <button 
          onClick={fazerLogout} 
          className="flex items-center gap-2 text-slate-400 hover:text-red-400 transition-colors text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-red-500/10"
        >
          <LogOut size={18} />
          <span className="hidden sm:inline">Encerrar Sessão</span>
        </button>
      </header>

      <main>
        {isAdmin ? <Dashboard /> : <BaterPonto />}
      </main>
      
    </div>
  );
}