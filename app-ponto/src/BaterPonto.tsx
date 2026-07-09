// @ts-nocheck
import React, { useRef, useState, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import { supabase } from './supabaseClient';
import { LogIn, LogOut, Camera, CheckCircle2, AlertCircle, MoreVertical, User, Briefcase, CalendarClock, X, Save, Upload, Loader2, Ban, Building2, ChevronDown } from 'lucide-react';

export default function BaterPonto() {
  const webcamRef = useRef<Webcam>(null);
  const [status, setStatus] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [horaAtual, setHoraAtual] = useState(new Date());

  const [perfil, setPerfil] = useState({ id: '', nome: '', funcao: '', avatar_url: '' });
  
  const [obrasList, setObrasList] = useState([]);
  const [obraSelecionadaId, setObraSelecionadaId] = useState('');
  const [dropdownAberto, setDropdownAberto] = useState(false);
  
  const [jornadaAtual, setJornadaAtual] = useState({ status: 'livre', pontoEntradaGps: null, bloqueadoPorHoje: false, obraNomeAtual: '' });
  const [menuAberto, setMenuAberto] = useState(false);
  const [fazendoUpload, setFazendoUpload] = useState(false);

  const videoConstraints = { width: 300, height: 400, facingMode: "user" };

  // Meu motor inteligente para fazer as mensagens sumirem sozinhas
  const mostrarAviso = (mensagem) => {
    setStatus(mensagem);
    setTimeout(() => {
      setStatus('');
    }, 6000); // Some após 6 segundos
  };

  useEffect(() => {
    const timer = setInterval(() => setHoraAtual(new Date()), 1000);
    carregarDadosDoFuncionario();
    return () => clearInterval(timer);
  }, []);

  const carregarDadosDoFuncionario = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: dadosPerfil } = await supabase.from('perfis').select('*').eq('id', user.id).single();
    if (dadosPerfil) { setPerfil(dadosPerfil); }

    const { data: obrasData } = await supabase.from('obras').select('*').order('nome');
    if (obrasData) setObrasList(obrasData);

    const hojeIso = new Date().toISOString().split('T')[0];
    const { data: registrosHoje } = await supabase
      .from('registros_ponto')
      .select('tipo_registro, data_hora, localizacao_gps, obra_nome')
      .eq('funcionario_id', user.id)
      .gte('data_hora', `${hojeIso}T00:00:00Z`)
      .order('data_hora', { ascending: true });

    if (registrosHoje && registrosHoje.length > 0) {
      const temEntrada = registrosHoje.find(r => r.tipo_registro === 'entrada');
      const temSaida = registrosHoje.find(r => r.tipo_registro === 'saida');

      if (temEntrada && temSaida) {
        setJornadaAtual({ status: 'livre', bloqueadoPorHoje: true });
      } else if (temEntrada && !temSaida) {
        setJornadaAtual({ 
          status: 'trabalhando', 
          pontoEntradaGps: temEntrada.localizacao_gps, 
          bloqueadoPorHoje: false,
          obraNomeAtual: temEntrada.obra_nome 
        });
        
        if (obrasData && temEntrada.obra_nome) {
          const obraMatch = obrasData.find(o => o.nome === temEntrada.obra_nome);
          if (obraMatch) setObraSelecionadaId(obraMatch.id);
        }
      }
    } else {
      setJornadaAtual({ status: 'livre', bloqueadoPorHoje: false, obraNomeAtual: '' });
    }
  };

  const calcularDistanciaEmMetros = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; 
    const rad = Math.PI / 180;
    const phi1 = lat1 * rad;
    const phi2 = lat2 * rad;
    const deltaPhi = (lat2 - lat1) * rad;
    const deltaLambda = (lon2 - lon1) * rad;

    const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) + Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; 
  };

  const registrar = useCallback(async (tipoRegistro: 'entrada' | 'saida') => {
    if (jornadaAtual.bloqueadoPorHoje) {
      mostrarAviso('Jornada concluída! Novo registro liberado apenas amanhã.');
      return;
    }

    if (!obraSelecionadaId) {
      mostrarAviso('Erro: Selecione a Obra onde você está agora.');
      return;
    }

    setCarregando(true);
    setStatus('Autenticando GPS com a base da Obra...'); // Esse não usa timeout pois será sobrescrito

    const imageSrc = webcamRef.current?.getScreenshot();
    if (!imageSrc) {
      mostrarAviso('Erro: Câmera não detectada.');
      setCarregando(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (posicao) => { 
        const gpsAtual = `${posicao.coords.latitude},${posicao.coords.longitude}`;
        const obraSelecionada = obrasList.find(o => o.id === obraSelecionadaId);
        
        if (obraSelecionada && obraSelecionada.localizacao_gps) {
          const [obraLat, obraLon] = obraSelecionada.localizacao_gps.split(',').map(Number);
          const distanciaDaObra = calcularDistanciaEmMetros(posicao.coords.latitude, posicao.coords.longitude, obraLat, obraLon);
          
          if (distanciaDaObra > 50) {
            mostrarAviso(`Acesso Negado: Você está a ${Math.floor(distanciaDaObra)}m de distância da obra. Aproxime-se do local.`);
            setCarregando(false);
            return;
          }
        }

        if (tipoRegistro === 'saida' && jornadaAtual.pontoEntradaGps) {
          const [entLat, entLon] = jornadaAtual.pontoEntradaGps.split(',').map(Number);
          const distanciaDaEntrada = calcularDistanciaEmMetros(posicao.coords.latitude, posicao.coords.longitude, entLat, entLon);
          if (distanciaDaEntrada > 50) {
            mostrarAviso(`Fraude Detectada: Sua saída está a ${Math.floor(distanciaDaEntrada)}m do local de entrada.`);
            setCarregando(false);
            return;
          }
        }

        await salvarPonto(imageSrc, gpsAtual, tipoRegistro, obraSelecionada?.nome || 'Base / Não Identificada'); 
      },
      (error) => {
        mostrarAviso('Você precisa permitir o uso do GPS do celular para bater ponto.');
        setCarregando(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [webcamRef, jornadaAtual, perfil, obraSelecionadaId, obrasList]);

  const salvarPonto = async (fotoLeve: string, localizacao: string, tipoRegistro: string, nomeObra: string) => {
    const registro = { tipo_registro: tipoRegistro, data_hora: new Date().toISOString(), foto_url: fotoLeve, localizacao_gps: localizacao, obra_nome: nomeObra };
    setStatus('Criptografando...');
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { error } = await supabase.from('registros_ponto').insert({ funcionario_id: user.id, ...registro });
      if (error) {
        mostrarAviso('Falha de Rede: Tente de novo.');
      } else {
        mostrarAviso('Ponto Salvo com Sucesso!');
        carregarDadosDoFuncionario(); 
      }
    }
    setCarregando(false);
  };

  const handleUploadFoto = async (event) => {
    try {
      setFazendoUpload(true);
      const file = event.target.files?.[0];
      if (!file) return;
      const fileExt = file.name.split('.').pop();
      const fileName = `${perfil.id}-${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
      setPerfil({ ...perfil, avatar_url: publicUrl });
    } catch (error: any) { alert('Erro ao subir a foto: ' + error.message); } 
    finally { setFazendoUpload(false); }
  };

  const salvarPerfil = async (e) => {
    e.preventDefault();
    setCarregando(true);
    const { error } = await supabase.from('perfis').update({ funcao: perfil.funcao, avatar_url: perfil.avatar_url }).eq('id', perfil.id);
    if (!error) { setMenuAberto(false); carregarDadosDoFuncionario(); }
    setCarregando(false);
  };

  const getNomeObraSelecionada = () => {
    if (!obraSelecionadaId) return 'Onde você está trabalhando hoje?';
    return obrasList.find(o => o.id === obraSelecionadaId)?.nome || 'Obra Desconhecida';
  };

  return (
    <div className="min-h-screen bg-[#020617] relative overflow-hidden font-['Inter'] text-slate-100 flex flex-col items-center">
      
      <div className="w-full bg-[#0f172a]/80 backdrop-blur-md border-b border-slate-800 p-4 flex justify-between items-center z-20">
        <div className="flex items-center gap-3">
          {perfil.avatar_url ? (
            <img src={perfil.avatar_url} alt="Avatar" className="w-10 h-10 rounded-full object-cover border border-slate-600" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-emerald-500 font-bold border border-slate-700">
              {perfil.nome ? perfil.nome.charAt(0).toUpperCase() : <User size={20} />}
            </div>
          )}
          <div className="flex flex-col">
            <span className="font-['Montserrat'] font-bold text-sm text-slate-100 leading-tight">
              {perfil.nome || 'Carregando...'}
            </span>
            <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
              <Briefcase size={10} /> {perfil.funcao || 'Função não definida'}
            </span>
          </div>
        </div>
        <button onClick={() => setMenuAberto(true)} className="p-2 bg-slate-800/50 hover:bg-slate-700 rounded-lg text-slate-300 transition-colors">
          <MoreVertical size={20} />
        </button>
      </div>

      {menuAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#0f172a] border border-slate-700 rounded-3xl w-full max-w-sm p-6 shadow-2xl relative">
            <button onClick={() => setMenuAberto(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X size={24} /></button>
            <h2 className="text-xl font-bold mb-6 font-['Montserrat']">Meu Perfil</h2>
            <form onSubmit={salvarPerfil} className="flex flex-col gap-6">
              <div className="flex flex-col items-center gap-3">
                <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider self-start">Foto de Perfil</label>
                <div className="relative group cursor-pointer">
                  {perfil.avatar_url ? (
                    <img src={perfil.avatar_url} alt="Sua Foto" className="w-24 h-24 rounded-full object-cover border-2 border-emerald-500" />
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-slate-800 border-2 border-dashed border-slate-600 flex items-center justify-center text-slate-500"><User size={40} /></div>
                  )}
                  <label className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                    {fazendoUpload ? <Loader2 size={24} className="text-white animate-spin" /> : <Upload size={24} className="text-white" />}
                    <input type="file" accept="image/*" onChange={handleUploadFoto} disabled={fazendoUpload} className="hidden" />
                  </label>
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block font-semibold uppercase tracking-wider">Sua Função / Cargo</label>
                <input type="text" value={perfil.funcao || ''} onChange={e => setPerfil({...perfil, funcao: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white focus:border-emerald-500 outline-none transition-all" />
              </div>
              <button type="submit" disabled={carregando || fazendoUpload} className="mt-2 w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl transition-colors disabled:opacity-50">
                <Save size={18} /> Salvar Alterações
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="w-full max-w-sm relative z-10 flex flex-col items-center pt-6 px-6">
        
        <div className="mb-6 text-center">
          <div className="font-['Montserrat'] text-5xl font-bold tracking-tight text-white drop-shadow-lg">
            {horaAtual.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            <span className="text-2xl text-slate-500 ml-1">{horaAtual.toLocaleTimeString('pt-BR', { second: '2-digit' })}</span>
          </div>
        </div>

        <div className={`w-full p-4 rounded-2xl mb-6 flex items-center justify-center gap-3 border backdrop-blur-md text-center shadow-lg ${
          jornadaAtual.bloqueadoPorHoje ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' :
          jornadaAtual.status === 'trabalhando' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 
          'bg-slate-800/50 border-slate-700 text-slate-400'
        }`}>
          {jornadaAtual.bloqueadoPorHoje ? (
            <><Ban size={18} /><span className="text-sm font-semibold">Jornada Concluída.</span></>
          ) : jornadaAtual.status === 'trabalhando' ? (
            <><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span><span className="text-sm font-semibold">Trabalhando na {jornadaAtual.obraNomeAtual || 'Base'}</span></>
          ) : (
            <><CalendarClock size={18} /><span className="text-sm font-semibold">Aguardando início de turno.</span></>
          )}
        </div>

        {!jornadaAtual.bloqueadoPorHoje && (
          <div className="w-full mb-6 relative">
            <button 
              type="button"
              onClick={() => { if (jornadaAtual.status !== 'trabalhando') setDropdownAberto(!dropdownAberto); }}
              disabled={jornadaAtual.status === 'trabalhando'}
              className="w-full bg-[#0f172a]/80 backdrop-blur-md border border-blue-900/50 text-white text-sm font-semibold rounded-2xl py-4 px-4 flex justify-between items-center focus:outline-none focus:border-blue-500 transition-colors shadow-lg disabled:opacity-70 disabled:cursor-not-allowed"
            >
              <div className="flex items-center gap-3 truncate">
                <Building2 size={18} className="text-blue-400 shrink-0" />
                <span className="truncate">{getNomeObraSelecionada()}</span>
              </div>
              <ChevronDown size={18} className={`text-slate-400 shrink-0 transition-transform ${dropdownAberto ? 'rotate-180' : ''}`} />
            </button>

            {dropdownAberto && (
              <div className="fixed inset-0 z-30" onClick={() => setDropdownAberto(false)}></div>
            )}

            {dropdownAberto && (
              <div className="absolute top-[calc(100%+8px)] left-0 w-full bg-[#0f172a] border border-slate-700 rounded-2xl shadow-2xl overflow-hidden z-40 animate-in fade-in slide-in-from-top-2">
                <ul className="max-h-60 overflow-y-auto py-2 divide-y divide-slate-800/50 custom-scrollbar">
                  <li 
                    onClick={() => { setObraSelecionadaId(''); setDropdownAberto(false); }}
                    className="px-4 py-3 text-sm text-slate-400 hover:bg-slate-800 cursor-pointer transition-colors"
                  >
                    Nenhuma / Limpar seleção
                  </li>
                  {obrasList.map(obra => (
                    <li 
                      key={obra.id}
                      onClick={() => { setObraSelecionadaId(obra.id); setDropdownAberto(false); }}
                      className={`px-4 py-3 text-sm cursor-pointer transition-colors flex items-center justify-between ${
                        obraSelecionadaId === obra.id ? 'bg-blue-600/10 text-blue-400 font-bold' : 'text-slate-200 hover:bg-slate-800'
                      }`}
                    >
                      <span className="truncate">{obra.nome}</span>
                      {obraSelecionadaId === obra.id && <CheckCircle2 size={16} className="shrink-0" />}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="w-full bg-[#0f172a]/60 backdrop-blur-xl border border-slate-800 rounded-3xl p-3 shadow-2xl mb-6 ring-1 ring-emerald-500/30">
          <div className="relative rounded-2xl overflow-hidden bg-black aspect-[3/4]">
            <Webcam audio={false} ref={webcamRef} screenshotFormat="image/jpeg" videoConstraints={videoConstraints} className="w-full h-full object-cover" />
            <div className="absolute bottom-4 left-0 right-0 flex justify-center">
              <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md text-slate-200 px-3 py-1.5 rounded-full text-xs font-medium border border-white/10">
                <Camera size={14} /> GPS Ativo
              </div>
            </div>
          </div>
        </div>

        <div className="w-full flex flex-col gap-3 pb-8">
          {jornadaAtual.status === 'livre' && !jornadaAtual.bloqueadoPorHoje && (
            <button onClick={() => registrar('entrada')} disabled={carregando} className="w-full flex items-center justify-center gap-3 py-4 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-['Montserrat'] font-semibold rounded-xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)] disabled:opacity-50">
              <LogIn size={22} /> Iniciar Expediente
            </button>
          )}
          
          {jornadaAtual.status === 'trabalhando' && !jornadaAtual.bloqueadoPorHoje && (
            <button onClick={() => registrar('saida')} disabled={carregando} className="w-full flex items-center justify-center gap-3 py-4 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-red-900/50 font-['Montserrat'] font-semibold rounded-xl transition-all shadow-lg shadow-red-900/10 disabled:opacity-50">
              <LogOut size={22} className="text-red-400" /> Encerrar Expediente
            </button>
          )}
        </div>

        {/* ALERTA CORRIGIDO: Agora as mensagens somem sozinhas após 6 segundos */}
        {status && (
          <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 w-[90%] max-w-sm flex items-start text-left gap-3 p-4 rounded-2xl text-sm font-medium border backdrop-blur-xl z-50 shadow-2xl animate-in slide-in-from-bottom-6 ${status.includes('Sucesso') ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-100' : 'bg-red-950/90 border-red-500/50 text-red-100'}`}>
            <div className="mt-0.5 shrink-0">
              {status.includes('Sucesso') ? <CheckCircle2 size={20} className="text-emerald-400" /> : <AlertCircle size={20} className="text-red-400" />}
            </div>
            <span className="leading-snug">{status}</span>
          </div>
        )}
      </div>
    </div>
  );
}