// @ts-nocheck
import React, { useState } from 'react';
import { supabase } from './supabaseClient';

export default function Cadastro({ onVoltar }: { onVoltar: () => void }) {
  // Aqui eu crio os estados para guardar o que o usuário vai digitar
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [mensagem, setMensagem] = useState('');

  // Minha função principal para registrar o novo funcionário
  const handleCadastro = async (e: React.FormEvent) => {
    e.preventDefault();
    setCarregando(true);
    setMensagem('Criando sua conta...');

    // 1. Primeiro eu peço para o Supabase criar a credencial de acesso (E-mail e Senha)
    const { data, error } = await supabase.auth.signUp({
      email,
      password: senha,
    });

    if (error) {
      setMensagem('Erro: ' + error.message);
      setCarregando(false);
      return;
    }

    // 2. Se a credencial foi criada com sucesso, eu pego o ID desse novo usuário...
    if (data.user) {
      // ... e salvo o nome dele na minha tabela de perfis, já definindo que ele NÃO é admin
      const { error: profileError } = await supabase.from('perfis').insert({
        id: data.user.id,
        nome: nome,
        is_admin: false,
      });

      if (profileError) {
        console.error('Erro ao salvar perfil:', profileError);
        setMensagem('Conta criada, mas houve um erro ao salvar o nome.');
      } else {
        setMensagem('Conta criada com sucesso! Você já pode fazer login.');
        // Dou um tempinho de 2 segundos para ele ler a mensagem e volto pra tela de login
        setTimeout(() => {
          onVoltar();
        }, 2000);
      }
    }

    setCarregando(false);
  };

  // Renderizo a minha interface de formulário
  return (
    <div style={{ padding: '20px', maxWidth: '400px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h2 style={{ textAlign: 'center', color: '#333' }}>Criar Nova Conta</h2>
      <p style={{ textAlign: 'center', color: '#666', fontSize: '14px' }}>Cadastre-se para bater seu ponto</p>

      <form onSubmit={handleCadastro} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' }}>
        <input
          type="text"
          placeholder="Seu Nome Completo"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          required
          style={{ padding: '12px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '16px' }}
        />
        <input
          type="email"
          placeholder="Seu E-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ padding: '12px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '16px' }}
        />
        <input
          type="password"
          placeholder="Crie uma Senha (mínimo 6 caracteres)"
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
            backgroundColor: carregando ? '#ccc' : '#28a745', 
            color: '#fff', 
            border: 'none', 
            borderRadius: '6px', 
            fontSize: '16px', 
            cursor: carregando ? 'not-allowed' : 'pointer',
            fontWeight: 'bold'
          }}
        >
          {carregando ? 'Cadastrando...' : 'Cadastrar'}
        </button>
      </form>

      {mensagem && (
        <div style={{ marginTop: '15px', padding: '10px', backgroundColor: '#e9ecef', borderRadius: '6px', textAlign: 'center' }}>
          {mensagem}
        </div>
      )}

      {/* Botão para voltar para a tela de Login caso o usuário desista */}
      <div style={{ marginTop: '20px', textAlign: 'center' }}>
        <button 
          onClick={onVoltar}
          style={{ background: 'none', border: 'none', color: '#007bff', cursor: 'pointer', textDecoration: 'underline' }}
        >
          Já tem uma conta? Faça login aqui
        </button>
      </div>
    </div>
  );
}