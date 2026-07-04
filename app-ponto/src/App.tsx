// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import Login from './Login';
import BaterPonto from './BaterPonto';
import Dashboard from './Dashboard'; // A tela de gestor que criei para gerenciar as horas

export default function App() {
  const [sessao, setSessao] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    // 1. Assim que o app carrega, eu verifico se já tem alguém com login salvo no navegador
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSessao(session);
      if (session) {
        verificarNivelDeAcesso(session.user.id);
      } else {
        setCarregando(false);
      }
    });

    // 2. Aqui eu deixo um observador rodando em segundo plano para detectar se o usuário logou ou deslogou
    supabase.auth.onAuthStateChange((_event, session) => {
      setSessao(session);
      if (session) {
        verificarNivelDeAcesso(session.user.id);
      } else {
        setIsAdmin(false); // Zero o acesso de gestor se a pessoa sair da conta
        setCarregando(false);
      }
    });
  }, []);

  // 3. Minha lógica de "Crachá": Faço uma consulta rápida no banco para confirmar o nível de acesso do usuário
  const verificarNivelDeAcesso = async (userId: string) => {
    const { data, error } = await supabase
      .from('perfis')
      .select('is_admin')
      .eq('id', userId)
      .single();

    if (data && data.is_admin === true) {
      setIsAdmin(true); // Confirmo que é o administrador acessando
    } else {
      setIsAdmin(false); // É um funcionário padrão na obra
    }
    setCarregando(false);
  };

  if (carregando) {
    return <div style={{ padding: '50px', textAlign: 'center', fontFamily: 'sans-serif' }}>Carregando sistema...</div>;
  }

  // Se não encontrei nenhuma sessão ativa, eu travo o acesso e redireciono para a tela de Login
  if (!sessao) {
    return <Login onLoginSucesso={() => console.log('Login feito com sucesso!')} />;
  }

  // Passou pela barreira do Login? Então eu renderizo a interface de acordo com a permissão
  return (
    <div>
      {/* Minha barra superior de navegação */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '10px 20px', backgroundColor: '#e9ecef', borderBottom: '1px solid #ccc' }}>
        <button 
          onClick={() => supabase.auth.signOut()} 
          style={{ background: 'transparent', border: 'none', color: '#dc3545', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px' }}
        >
          Sair da conta
        </button>
      </div>

      {/* Meu comutador de telas: Admin vê o painel de horas, funcionário é direcionado pra câmera */}
      {isAdmin ? <Dashboard /> : <BaterPonto />}
    </div>
  );
}