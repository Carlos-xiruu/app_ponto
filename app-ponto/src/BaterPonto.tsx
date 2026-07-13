// @ts-nocheck
import React, { useRef, useState, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import { supabase } from './supabaseClient';
import { LogIn, LogOut, Camera, CheckCircle2, AlertCircle, User, Briefcase, CalendarClock, Save, Upload, Loader2, Ban, Building2, ChevronDown, Home, ClipboardList, MapPin, ShieldAlert, FileSignature, X, ShieldCheck } from 'lucide-react';

export default function BaterPonto() {
  // Eu configuro aqui a referência para a câmera do celular
  const webcamRef = useRef<Webcam>(null);
  const [status, setStatus] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [horaAtual, setHoraAtual] = useState(new Date());

  // Eu uso este estado para controlar qual tela o funcionário está vendo no momento
  const [abaAtiva, setAbaAtiva] = useState('inicio'); 

  // Aqui eu guardo os dados de quem está logado
  const [perfil, setPerfil] = useState({ id: '', nome: '', funcao: '', avatar_url: '', cpf: '' });
  
  const [obrasList, setObrasList] = useState([]);
  const [obraSelecionadaId, setObraSelecionadaId] = useState('');
  const [dropdownAberto, setDropdownAberto] = useState(false);
  
  // Meu estado inteligente que sabe se o cara tá trabalhando, livre ou bloqueado
  const [jornadaAtual, setJornadaAtual] = useState({ status: 'livre', pontoEntradaGps: null, bloqueadoPorHoje: false, obraNomeAtual: '' });
  const [fazendoUpload, setFazendoUpload] = useState(false);

  const mesAtual = new Date().toISOString().slice(0, 7); 
  const [mesFiltro, setMesFiltro] = useState(mesAtual);
  const [meusRegistros, setMeusRegistros] = useState([]);
  const [carregandoRegistros, setCarregandoRegistros] = useState(false);

  // Meus novos estados para gerenciar a assinatura digital das folhas
  const [folhasPendentes, setFolhasPendentes] = useState([]);
  const [modalAssinaturaAberto, setModalAssinaturaAberto] = useState(false);
  const [folhaParaAssinar, setFolhaParaAssinar] = useState(null);
  const [assinando, setAssinando] = useState(false);

  // Minha configuração para a câmera (pedindo sempre a câmera frontal)
  const videoConstraints = { width: 300, height: 400, facingMode: "user" };

  // Meu motorzinho que exibe os avisos flutuantes e apaga sozinho depois de 6 segundos
  const mostrarAviso = (mensagem) => {
    setStatus(mensagem);
    setTimeout(() => setStatus(''), 6000);
  };

  useEffect(() => {
    const timer = setInterval(() => setHoraAtual(new Date()), 1000);
    carregarDadosDoFuncionario();
    return () => clearInterval(timer);
  }, []);

  // Eu forço a recarga do histórico sempre que ele clica na aba de registros
  useEffect(() => {
    if (abaAtiva === 'registros') buscarHistoricoMensal();
  }, [abaAtiva, mesFiltro, perfil.id]);

  const carregarDadosDoFuncionario = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Eu busco o perfil dele no banco de dados
    const { data: dadosPerfil } = await supabase.from('perfis').select('*').eq('id', user.id).single();
    if (dadosPerfil) setPerfil(dadosPerfil); 

    const { data: obrasData } = await supabase.from('obras').select('*').order('nome');
    if (obrasData) setObrasList(obrasData);

    // Eu varro o banco pra ver se o RH fechou a folha para este funcionário
    buscarFolhasPendentes(user.id);

    // Eu peço os últimos 2 registros para montar a lógica de jornada (se ele já entrou ou já saiu hoje)
    const { data: historico } = await supabase
      .from('registros_ponto')
      .select('tipo_registro, data_hora, localizacao_gps, obra_nome')
      .eq('funcionario_id', user.id)
      .order('data_hora', { ascending: false })
      .limit(2);

    if (historico && historico.length > 0) {
      const ultimaAcao = historico[0];

      if (ultimaAcao.tipo_registro === 'entrada') {
        setJornadaAtual({ status: 'trabalhando', pontoEntradaGps: ultimaAcao.localizacao_gps, bloqueadoPorHoje: false, obraNomeAtual: ultimaAcao.obra_nome });
        if (obrasData && ultimaAcao.obra_nome) {
          const obraMatch = obrasData.find(o => o.nome === ultimaAcao.obra_nome);
          if (obraMatch) setObraSelecionadaId(obraMatch.id);
        }
      } else if (ultimaAcao.tipo_registro === 'saida') {
        const dataSaidaLocal = new Date(ultimaAcao.data_hora).toLocaleDateString('pt-BR');
        const dataHojeLocal = new Date().toLocaleDateString('pt-BR');
        if (dataSaidaLocal === dataHojeLocal) setJornadaAtual({ status: 'livre', bloqueadoPorHoje: true, obraNomeAtual: '' });
        else setJornadaAtual({ status: 'livre', bloqueadoPorHoje: false, obraNomeAtual: '' });
      }
    } else {
      setJornadaAtual({ status: 'livre', bloqueadoPorHoje: false, obraNomeAtual: '' });
    }
  };

  // Minha função que procura folhas com status 'pendente'
  const buscarFolhasPendentes = async (userId) => {
    const { data } = await supabase
      .from('folhas_pagamento')
      .select('*')
      .eq('funcionario_id', userId)
      .eq('status', 'pendente');
    
    if (data) setFolhasPendentes(data);
  };

  const buscarHistoricoMensal = async () => {
    if (!perfil.id) return;
    setCarregandoRegistros(true);
    
    const [ano, mes] = mesFiltro.split('-');
    const dataInicio = new Date(ano, mes - 1, 1).toISOString();
    const dataFim = new Date(ano, mes, 0, 23, 59, 59).toISOString();

    const { data, error } = await supabase
      .from('registros_ponto')
      .select('id, tipo_registro, data_hora, localizacao_gps, obra_nome')
      .eq('funcionario_id', perfil.id)
      .gte('data_hora', dataInicio)
      .lte('data_hora', dataFim)
      .order('data_hora', { ascending: false });

    if (data) {
      const agrupado = {};
      data.forEach(ponto => {
        const dataObj = new Date(ponto.data_hora);
        const dataStr = dataObj.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
        const horaStr = dataObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        
        if (!agrupado[dataStr]) agrupado[dataStr] = [];
        agrupado[dataStr].push({ ...ponto, horaFormatada: horaStr });
      });
      setMeusRegistros(Object.entries(agrupado));
    }
    setCarregandoRegistros(false);
  };

  // Meu motor do cartório digital: crio um hash SHA-256 impossível de ser alterado
  const gerarHashCriptografico = async (texto) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(texto);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  // Eu chamo essa API pública e leve para descobrir o IP do funcionário
  const capturarIP = async () => {
    try {
      const res = await fetch('https://api.ipify.org?format=json');
      const data = await res.json();
      return data.ip;
    } catch (e) { return 'IP_NAO_IDENTIFICADO'; }
  };

  // Minha lógica central que executa a assinatura legal do documento
  const assinarDocumento = async () => {
    if (!perfil.cpf) {
      alert("Atenção: Você precisa de um CPF cadastrado para assinar. Peça ao RH para atualizar seu cadastro.");
      return;
    }

    setAssinando(true);
    setStatus('Autenticando localização e gerando chaves...');

    navigator.geolocation.getCurrentPosition(
      async (posicao) => {
        const gpsAtual = `${posicao.coords.latitude},${posicao.coords.longitude}`;
        const ip = await capturarIP();
        const dataExata = new Date().toISOString();
        
        // Eu amarro os dados do funcionário com o GPS, a hora e o IP para formar o Hash de segurança
        const stringBase = `${perfil.id}|${folhaParaAssinar.mes_ano}|${perfil.cpf}|${dataExata}|${gpsAtual}|${ip}`;
        const hash = await gerarHashCriptografico(stringBase);

        const { error } = await supabase
          .from('folhas_pagamento')
          .update({
            status: 'assinado',
            data_assinatura: dataExata,
            ip_assinatura: ip,
            gps_assinatura: gpsAtual,
            hash_auditoria: hash
          })
          .eq('id', folhaParaAssinar.id);

        if (error) {
          mostrarAviso('Falha na comunicação com o cartório digital.');
        } else {
          setModalAssinaturaAberto(false);
          setFolhaParaAssinar(null);
          mostrarAviso('Documento assinado com Sucesso!');
          buscarFolhasPendentes(perfil.id); 
        }
        setAssinando(false);
      },
      () => {
        mostrarAviso('Você precisa permitir o GPS para ter validade jurídica na assinatura.');
        setAssinando(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Meu cálculo matemático (Fórmula de Haversine) para medir a distância em metros
  const calcularDistanciaEmMetros = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; 
    const rad = Math.PI / 180;
    const a = Math.sin((lat2 - lat1) * rad / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin((lon2 - lon1) * rad / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const registrar = useCallback(async (tipoRegistro: 'entrada' | 'saida') => {
    if (jornadaAtual.bloqueadoPorHoje) { mostrarAviso('Jornada concluída! Novo registro liberado amanhã.'); return; }
    if (!obraSelecionadaId) { mostrarAviso('Erro: Selecione a Obra onde você está agora.'); return; }

    setCarregando(true);
    setStatus('Autenticando GPS com a base da Obra...'); 

    const imageSrc = webcamRef.current?.getScreenshot();
    if (!imageSrc) { mostrarAviso('Erro: Câmera não detectada.'); setCarregando(false); return; }

    navigator.geolocation.getCurrentPosition(
      async (posicao) => { 
        const gpsAtual = `${posicao.coords.latitude},${posicao.coords.longitude}`;
        const obraSelecionada = obrasList.find(o => o.id === obraSelecionadaId);
        
        // Eu faço o bloqueio da Cerca Eletrônica (Geofence)
        if (obraSelecionada?.localizacao_gps) {
          const [obraLat, obraLon] = obraSelecionada.localizacao_gps.split(',').map(Number);
          const dist = calcularDistanciaEmMetros(posicao.coords.latitude, posicao.coords.longitude, obraLat, obraLon);
          if (dist > 50) { mostrarAviso(`Acesso Negado: Você está a ${Math.floor(dist)}m da obra.`); setCarregando(false); return; }
        }

        // Minha validação anti-fraude: ele tem que sair no mesmo local que entrou
        if (tipoRegistro === 'saida' && jornadaAtual.pontoEntradaGps) {
          const [entLat, entLon] = jornadaAtual.pontoEntradaGps.split(',').map(Number);
          const dist = calcularDistanciaEmMetros(posicao.coords.latitude, posicao.coords.longitude, entLat, entLon);
          if (dist > 50) { mostrarAviso(`Fraude: Sua saída está a ${Math.floor(dist)}m da entrada.`); setCarregando(false); return; }
        }

        await salvarPonto(imageSrc, gpsAtual, tipoRegistro, obraSelecionada?.nome || 'Base'); 
      },
      () => { mostrarAviso('Permita o uso do GPS do celular.'); setCarregando(false); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [webcamRef, jornadaAtual, perfil, obraSelecionadaId, obrasList]);

  const salvarPonto = async (foto, local, tipo, nomeObra) => {
    const { error } = await supabase.from('registros_ponto').insert({ 
      funcionario_id: perfil.id, tipo_registro: tipo, data_hora: new Date().toISOString(), foto_url: foto, localizacao_gps: local, obra_nome: nomeObra 
    });
    if (error) mostrarAviso('Falha de Rede: Tente de novo.');
    else { mostrarAviso('Ponto Salvo com Sucesso!'); carregarDadosDoFuncionario(); }
    setCarregando(false);
  };

  const handleUploadFoto = async (event) => {
    try {
      setFazendoUpload(true);
      const file = event.target.files?.[0];
      if (!file) return;
      const fileExt = file.name.split('.').pop();
      const fileName = `${perfil.id}-${Math.random()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
      setPerfil({ ...perfil, avatar_url: publicUrl });
    } catch (err) { alert('Erro ao subir foto.'); } finally { setFazendoUpload(false); }
  };

  const salvarPerfil = async (e) => {
    e.preventDefault();
    setCarregando(true);
    await supabase.from('perfis').update({ funcao: perfil.funcao, avatar_url: perfil.avatar_url }).eq('id', perfil.id);
    mostrarAviso('Perfil atualizado com sucesso!');
    setCarregando(false);
  };

  // Minha função clássica e limpa para sair do aplicativo
  const sairApp = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  const getNomeObraSelecionada = () => {
    if (!obraSelecionadaId) return 'Onde você está trabalhando hoje?';
    return obrasList.find(o => o.id === obraSelecionadaId)?.nome || 'Obra Desconhecida';
  };

  return (
    <div className="h-screen bg-[#020617] font-['Inter'] text-slate-100 flex flex-col overflow-hidden relative">
      
      {/* MEU MODAL DE ASSINATURA */}
      {modalAssinaturaAberto && folhaParaAssinar && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
          <div className="bg-[#0f172a] border border-slate-700 rounded-3xl w-full max-w-sm p-6 shadow-2xl relative flex flex-col items-center animate-in zoom-in-95">
            <button onClick={() => setModalAssinaturaAberto(false)} disabled={assinando} className="absolute top-4 right-4 text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors"><X size={20} /></button>
            
            <ShieldCheck size={48} className="text-emerald-500 mb-4" />
            <h2 className="text-xl font-bold font-['Montserrat'] text-white text-center">Assinatura Digital</h2>
            <p className="text-sm text-slate-400 text-center mb-6 mt-2">Você está prestes a assinar com validade legal o espelho de ponto referente ao mês de <strong className="text-slate-200">{folhaParaAssinar.mes_ano.split('-')[1]}/{folhaParaAssinar.mes_ano.split('-')[0]}</strong>.</p>
            
            <div className="w-full bg-slate-900/80 border border-slate-800 rounded-xl p-4 mb-6">
              <span className="block text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-1">Assinante</span>
              <span className="block text-sm font-bold text-slate-200">{perfil.nome}</span>
              <span className="block text-xs font-mono text-emerald-400 mt-1">CPF: {perfil.cpf || 'Não Cadastrado'}</span>
            </div>

            <p className="text-[10px] text-slate-500 text-center mb-6 leading-relaxed px-2">Ao clicar em assinar, você concorda que leu e conferiu todos os horários desta folha no menu "Registros". Uma coordenada de GPS e seu IP serão capturados para fins de auditoria (Lei 14.063).</p>

            <button 
              onClick={assinarDocumento} 
              disabled={assinando} 
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-emerald-900/20 disabled:opacity-50"
            >
              {assinando ? <Loader2 className="animate-spin" size={20} /> : <FileSignature size={20} />}
              {assinando ? 'Gerando Chaves...' : 'Assinar Eletronicamente'}
            </button>
          </div>
        </div>
      )}

      {/* HEADER FIXO NO TOPO (Agora com o botão de Logout posicionado elegantemente ao lado direito) */}
      <div className="w-full bg-[#0f172a]/90 backdrop-blur-md border-b border-slate-800 p-4 shrink-0 flex justify-between items-center z-20">
        <div className="flex items-center gap-3">
          {perfil.avatar_url ? (
            <img src={perfil.avatar_url} alt="Avatar" className="w-10 h-10 rounded-full object-cover border border-slate-600" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-emerald-500 font-bold border border-slate-700">
              {perfil.nome ? perfil.nome.charAt(0).toUpperCase() : <User size={20} />}
            </div>
          )}
          <div className="flex flex-col">
            <span className="font-['Montserrat'] font-bold text-sm text-slate-100 leading-tight">Olá, {perfil.nome || 'Carregando...'}</span>
            <span className="text-xs text-slate-400 font-medium flex items-center gap-1"><Briefcase size={10} /> {perfil.funcao || 'Função não definida'}</span>
          </div>
        </div>
        
        {/* Aqui está a minha inclusão: Botão de Sair fixo e visível no Header */}
        <div className="flex items-center gap-2">
          <div className="text-emerald-500 hidden sm:block mr-2"><CheckCircle2 size={24} /></div>
          <button 
            onClick={sairApp} 
            className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors border border-transparent hover:border-red-500/20"
            title="Sair do Aplicativo"
          >
            <LogOut size={20} />
          </button>
        </div>
      </div>

      {/* ALERTA GLOBAL DE PENDÊNCIA JURÍDICA */}
      {folhasPendentes.length > 0 && (
        <div className="w-full bg-red-950/90 border-b border-red-900/50 p-3 shrink-0 flex items-center justify-between z-10">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-red-500/20 rounded-lg"><ShieldAlert size={16} className="text-red-400" /></div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-red-200">Ação Necessária</span>
              <span className="text-[10px] text-red-300">Você possui espelhos pendentes.</span>
            </div>
          </div>
          <button 
            onClick={() => {
              setFolhaParaAssinar(folhasPendentes[0]);
              setModalAssinaturaAberto(true);
            }} 
            className="px-3 py-1.5 bg-red-500 hover:bg-red-400 text-white text-[10px] font-bold uppercase tracking-wider rounded border border-red-400/50 shadow-sm transition-colors"
          >
            Assinar Agora
          </button>
        </div>
      )}

      {/* ÁREA DE ROLAGEM DINÂMICA (AQUI ENTRAM AS ABAS) */}
      <div className="flex-1 overflow-y-auto pb-24 custom-scrollbar">
        
        {/* ===================== ABA: INÍCIO ===================== */}
        {abaAtiva === 'inicio' && (
          <div className="w-full max-w-sm mx-auto flex flex-col items-center pt-6 px-6">
            <div className="mb-6 text-center">
              <div className="font-['Montserrat'] text-5xl font-bold tracking-tight text-white drop-shadow-lg">
                {horaAtual.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                <span className="text-2xl text-slate-500 ml-1">{horaAtual.toLocaleTimeString('pt-BR', { second: '2-digit' })}</span>
              </div>
            </div>

            <div className={`w-full p-4 rounded-2xl mb-6 flex items-center justify-center gap-3 border text-center shadow-lg ${
              jornadaAtual.bloqueadoPorHoje ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' :
              jornadaAtual.status === 'trabalhando' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 
              'bg-slate-800/50 border-slate-700 text-slate-400'
            }`}>
              {jornadaAtual.bloqueadoPorHoje ? ( <><Ban size={18} /><span className="text-sm font-semibold">Jornada Concluída.</span></> ) : 
               jornadaAtual.status === 'trabalhando' ? ( <><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span><span className="text-sm font-semibold">Trabalhando na {jornadaAtual.obraNomeAtual || 'Base'}</span></> ) : 
               ( <><CalendarClock size={18} /><span className="text-sm font-semibold">Aguardando início de turno.</span></> )}
            </div>

            {!jornadaAtual.bloqueadoPorHoje && (
              <div className="w-full mb-6 relative z-30">
                <button type="button" onClick={() => { if (jornadaAtual.status !== 'trabalhando') setDropdownAberto(!dropdownAberto); }} disabled={jornadaAtual.status === 'trabalhando'} className="w-full bg-[#0f172a] border border-blue-900/50 text-white text-sm font-semibold rounded-2xl py-4 px-4 flex justify-between items-center transition-colors shadow-lg disabled:opacity-70">
                  <div className="flex items-center gap-3 truncate"><Building2 size={18} className="text-blue-400 shrink-0" /> <span className="truncate">{getNomeObraSelecionada()}</span></div>
                  <ChevronDown size={18} className={`text-slate-400 shrink-0 transition-transform ${dropdownAberto ? 'rotate-180' : ''}`} />
                </button>

                {dropdownAberto && <div className="fixed inset-0 z-30" onClick={() => setDropdownAberto(false)}></div>}

                {dropdownAberto && (
                  <div className="absolute top-[calc(100%+8px)] left-0 w-full bg-[#0f172a] border border-slate-700 rounded-2xl shadow-2xl overflow-hidden z-40 animate-in fade-in slide-in-from-top-2">
                    <ul className="max-h-60 overflow-y-auto py-2 divide-y divide-slate-800/50 custom-scrollbar">
                      <li onClick={() => { setObraSelecionadaId(''); setDropdownAberto(false); }} className="px-4 py-3 text-sm text-slate-400 hover:bg-slate-800 cursor-pointer transition-colors">
                        Nenhuma / Limpar seleção
                      </li>
                      {obrasList.map(obra => (
                        <li key={obra.id} onClick={() => { setObraSelecionadaId(obra.id); setDropdownAberto(false); }} className={`px-4 py-3 text-sm cursor-pointer transition-colors flex items-center justify-between ${obraSelecionadaId === obra.id ? 'bg-blue-600/10 text-blue-400 font-bold' : 'text-slate-200 hover:bg-slate-800'}`}>
                          <span className="truncate">{obra.nome}</span>
                          {obraSelecionadaId === obra.id && <CheckCircle2 size={16} className="shrink-0" />}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <div className="w-full bg-[#0f172a] border border-slate-800 rounded-3xl p-3 shadow-2xl mb-6 ring-1 ring-emerald-500/30">
              <div className="relative rounded-2xl overflow-hidden bg-black aspect-[3/4]">
                <Webcam audio={false} ref={webcamRef} screenshotFormat="image/jpeg" videoConstraints={videoConstraints} className="w-full h-full object-cover" />
                <div className="absolute inset-0 border-2 border-emerald-500/30 rounded-2xl m-4 border-dashed pointer-events-none"></div>
                <div className="absolute bottom-4 left-0 right-0 flex justify-center">
                  <div className="flex items-center gap-2 bg-black/70 backdrop-blur-md text-emerald-400 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider border border-emerald-500/30">
                    <Camera size={14} /> Verificação Biométrica
                  </div>
                </div>
              </div>
            </div>

            <div className="w-full flex flex-col gap-3">
              {jornadaAtual.status === 'livre' && !jornadaAtual.bloqueadoPorHoje && (
                <button onClick={() => registrar('entrada')} disabled={carregando} className="w-full flex items-center justify-center gap-3 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-['Montserrat'] font-bold rounded-2xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] disabled:opacity-50">
                  <LogIn size={22} /> FAZER CHECK-IN
                </button>
              )}
              {jornadaAtual.status === 'trabalhando' && !jornadaAtual.bloqueadoPorHoje && (
                <button onClick={() => registrar('saida')} disabled={carregando} className="w-full flex items-center justify-center gap-3 py-4 bg-[#0f172a] text-red-400 border border-red-500/50 hover:bg-red-500/10 font-['Montserrat'] font-bold rounded-2xl transition-all disabled:opacity-50">
                  <LogOut size={22} /> FAZER CHECK-OUT
                </button>
              )}
            </div>
          </div>
        )}

        {/* ===================== ABA: REGISTROS ===================== */}
        {abaAtiva === 'registros' && (
          <div className="w-full max-w-md mx-auto pt-6 px-4">
            <h2 className="text-xl font-bold mb-6 font-['Montserrat'] text-white">Meus Pontos</h2>
            
            <div className="bg-[#0f172a] border border-slate-700 rounded-2xl p-4 mb-6">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Filtrar por Mês</label>
              <input type="month" value={mesFiltro} onChange={(e) => setMesFiltro(e.target.value)} className="w-full bg-slate-900 border border-slate-700 text-slate-100 font-semibold p-3 rounded-xl outline-none focus:border-emerald-500 transition-colors [color-scheme:dark]" />
            </div>

            {carregandoRegistros ? (
              <div className="flex justify-center p-8"><Loader2 className="animate-spin text-emerald-500" size={32} /></div>
            ) : meusRegistros.length === 0 ? (
              <div className="text-center p-8 bg-[#0f172a] border border-slate-800 rounded-2xl">
                <ClipboardList size={32} className="text-slate-600 mx-auto mb-3" />
                <span className="text-sm text-slate-400">Nenhum registro encontrado neste mês.</span>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {meusRegistros.map(([data, pontos]) => (
                  <div key={data} className="bg-[#0f172a] border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
                    <div className="bg-slate-800/50 p-3 border-b border-slate-800 font-semibold text-sm text-slate-300 uppercase tracking-wide">
                      {data}
                    </div>
                    <div className="p-4 flex flex-col gap-3">
                      {pontos.map(ponto => (
                        <div key={ponto.id} className="flex justify-between items-center bg-slate-900/50 p-3 rounded-xl border border-slate-800/50">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${ponto.tipo_registro === 'entrada' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-300'}`}>
                              {ponto.tipo_registro === 'entrada' ? <LogIn size={18} /> : <LogOut size={18} />}
                            </div>
                            <div>
                              <span className="block font-bold text-slate-200 capitalize">{ponto.tipo_registro}</span>
                              <span className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5"><MapPin size={10}/> {ponto.obra_nome || 'Base'}</span>
                            </div>
                          </div>
                          <span className="font-mono text-lg font-bold text-slate-300">{ponto.horaFormatada}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ===================== ABA: PERFIL ===================== */}
        {abaAtiva === 'perfil' && (
          <div className="w-full max-w-sm mx-auto pt-6 px-6">
            <h2 className="text-xl font-bold mb-6 font-['Montserrat'] text-white">Minha Conta</h2>
            
            <div className="bg-[#0f172a] border border-slate-700 rounded-3xl p-6 shadow-2xl">
              <form onSubmit={salvarPerfil} className="flex flex-col gap-6">
                <div className="flex flex-col items-center gap-3">
                  <div className="relative group cursor-pointer mt-2">
                    {perfil.avatar_url ? (
                      <img src={perfil.avatar_url} alt="Sua Foto" className="w-28 h-28 rounded-full object-cover border-4 border-slate-800 shadow-xl" />
                    ) : (
                      <div className="w-28 h-28 rounded-full bg-slate-800 border-2 border-dashed border-slate-600 flex items-center justify-center text-slate-500"><User size={40} /></div>
                    )}
                    <label className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                      {fazendoUpload ? <Loader2 size={24} className="text-white animate-spin" /> : <Upload size={24} className="text-white" />}
                      <input type="file" accept="image/*" onChange={handleUploadFoto} disabled={fazendoUpload} className="hidden" />
                    </label>
                  </div>
                  <span className="text-xs text-slate-400">Toque na foto para alterar</span>
                </div>
                
                <div>
                  <label className="text-xs text-slate-400 mb-1 block font-semibold uppercase tracking-wider">Sua Função</label>
                  <input type="text" value={perfil.funcao || ''} onChange={e => setPerfil({...perfil, funcao: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3.5 text-sm text-white focus:border-emerald-500 outline-none transition-all" placeholder="Ex: Eletricista, Mestre de Obras..." />
                </div>
                
                <button type="submit" disabled={carregando || fazendoUpload} className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-xl transition-colors shadow-lg">
                  <Save size={18} /> Salvar Alterações
                </button>
              </form>
            </div>
            
            {/* Eu mantive este botão extra aqui no final da aba por redundância, caso ele role até o fim */}
            <button onClick={sairApp} className="mt-8 w-full flex items-center justify-center gap-2 text-red-400 font-bold py-4 rounded-xl border border-red-900/30 hover:bg-red-500/10 transition-colors">
              <LogOut size={18} /> Sair do Aplicativo
            </button>
          </div>
        )}
      </div>

      {/* AVISOS FLUTUANTES (TOAST) */}
      {status && (
        <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 w-[90%] max-w-sm flex items-start text-left gap-3 p-4 rounded-2xl text-sm font-medium border backdrop-blur-xl z-50 shadow-2xl animate-in slide-in-from-bottom-2 ${status.includes('Sucesso') ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-100' : 'bg-red-950/90 border-red-500/50 text-red-100'}`}>
          <div className="mt-0.5 shrink-0">{status.includes('Sucesso') ? <CheckCircle2 size={20} className="text-emerald-400" /> : <AlertCircle size={20} className="text-red-400" />}</div> 
          <span className="leading-snug">{status}</span>
        </div>
      )}

      {/* BARRA DE NAVEGAÇÃO INFERIOR */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#0b1120]/95 backdrop-blur-lg border-t border-slate-800 shrink-0 z-40 px-6 pb-safe">
        <div className="flex justify-between items-center max-w-sm mx-auto h-20">
          <button onClick={() => setAbaAtiva('inicio')} className={`flex flex-col items-center gap-1.5 w-20 transition-colors ${abaAtiva === 'inicio' ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-300'}`}>
            <Home size={24} className={abaAtiva === 'inicio' ? 'fill-emerald-400/20' : ''} />
            <span className="text-[10px] font-bold uppercase tracking-wider">Início</span>
          </button>
          <button onClick={() => setAbaAtiva('registros')} className={`flex flex-col items-center gap-1.5 w-20 transition-colors ${abaAtiva === 'registros' ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-300'}`}>
            <ClipboardList size={24} />
            <span className="text-[10px] font-bold uppercase tracking-wider">Registros</span>
          </button>
          <button onClick={() => setAbaAtiva('perfil')} className={`flex flex-col items-center gap-1.5 w-20 transition-colors ${abaAtiva === 'perfil' ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-300'}`}>
            <User size={24} className={abaAtiva === 'perfil' ? 'fill-emerald-400/20' : ''} />
            <span className="text-[10px] font-bold uppercase tracking-wider">Perfil</span>
          </button>
        </div>
      </div>

    </div>
  );
}