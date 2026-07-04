// @ts-nocheck
import React, { useState } from 'react';
import { supabase } from './supabaseClient';
import Cadastro from './Cadastro'; // Importo a tela de cadastro que acabei de criar

export default function Login({ onLoginSucesso }: { onLoginSucesso: () => void }) {
  // Meus estados para gerenciar a tela de login
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  
  // Esse estado funciona como uma chave: se for true, mostro a tela de Cadastro. Se false, mostro o Login.
  const [mostrarCadastro, setMostrarCadastro] = useState(false);

  // Minha função para autenticar o usuário no banco
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setCarregando(true);
    setErro('');

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    });

    if (error) {
      setErro('E-mail ou senha incorretos.');
    } else {
      onLoginSucesso();
    }
    setCarregando(false);
  };

  // Se a chave estiver ativada, eu renderizo a tela de Cadastro em vez do Login
  if (mostrarCadastro) {
    return <Cadastro onVoltar={() => setMostrarCadastro(false)} />;
  }

  // Caso contrário, renderizo a minha tela de Login padrão
  return (
    <div style={{ padding: '20px', maxWidth: '400px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h2 style={{ textAlign: 'center', color: '#333' }}>Login do Funcionário</h2>
      
      <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' }}>
        <input
          type="email"
          placeholder="E-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ padding: '12px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '16px' }}
        />
        <input
          type="password"
          placeholder="Senha"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          required
          style={{ padding: '12px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '16px' }}
        />
        
        <button 
          type="submit" 
          disabled={carregando}
          style={{ 
            padding: '12px', 
            backgroundColor: carregando ? '#ccc' : '#007bff', 
            color: '#fff', 
            border: 'none', 
            borderRadius: '6px', 
            fontSize: '16px', 
            cursor: carregando ? 'not-allowed' : 'pointer',
            fontWeight: 'bold'
          }}
        >
          {carregando ? 'Entrando...' : 'Entrar no Sistema'}
        </button>
      </form>

      {erro && <p style={{ color: 'red', textAlign: 'center', marginTop: '15px' }}>{erro}</p>}

      {/* Aqui fica o botão que altera meu estado e abre a tela de criar conta */}
      <div style={{ marginTop: '20px', textAlign: 'center', borderTop: '1px solid #eee', paddingTop: '15px' }}>
        <p style={{ color: '#666', fontSize: '14px', marginBottom: '10px' }}>Ainda não tem acesso?</p>
        <button 
          onClick={() => setMostrarCadastro(true)}
          style={{ background: 'none', border: '1px solid #28a745', color: '#28a745', padding: '8px 15px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          Criar Nova Conta
        </button>
      </div>
    </div>
  );
}