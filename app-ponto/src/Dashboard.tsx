// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

export default function Dashboard() {
  const [registros, setRegistros] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    buscarPontos();
  }, []);

  const buscarPontos = async () => {
    // Busca os registros de ponto e cruza com a tabela de perfis para pegar o nome
    const { data, error } = await supabase
      .from('registros_ponto')
      .select(`
        id,
        tipo_registro,
        data_hora,
        foto_url,
        perfis ( nome )
      `)
      .order('data_hora', { ascending: false }); // Do mais recente pro mais antigo

    if (error) {
      console.error('Erro ao buscar dados:', error);
    } else {
      setRegistros(data || []);
    }
    setCarregando(false);
  };

  // Função para formatar a data e hora para o padrão do Brasil
  const formatarData = (dataIso: string) => {
    const data = new Date(dataIso);
    return data.toLocaleString('pt-BR');
  };

  if (carregando) return <div style={{ padding: '20px', textAlign: 'center' }}>Carregando painel de horas...</div>;

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '800px', margin: '0 auto' }}>
      <h2 style={{ borderBottom: '2px solid #ccc', paddingBottom: '10px' }}>Painel Administrativo - Relógio de Ponto</h2>
      
      <div style={{ backgroundColor: '#f8f9fa', borderRadius: '8px', padding: '15px', overflowX: 'auto' }}>
        <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#e9ecef' }}>
              <th style={{ padding: '12px', borderBottom: '2px solid #dee2e6' }}>Funcionário</th>
              <th style={{ padding: '12px', borderBottom: '2px solid #dee2e6' }}>Data e Hora</th>
              <th style={{ padding: '12px', borderBottom: '2px solid #dee2e6' }}>Tipo</th>
              <th style={{ padding: '12px', borderBottom: '2px solid #dee2e6' }}>Comprovante (Foto)</th>
            </tr>
          </thead>
          <tbody>
            {registros.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: '15px', textAlign: 'center' }}>Nenhum ponto registrado ainda.</td>
              </tr>
            ) : (
              registros.map((ponto) => (
                <tr key={ponto.id} style={{ borderBottom: '1px solid #dee2e6' }}>
                  <td style={{ padding: '12px' }}>{ponto.perfis?.nome || 'Usuário Desconhecido'}</td>
                  <td style={{ padding: '12px' }}>{formatarData(ponto.data_hora)}</td>
                  <td style={{ padding: '12px', textTransform: 'capitalize' }}>{ponto.tipo_registro}</td>
                  <td style={{ padding: '12px' }}>
                    {ponto.foto_url ? (
                      <img 
                        src={ponto.foto_url} 
                        alt="Selfie" 
                        style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #ccc' }} 
                      />
                    ) : (
                      <span style={{ fontSize: '12px', color: '#666' }}>Sem foto</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}