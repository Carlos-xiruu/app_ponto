// @ts-nocheck
import React, { useRef, useState, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import { supabase } from './supabaseClient';
import { LogIn, LogOut, Camera, WifiOff, CheckCircle2, AlertCircle } from 'lucide-react';

export default function BaterPonto() {
  const webcamRef = useRef<Webcam>(null);
  const [status, setStatus] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [horaAtual, setHoraAtual] = useState(new Date());

  const videoConstraints = { width: 300, height: 400, facingMode: "user" };

  // Motor do Relógio em Tempo Real e Fontes
  useEffect(() => {
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Montserrat:wght@600;700&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);

    const timer = setInterval(() => setHoraAtual(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Listener de Conexão
  useEffect(() => {
    const escutarRede = () => {
      if (navigator.onLine) {
        setStatus('Internet detectada. Sincronizando dados...');
        sincronizarPontosOffline();
      }
    };
    window.addEventListener('online', escutarRede);
    if (navigator.onLine) sincronizarPontosOffline();
    return () => window.removeEventListener('online', escutarRede);
  }, []);

  const sincronizarPontosOffline = async () => {
    const pontosLocais = localStorage.getItem('pontos_offline');
    if (!pontosLocais) return;
    const listaDePontos = JSON.parse(pontosLocais);
    if (listaDePontos.length === 0) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const pontosParaEnviar = listaDePontos.map((ponto: any) => ({
      funcionario_id: user.id,
      tipo_registro: ponto.tipo_registro,
      data_hora: ponto.data_hora,
      foto_url: ponto.foto_url,
      localizacao_gps: ponto.localizacao_gps
    }));

    const { error } = await supabase.from('registros_ponto').insert(pontosParaEnviar);
    if (!error) {
      localStorage.removeItem('pontos_offline');
      setStatus('Sincronização concluída!');
      setTimeout(() => setStatus(''), 3000);
    }
  };

  const registrar = useCallback(async (tipoRegistro: 'entrada' | 'saida') => {
    setCarregando(true);
    setStatus('Capturando dados...');

    const imageSrc = webcamRef.current?.getScreenshot();
    if (!imageSrc) {
      setStatus('Erro de câmera. Verifique permissões.');
      setCarregando(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (posicao) => {
        const gps = `${posicao.coords.latitude},${posicao.coords.longitude}`;
        await salvarPonto(imageSrc, gps, tipoRegistro);
      },
      async () => {
        await salvarPonto(imageSrc, null, tipoRegistro);
      },
      { enableHighAccuracy: true, timeout: 5000 }
    );
  }, [webcamRef]);

  const salvarPonto = async (fotoLeve: string, localizacao: string | null, tipoRegistro: string) => {
    const registro = {
      tipo_registro: tipoRegistro,
      data_hora: new Date().toISOString(),
      foto_url: fotoLeve,
      localizacao_gps: localizacao
    };

    if (navigator.onLine) {
      setStatus('Processando...');
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error } = await supabase.from('registros_ponto').insert({
          funcionario_id: user.id,
          ...registro
        });
        if (error) setStatus(`Falha: ${error.message}`);
        else setStatus('Sucesso!');
      }
    } else {
      const pontosSalvos = JSON.parse(localStorage.getItem('pontos_offline') || '[]');
      pontosSalvos.push(registro);
      localStorage.setItem('pontos_offline', JSON.stringify(pontosSalvos));
      setStatus('Salvo no aparelho (Offline).');
    }

    setCarregando(false);
    setTimeout(() => setStatus(''), 4000);
  };

  return (
    <div className="min-h-screen bg-[#020617] relative overflow-hidden font-['Inter'] text-slate-100 flex flex-col items-center py-10 px-6">
      
      {/* Efeitos de Fundo Corporativo */}
      <div className="absolute top-[-10%] left-[-20%] w-96 h-96 bg-blue-600/20 rounded-full blur-[128px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-20%] w-96 h-96 bg-emerald-600/10 rounded-full blur-[128px] pointer-events-none"></div>

      <div className="w-full max-w-sm relative z-10 flex flex-col items-center">
        
        {/* O Relógio de Ponto (Destaque Minimalista) */}
        <div className="mb-10 text-center">
          <h2 className="font-['Montserrat'] text-slate-400 text-sm font-semibold tracking-widest uppercase mb-2">
            Relógio de Ponto
          </h2>
          <div className="font-['Montserrat'] text-5xl font-bold tracking-tight text-white drop-shadow-lg">
            {horaAtual.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            <span className="text-2xl text-slate-500 ml-1">
              {horaAtual.toLocaleTimeString('pt-BR', { second: '2-digit' })}
            </span>
          </div>
          <div className="text-slate-400 mt-1 text-sm">
            {horaAtual.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
        </div>

        {/* Câmera - Bloco Flutuante Glassmorphism */}
        <div className="w-full bg-[#0f172a]/60 backdrop-blur-xl border border-slate-800 rounded-3xl p-3 shadow-2xl mb-8 ring-1 ring-emerald-500/50">
          <div className="relative rounded-2xl overflow-hidden bg-black aspect-[3/4]">
            <Webcam 
              audio={false} 
              ref={webcamRef} 
              screenshotFormat="image/jpeg" 
              videoConstraints={videoConstraints} 
              className="w-full h-full object-cover"
            />
            {/* Status da Câmera */}
            <div className="absolute bottom-4 left-0 right-0 flex justify-center">
              <div className="flex items-center gap-2 bg-black/50 backdrop-blur-md text-slate-200 px-3 py-1.5 rounded-full text-xs font-medium border border-white/10">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Sensor Ativo
              </div>
            </div>
          </div>
        </div>

        {/* Botões Largos e Premium */}
        <div className="w-full flex flex-col gap-4">
          <button 
            onClick={() => registrar('entrada')}
            disabled={carregando}
            className="w-full flex items-center justify-center gap-3 py-4 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-['Montserrat'] font-semibold rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)]"
          >
            <LogIn size={22} /> 
            <span className="tracking-wide">Registrar Entrada</span>
          </button>

          <button 
            onClick={() => registrar('saida')}
            disabled={carregando}
            className="w-full flex items-center justify-center gap-3 py-4 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-['Montserrat'] font-semibold rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <LogOut size={22} /> 
            <span className="tracking-wide">Registrar Saída</span>
          </button>
        </div>

        {/* Painel de Status Elegante */}
        {status && (
          <div className={`mt-6 w-full flex items-center gap-3 p-4 rounded-xl text-sm font-medium border backdrop-blur-md ${
            status === 'Sucesso!' 
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
              : status.includes('Offline') || status.includes('Internet')
              ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
              : 'bg-slate-800/50 border-slate-700 text-slate-300'
          }`}>
            {status === 'Sucesso!' ? <CheckCircle2 size={18} /> : status.includes('Offline') ? <WifiOff size={18} /> : <AlertCircle size={18} />}
            {status}
          </div>
        )}
      </div>
    </div>
  );
}