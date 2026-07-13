// @ts-nocheck
import React, { useState } from 'react';
import { supabase } from './supabaseClient';
import { User, Mail, Lock, Loader2, ArrowLeft, Hexagon } from 'lucide-react';

export default function Cadastro({ onVoltar }: { onVoltar: () => void }) {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [mensagem, setMensagem] = useState({ texto: '', tipo: '' }); // tipo: 'sucesso' ou 'erro'

  const handleCadastro = async (e: React.FormEvent) => {
    e.preventDefault();
    setCarregando(true);
    setMensagem({ texto: 'Criando sua conta...', tipo: 'neutro' });

    // Nós injetei o 'nome' dentro do pacote de metadados.
    // Assim, quando a requisição bater no banco, o Trigger (Robô)
    // vai encontrar esse nome e inseri-lo na tabela 'perfis' automaticamente.
    const { error } = await supabase.auth.signUp({
      email,
      password: senha,
      options: {
        data: {
          nome: nome // Envia o nome diretamente para os metadados do Supabase
        }
      }
    });

    if (error) {
      setMensagem({ texto: 'Erro: ' + error.message, tipo: 'erro' });
      setCarregando(false);
      return;
    }

    // Se passou, o e-mail de confirmação foi disparado
    setMensagem({ texto: 'Conta criada! Verifique seu e-mail para confirmar.', tipo: 'sucesso' });
    setCarregando(false);
  };

  return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4 sm:p-6 font-['Inter'] relative overflow-hidden">
      
      {/* Efeitos de Fundo Modernos */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-emerald-600/20 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] bg-blue-600/10 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="w-full max-w-md bg-[#0f172a]/80 backdrop-blur-xl border border-slate-800 rounded-[2rem] p-8 shadow-2xl relative z-10 flex flex-col items-center">
        
        {/* Cabeçalho */}
        <div className="flex items-center gap-2 text-emerald-500 font-['Montserrat'] font-bold tracking-wider text-xl mb-2">
          <Hexagon size={28} className="fill-emerald-500/20" />
          PONTO<span className="text-white">SEGURO</span>
        </div>
        <h2 className="text-xl font-bold text-white font-['Montserrat'] mb-1 text-center">Criar Conta</h2>
        <p className="text-sm text-slate-400 text-center mb-8">Cadastre-se para iniciar seus registros</p>

        <form onSubmit={handleCadastro} className="w-full flex flex-col gap-4">
          
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-emerald-500 transition-colors">
              <User size={18} />
            </div>
            <input
              type="text"
              placeholder="Seu Nome Completo"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
              className="w-full bg-slate-900 border border-slate-700 rounded-2xl py-3.5 pl-11 pr-4 text-sm text-white focus:border-emerald-500 outline-none transition-all placeholder:text-slate-500"
            />
          </div>

          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-emerald-500 transition-colors">
              <Mail size={18} />
            </div>
            <input
              type="email"
              placeholder="Seu E-mail Corporativo"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-slate-900 border border-slate-700 rounded-2xl py-3.5 pl-11 pr-4 text-sm text-white focus:border-emerald-500 outline-none transition-all placeholder:text-slate-500"
            />
          </div>

          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-emerald-500 transition-colors">
              <Lock size={18} />
            </div>
            <input
              type="password"
              placeholder="Crie uma Senha (mínimo 6)"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
              minLength={6}
              className="w-full bg-slate-900 border border-slate-700 rounded-2xl py-3.5 pl-11 pr-4 text-sm text-white focus:border-emerald-500 outline-none transition-all placeholder:text-slate-500"
            />
          </div>

          <button 
            type="submit" 
            disabled={carregando}
            className="mt-2 w-full flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold rounded-2xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {carregando ? <Loader2 className="animate-spin" size={20} /> : 'Finalizar Cadastro'}
          </button>
        </form>

        {/* Mensagem de Feedback */}
        {mensagem.texto && (
          <div className={`mt-6 w-full p-4 rounded-xl text-sm font-medium text-center border ${
            mensagem.tipo === 'sucesso' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
            mensagem.tipo === 'erro' ? 'bg-red-500/10 border-red-500/30 text-red-400' :
            'bg-slate-800/50 border-slate-700 text-slate-300'
          }`}>
            {mensagem.texto}
          </div>
        )}

        {/* Botão Voltar */}
        <button 
          onClick={onVoltar}
          className="mt-8 flex items-center gap-2 text-slate-400 hover:text-emerald-400 transition-colors text-sm font-semibold group"
        >
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
          Já tenho uma conta
        </button>

      </div>
    </div>
  );
}