// @ts-nocheck
import React, { useRef, useState, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import { supabase } from './supabaseClient';

export default function BaterPonto() {
  // Minhas referências e estados da tela
  const webcamRef = useRef<Webcam>(null);
  const [status, setStatus] = useState('');
  const [carregando, setCarregando] = useState(false);

  // Regras da câmera (virada para o usuário)
  const videoConstraints = {
    width: 300,
    height: 400,
    facingMode: "user"
  };

  // 1. O "Ouvido" da Rede: Fico escutando para ver se a internet do peão volta
  useEffect(() => {
    const escutarRede = () => {
      if (navigator.onLine) {
        console.log('Detectei que a internet voltou! Iniciando sincronização...');
        setStatus('Internet detectada. Sincronizando pontos pendentes...');
        sincronizarPontosOffline();
      }
    };

    // Ligo o sensor na rede do navegador
    window.addEventListener('online', escutarRede);
    
    // Rodo a verificação logo que a tela abre, caso tenha ficado ponto preso de ontem
    if (navigator.onLine) {
      sincronizarPontosOffline();
    }

    // Quando o componente for fechado, eu desligo o sensor para não pesar a memória
    return () => window.removeEventListener('online', escutarRede);
  }, []);

  // 2. Função de Descarregar: Pega do celular e manda pra nuvem
  const sincronizarPontosOffline = async () => {
    // Busco no armazenamento do celular (localStorage) se tem pontos acumulados
    const pontosLocais = localStorage.getItem('pontos_offline');
    if (!pontosLocais) return; // Se não tem, encerro o circuito aqui

    const listaDePontos = JSON.parse(pontosLocais);
    if (listaDePontos.length === 0) return;

    // Pego o ID do usuário que está logado para garantir de quem é o ponto
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setStatus(`Sincronizando ${listaDePontos.length} ponto(s)...`);

    // Preparo o pacote de dados montando as peças que o banco de dados exige
    const pontosParaEnviar = listaDePontos.map((ponto: any) => ({
      funcionario_id: user.id,
      tipo_registro: ponto.tipo_registro,
      data_hora: ponto.data_hora,
      foto_url: ponto.foto_url, // A imagem já vai em formato texto
      localizacao_gps: ponto.localizacao_gps
    }));

    // Despacho o lote inteiro pro Supabase em uma pancada só
    const { error } = await supabase.from('registros_ponto').insert(pontosParaEnviar);

    if (!error) {
      // Deu certo? Limpo o histórico do celular
      localStorage.removeItem('pontos_offline');
      setStatus('Sincronização concluída com sucesso!');
      setTimeout(() => setStatus(''), 3000); // Limpo o aviso depois de 3 segundos
    } else {
      console.error('Erro ao sincronizar:', error);
      setStatus('Erro ao sincronizar pontos com o servidor.');
    }
  };

  // 3. A Mágica de Bater o Ponto (Câmera + GPS)
  const registrar = useCallback(async () => {
    setCarregando(true);
    setStatus('Capturando localização...');

    // 3.1 Capturo a foto no formato JPEG comprimido
    const imageSrc = webcamRef.current?.getScreenshot();
    if (!imageSrc) {
      setStatus('Erro ao acessar a câmera. Verifique as permissões.');
      setCarregando(false);
      return;
    }

    // 3.2 Busco o GPS do aparelho
    navigator.geolocation.getCurrentPosition(
      async (posicao) => {
        const gps = `${posicao.coords.latitude},${posicao.coords.longitude}`;
        await salvarPonto(imageSrc, gps); // Se pegou o GPS, mando pra função de salvar
      },
      async (erro) => {
        console.warn('GPS falhou ou foi negado pelo celular. Salvando sem localização.');
        await salvarPonto(imageSrc, null); // Se negou o GPS, salvo a foto mesmo assim
      },
      { enableHighAccuracy: true, timeout: 5000 } // Exijo alta precisão, mas com limite de 5s
    );
  }, [webcamRef]);

  // 4. O Comutador: Decide se despacha direto pra nuvem ou guarda no bolso
  const salvarPonto = async (fotoLeve: string, localizacao: string | null) => {
    const agora = new Date().toISOString();
    
    // Monto o pacote do ponto
    const registro = {
      tipo_registro: 'entrada',
      data_hora: agora,
      foto_url: fotoLeve,
      localizacao_gps: localizacao
    };

    const isOnline = navigator.onLine;

    // Se tem internet, mando direto pro Supabase
    if (isOnline) {
      setStatus('Enviando para o servidor...');
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const { error } = await supabase.from('registros_ponto').insert({
          funcionario_id: user.id,
          ...registro
        });

       if (error) {
          console.error(error);
          // Meu visor de diagnóstico: jogo o erro real do banco de dados na tela do celular
          setStatus(`Falha no Banco: ${error.message}`);
        } else {
          setStatus('Ponto Registrado com Sucesso!');
        }
      }
    } else {
      // Sem internet? Abro a gaveta do celular e guardo lá
      setStatus('Sem internet! Salvando ponto no aparelho...');
      const pontosSalvos = JSON.parse(localStorage.getItem('pontos_offline') || '[]');
      pontosSalvos.push(registro);
      localStorage.setItem('pontos_offline', JSON.stringify(pontosSalvos));
      setStatus('Ponto guardado. O sistema enviará sozinho quando a rede voltar!');
    }

    setCarregando(false);
    setTimeout(() => setStatus(''), 4000); // Limpo a tela
  };

  // 5. Minha Interface (Front-end)
  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '400px', margin: '0 auto', textAlign: 'center' }}>
      <h2 style={{ color: '#333' }}>Relógio de Ponto</h2>
      <p style={{ color: '#666', fontSize: '14px', marginBottom: '20px' }}>
        Posicione seu rosto e clique no botão para registrar.
      </p>

      {/* Caixote da Câmera */}
      <div style={{ border: '3px solid #ccc', borderRadius: '8px', overflow: 'hidden', marginBottom: '15px', backgroundColor: '#000' }}>
        <Webcam 
          audio={false} 
          ref={webcamRef} 
          screenshotFormat="image/jpeg" 
          videoConstraints={videoConstraints} 
          style={{ width: '100%', maxWidth: '300px', display: 'block', margin: '0 auto' }} 
        />
      </div>

      {/* Botão de Ação */}
      <button 
        onClick={registrar}
        disabled={carregando}
        style={{ 
          padding: '15px', 
          fontSize: '18px', 
          backgroundColor: carregando ? '#ccc' : '#007bff', 
          color: 'white', 
          border: 'none', 
          borderRadius: '8px', 
          cursor: carregando ? 'not-allowed' : 'pointer',
          width: '100%',
          fontWeight: 'bold',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
        }}
      >
        {carregando ? 'Processando...' : 'Bater Ponto'}
      </button>

      {/* Painel de Mensagens */}
      {status && (
        <div style={{ marginTop: '20px', padding: '12px', backgroundColor: '#e9ecef', borderRadius: '6px', fontWeight: 'bold', color: '#333' }}>
          {status}
        </div>
      )}
    </div>
  );
}