// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { Mail, Lock, LogIn, UserPlus, AlertCircle, Calendar, KeyRound, CreditCard, Briefcase } from 'lucide-react';

export default function Login() {
  const [modo, setModo] = useState<'login' | 'cadastro' | 'recuperacao'>('login');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [nome, setNome] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  
  // === NOVOS ESTADOS PARA O CADASTRO ===
  const [cpf, setCpf] = useState('');
  const [funcao, setFuncao] = useState('');
  
  const [carregando, setCarregando] = useState(false);
  const [mensagem, setMensagem] = useState({ texto: '', tipo: '' });

  useEffect(() => {
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=Montserrat:wght@600;700&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }, []);

  // === MÁSCARA INTELIGENTE DO CPF ===
  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, ''); 
    if (value.length > 11) value = value.slice(0, 11); 
    
    let formatted = value;
    if (value.length > 9) formatted = value.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
    else if (value.length > 6) formatted = value.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
    else if (value.length > 3) formatted = value.replace(/(\d{3})(\d{1,3})/, '$1.$2');
    
    setCpf(formatted); 
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setMensagem({ texto: '', tipo: '' });

    const regexEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!regexEmail.test(email)) {
      setMensagem({ texto: 'Por favor, digite um formato de e-mail válido (ex: seu.nome@gmail.com).', tipo: 'erro' });
      return; 
    }

    // === VALIDAÇÃO DE CPF ANTES DE CADASTRAR ===
    if (modo === 'cadastro') {
      const cpfLimpo = cpf.replace(/\D/g, '');
      if (cpfLimpo.length !== 11) {
        setMensagem({ texto: 'Por favor, digite um CPF válido com 11 números.', tipo: 'erro' });
        return;
      }
    }

    setCarregando(true);

    try {
      if (modo === 'recuperacao') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/`,
        });
        if (error) throw error;
        setMensagem({ texto: 'E-mail de recuperação enviado! Verifique sua caixa de entrada.', tipo: 'sucesso' });
        setTimeout(() => setModo('login'), 4000);

      } else if (modo === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
        if (error) throw new Error('Credenciais inválidas. Verifique seu e-mail e senha.');

      } else {
        // === FLUXO DE CADASTRO ATUALIZADO ===
        const { data, error } = await supabase.auth.signUp({ 
          email, 
          password: senha,
          options: {
            data: {
              nome: nome || email.split('@')[0],
              cpf: cpf,         // Enviamo o CPF formatado
              funcao: funcao    // Enviamos a Função
            }
          }
        });
        if (error) throw error;
        
        if (data.user) {
          // Mantendo a sua inserção para data_nascimento, mas o nome, cpf e funcao
          // já serão inseridos pelo Trigger do banco!
          await supabase.from('perfis').update({ 
            data_nascimento: dataNascimento || null
          }).eq('id', data.user.id);
          
          setMensagem({ texto: 'Conta criada! Verifique sua caixa de entrada para confirmar o e-mail antes de logar.', tipo: 'sucesso' });
          setModo('login');
        }
      }
    } catch (err: any) {
      setMensagem({ texto: err.message, tipo: 'erro' });
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] relative flex items-center justify-center p-6 font-['Inter'] overflow-hidden">
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-emerald-600/10 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 shadow-xl mb-6">
            {modo === 'recuperacao' ? <KeyRound className="text-blue-500" size={32} /> : <Lock className="text-emerald-500" size={32} />}
          </div>
          <h1 className="font-['Montserrat'] text-3xl font-bold text-white tracking-tight mb-2">
            {modo === 'login' ? 'Acesso ao Sistema' : modo === 'cadastro' ? 'Nova Conta' : 'Recuperar Senha'}
          </h1>
          <p className="text-slate-400 text-sm">
            {modo === 'login' ? 'Insira suas credenciais para bater o ponto.' : modo === 'cadastro' ? 'Cadastre-se para habilitar seu acesso.' : 'Enviaremos um link para redefinir sua senha.'}
          </p>
        </div>

        <div className="bg-[#0f172a]/60 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-2xl">
          
          {mensagem.texto && (
            <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 text-sm font-medium border ${mensagem.tipo === 'sucesso' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
              <AlertCircle size={18} className="shrink-0" />
              <p className="leading-snug">{mensagem.texto}</p>
            </div>
          )}

          <form onSubmit={handleAuth} className="flex flex-col gap-5">
            
            {modo === 'cadastro' && (
              <>
                <div>
                  <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2 ml-1">Nome Completo</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500"><UserPlus size={18} /></div>
                    <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} required className="w-full bg-slate-900/50 border border-slate-800 text-slate-100 text-sm rounded-xl py-3.5 pl-11 pr-4 focus:outline-none focus:border-slate-600 focus:ring-1 focus:ring-slate-600 transition-all placeholder-slate-600" placeholder="Ex: Carlos Silva" />
                  </div>
                </div>

                {/* === NOVO CAMPO: CPF === */}
                <div>
                  <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2 ml-1">CPF</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500"><CreditCard size={18} /></div>
                    <input type="text" value={cpf} onChange={handleCpfChange} required className="w-full bg-slate-900/50 border border-slate-800 text-slate-100 text-sm rounded-xl py-3.5 pl-11 pr-4 focus:outline-none focus:border-slate-600 focus:ring-1 focus:ring-slate-600 transition-all placeholder-slate-600 font-mono" placeholder="000.000.000-00" />
                  </div>
                </div>

                {/* === NOVO CAMPO: FUNÇÃO === */}
                <div>
                  <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2 ml-1">Função / Cargo</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500"><Briefcase size={18} /></div>
                    <input type="text" value={funcao} onChange={(e) => setFuncao(e.target.value)} required className="w-full bg-slate-900/50 border border-slate-800 text-slate-100 text-sm rounded-xl py-3.5 pl-11 pr-4 focus:outline-none focus:border-slate-600 focus:ring-1 focus:ring-slate-600 transition-all placeholder-slate-600" placeholder="Ex: Pedreiro, Eletricista..." />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2 ml-1">Data de Nascimento</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500"><Calendar size={18} /></div>
                    <input type="date" value={dataNascimento} onChange={(e) => setDataNascimento(e.target.value)} required className="w-full bg-slate-900 border-2 border-slate-600 text-white text-sm font-semibold rounded-xl py-3.5 pl-11 pr-4 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all scheme-dark [color-scheme:dark]" />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2 ml-1">E-mail Corporativo</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500"><Mail size={18} /></div>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full bg-slate-900/50 border border-slate-800 text-slate-100 text-sm rounded-xl py-3.5 pl-11 pr-4 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all placeholder-slate-600" placeholder="seu.email@empresa.com" />
              </div>
            </div>

            {modo !== 'recuperacao' && (
              <div>
                <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2 ml-1">Senha de Acesso</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500"><Lock size={18} /></div>
                  <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required minLength={6} className="w-full bg-slate-900/50 border border-slate-800 text-slate-100 text-sm rounded-xl py-3.5 pl-11 pr-4 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all placeholder-slate-600" placeholder="••••••••" />
                </div>
              </div>
            )}

            {modo === 'login' && (
              <div className="flex justify-end">
                <button type="button" onClick={() => { setModo('recuperacao'); setMensagem({ texto: '', tipo: '' }); }} className="text-xs font-medium text-emerald-500 hover:text-emerald-400 transition-colors">
                  Esqueceu a senha?
                </button>
              </div>
            )}

            <button type="submit" disabled={carregando} className="mt-2 w-full flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-['Montserrat'] font-semibold rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(37,99,235,0.2)]">
              {carregando ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : modo === 'login' ? <><LogIn size={20} /> Entrar no Sistema</> : modo === 'cadastro' ? <><UserPlus size={20} /> Finalizar Cadastro</> : <><KeyRound size={20} /> Enviar Link de Recuperação</>}
            </button>
          </form>

          <div className="mt-8 flex flex-col gap-3">
            {modo !== 'login' && (
              <button onClick={() => { setModo('login'); setMensagem({ texto: '', tipo: '' }); }} className="w-full py-3.5 bg-transparent border border-slate-700 hover:bg-slate-800 text-slate-300 font-['Montserrat'] font-semibold rounded-xl transition-all duration-200">
                Voltar para o Login
              </button>
            )}
            {modo === 'login' && (
              <button onClick={() => { setModo('cadastro'); setMensagem({ texto: '', tipo: '' }); }} className="w-full py-3.5 bg-transparent border border-slate-700 hover:bg-slate-800 text-slate-300 font-['Montserrat'] font-semibold rounded-xl transition-all duration-200">
                Criar Nova Conta
              </button>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}