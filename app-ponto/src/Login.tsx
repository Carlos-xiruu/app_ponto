// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { Mail, Lock, LogIn, UserPlus, AlertCircle } from 'lucide-react';

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [nome, setNome] = useState(''); // Usado apenas no cadastro
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');

  // Carrega as fontes Premium
  useEffect(() => {
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=Montserrat:wght@600;700&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setCarregando(true);
    setErro('');

    if (isLogin) {
      // Lógica de Login
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: senha,
      });
      if (error) setErro('Credenciais inválidas. Tente novamente.');
    } else {
      // Lógica de Criação de Conta
      const { data, error } = await supabase.auth.signUp({
        email,
        password: senha,
      });
      
      if (error) {
        setErro(error.message);
      } else if (data.user) {
        // Salva o nome do peão na tabela perfis logo após criar a conta
        await supabase.from('perfis').insert([
          { id: data.user.id, nome: nome || email.split('@')[0] }
        ]);
        // Volta para a tela de login após criar
        setIsLogin(true);
        setErro('Conta criada com sucesso! Faça o login.');
      }
    }
    setCarregando(false);
  };

  return (
    <div className="min-h-screen bg-[#020617] relative flex items-center justify-center p-6 font-['Inter'] overflow-hidden">
      
      {/* Efeitos Radiais de Fundo Corporativo */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-emerald-600/10 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="w-full max-w-md relative z-10">
        
        {/* Cabeçalho do Login */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 shadow-xl mb-6">
            <Lock className="text-emerald-500" size={32} />
          </div>
          <h1 className="font-['Montserrat'] text-3xl font-bold text-white tracking-tight mb-2">
            {isLogin ? 'Acesso ao Sistema' : 'Nova Conta'}
          </h1>
          <p className="text-slate-400 text-sm">
            {isLogin ? 'Insira suas credenciais para bater o ponto.' : 'Cadastre-se para habilitar seu acesso.'}
          </p>
        </div>

        {/* Card Glassmorphism */}
        <div className="bg-[#0f172a]/60 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-2xl">
          
          {erro && (
            <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 text-sm font-medium border ${erro.includes('sucesso') ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
              <AlertCircle size={18} className="shrink-0" />
              <p>{erro}</p>
            </div>
          )}

          <form onSubmit={handleAuth} className="flex flex-col gap-5">
            
            {!isLogin && (
              <div>
                <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2 ml-1">Nome Completo</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500">
                    <UserPlus size={18} />
                  </div>
                  <input 
                    type="text" 
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    required={!isLogin}
                    className="w-full bg-slate-900/50 border border-slate-800 text-slate-100 text-sm rounded-xl py-3.5 pl-11 pr-4 focus:outline-none focus:border-slate-600 focus:ring-1 focus:ring-slate-600 transition-all placeholder-slate-600"
                    placeholder="Ex: Carlos Silva"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2 ml-1">E-mail Corporativo</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500">
                  <Mail size={18} />
                </div>
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-slate-900/50 border border-slate-800 text-slate-100 text-sm rounded-xl py-3.5 pl-11 pr-4 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all placeholder-slate-600"
                  placeholder="seu.email@empresa.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2 ml-1">Senha de Acesso</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500">
                  <Lock size={18} />
                </div>
                <input 
                  type="password" 
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  required
                  className="w-full bg-slate-900/50 border border-slate-800 text-slate-100 text-sm rounded-xl py-3.5 pl-11 pr-4 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all placeholder-slate-600"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button 
              type="submit"
              disabled={carregando}
              className="mt-2 w-full flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-['Montserrat'] font-semibold rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(37,99,235,0.2)] hover:shadow-[0_0_30px_rgba(37,99,235,0.4)]"
            >
              {carregando ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              ) : isLogin ? (
                <><LogIn size={20} /> Entrar no Sistema</>
              ) : (
                <><UserPlus size={20} /> Finalizar Cadastro</>
              )}
            </button>
          </form>

          {/* Divisor */}
          <div className="mt-8 flex items-center justify-center gap-4">
            <div className="h-px bg-slate-800 flex-1"></div>
            <span className="text-slate-500 text-xs font-medium">{isLogin ? 'Ainda não tem acesso?' : 'Já possui uma conta?'}</span>
            <div className="h-px bg-slate-800 flex-1"></div>
          </div>

          {/* Botão de Alternância */}
          <button 
            onClick={() => { setIsLogin(!isLogin); setErro(''); }}
            className="mt-6 w-full py-3.5 bg-transparent border border-slate-700 hover:bg-slate-800 text-slate-300 font-['Montserrat'] font-semibold rounded-xl transition-all duration-200"
          >
            {isLogin ? 'Criar Nova Conta' : 'Voltar para o Login'}
          </button>

        </div>
      </div>
    </div>
  );
}