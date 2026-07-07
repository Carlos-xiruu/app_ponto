// @ts-nocheck
import React, { useRef, useState, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import { supabase } from './supabaseClient';
import { LogIn, LogOut, Camera, WifiOff, CheckCircle2, AlertCircle, MoreVertical, User, Briefcase, CalendarClock, X, Save, Upload, Loader2 } from 'lucide-react';

export default function BaterPonto() {
  const webcamRef = useRef<Webcam>(null);
  const [status, setStatus] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [horaAtual, setHoraAtual] = useState(new Date());

  const [perfil, setPerfil] = useState({ id: '', nome: '', funcao: '', avatar_url: '', data_nascimento: '' });
  const [idade, setIdade] = useState<number | null>(null);
  const [jornadaAtual, setJornadaAtual] = useState<{ status: 'trabalhando' | 'livre', desde?: string }>({ status: 'livre' });
  const [menuAberto, setMenuAberto] = useState(false);
  const [fazendoUpload, setFazendoUpload] = useState(false);

  const videoConstraints = { width: 300, height: 400, facingMode: "user" };

  useEffect(() => {
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Montserrat:wght@600;700&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);

    const timer = setInterval(() => setHoraAtual(new Date()), 1000);
    carregarDadosDoFuncionario();
    
    return () => clearInterval(timer);
  }, []);

  const carregarDadosDoFuncionario = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: dadosPerfil } = await supabase.from('perfis').select('*').eq('id', user.id).single();
    if (dadosPerfil) {
      setPerfil(dadosPerfil);
      if (dadosPerfil.data_nascimento) {
        const hoje = new Date();
        const nasc = new Date(dadosPerfil.data_nascimento);
        let idadeCalc = hoje.getFullYear() - nasc.getFullYear();
        const m = hoje.getMonth() - nasc.getMonth();
        if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idadeCalc--;
        setIdade(idadeCalc);
      }
    }

    const hojeIso = new Date().toISOString().split('T')[0];
    const { data: registrosHoje } = await supabase
      .from('registros_ponto')
      .select('tipo_registro, data_hora')
      .eq('funcionario_id', user.id)
      .gte('data_hora', `${hojeIso}T00:00:00Z`)
      .order('data_hora', { ascending: false })
      .limit(1);

    if (registrosHoje && registrosHoje.length > 0) {
      const ultimoPonto = registrosHoje[0];
      if (ultimoPonto.tipo_registro === 'entrada') {
        const horaFormatada = new Date(ultimoPonto.data_hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        setJornadaAtual({ status: 'trabalhando', desde: horaFormatada });
      } else {
        setJornadaAtual({ status: 'livre' });
      }
    }
  };

  const handleUploadFoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setFazendoUpload(true);
      const file = event.target.files?.[0];
      if (!file) return;

      const fileExt = file.name.split('.').pop();
      const fileName = `${perfil.id}-${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      setPerfil({ ...perfil, avatar_url: publicUrl });

    } catch (error: any) {
      alert('Erro ao subir a foto: ' + error.message);
    } finally {
      setFazendoUpload(false);
    }
  };

  const salvarPerfil = async (e: React.FormEvent) => {
    e.preventDefault();
    setCarregando(true);
    const { error } = await supabase.from('perfis').update({ 
      funcao: perfil.funcao, 
      avatar_url: perfil.avatar_url 
    }).eq('id', perfil.id);
    
    if (!error) {
      setMenuAberto(false);
      carregarDadosDoFuncionario();
    }
    setCarregando(false);
  };

  // Aqui eu executo a minha rotina estrita de validação de segurança do GPS
  const registrar = useCallback(async (tipoRegistro: 'entrada' | 'saida') => {
    setCarregando(true);
    setStatus('Capturando dados...');

    const imageSrc = webcamRef.current?.getScreenshot();
    if (!imageSrc) {
      setStatus('Erro de câmera. Verifique permissões.');
      setCarregando(false);
      return;
    }

    // Eu forço o navegador a ler a geolocalização. Se falhar ou for bloqueado, eu barro o processo.
    navigator.geolocation.getCurrentPosition(
      async (posicao) => { 
        const gps = `${posicao.coords.latitude},${posicao.coords.longitude}`;
        await salvarPonto(imageSrc, gps, tipoRegistro); 
      },
      (error) => {
        // Se cair aqui, significa que o peão bloqueou o GPS. Eu cancelo o registro na hora.
        console.error(error);
        setStatus('Acesso Negado: Ative a localização do aparelho para conseguir bater o ponto.');
        setCarregando(false);
      },
      { enableHighAccuracy: true, timeout: 7000 }
    );
  }, [webcamRef]);

  const salvarPonto = async (fotoLeve: string, localizacao: string, tipoRegistro: string) => {
    const registro = { tipo_registro: tipoRegistro, data_hora: new Date().toISOString(), foto_url: fotoLeve, localizacao_gps: localizacao };
    if (navigator.onLine) {
      setStatus('Processando...');
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error } = await supabase.from('registros_ponto').insert({ funcionario_id: user.id, ...registro });
        if (error) setStatus(`Falha: ${error.message}`);
        else {
          setStatus('Sucesso!');
          carregarDadosDoFuncionario(); 
        }
      }
    } else {
      setStatus('Salvo no aparelho (Offline). O app enviará quando tiver internet.');
    }
    setCarregando(false);
    setTimeout(() => setStatus(''), 4000);
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
              {perfil.nome || 'Carregando...'} {idade ? `(${idade} anos)` : ''}
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
                    <div className="w-24 h-24 rounded-full bg-slate-800 border-2 border-dashed border-slate-600 flex items-center justify-center text-slate-500">
                      <User size={40} />
                    </div>
                  )}
                  <label className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                    {fazendoUpload ? <Loader2 size={24} className="text-white animate-spin" /> : <Upload size={24} className="text-white" />}
                    <input type="file" accept="image/*" onChange={handleUploadFoto} disabled={fazendoUpload} className="hidden" />
                  </label>
                </div>
                <span className="text-[11px] text-slate-500 text-center">Toque na imagem para escolher uma foto da sua galeria.</span>
              </div>

              <div>
                <label className="text-xs text-slate-400 mb-1 block font-semibold uppercase tracking-wider">Sua Função / Cargo</label>
                <input type="text" value={perfil.funcao || ''} onChange={e => setPerfil({...perfil, funcao: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white focus:border-emerald-500 outline-none transition-all" placeholder="Ex: Operador de Máquina" />
              </div>
              
              <button type="submit" disabled={carregando || fazendoUpload} className="mt-2 w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl transition-colors disabled:opacity-50">
                <Save size={18} /> Salvar Alterações
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="absolute top-[10%] left-[-20%] w-96 h-96 bg-blue-600/10 rounded-full blur-[128px] pointer-events-none"></div>
      
      <div className="w-full max-w-sm relative z-10 flex flex-col items-center pt-6 px-6">
        <div className="mb-6 text-center">
          <div className="font-['Montserrat'] text-5xl font-bold tracking-tight text-white drop-shadow-lg">
            {horaAtual.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            <span className="text-2xl text-slate-500 ml-1">{horaAtual.toLocaleTimeString('pt-BR', { second: '2-digit' })}</span>
          </div>
        </div>

        <div className={`w-full p-4 rounded-2xl mb-6 flex items-center justify-center gap-3 border backdrop-blur-md transition-all ${
          jornadaAtual.status === 'trabalhando' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-slate-800/50 border-slate-700 text-slate-400'
        }`}>
          {jornadaAtual.status === 'trabalhando' ? (
            <><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span><span className="text-sm font-semibold">Trabalhando desde as {jornadaAtual.desde}</span></>
          ) : (
            <><CalendarClock size={18} /><span className="text-sm font-semibold">Você não está em jornada no momento.</span></>
          )}
        </div>

        <div className="w-full bg-[#0f172a]/60 backdrop-blur-xl border border-slate-800 rounded-3xl p-3 shadow-2xl mb-6 ring-1 ring-emerald-500/30">
          <div className="relative rounded-2xl overflow-hidden bg-black aspect-[3/4]">
            <Webcam audio={false} ref={webcamRef} screenshotFormat="image/jpeg" videoConstraints={videoConstraints} className="w-full h-full object-cover" />
            <div className="absolute bottom-4 left-0 right-0 flex justify-center">
              <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md text-slate-200 px-3 py-1.5 rounded-full text-xs font-medium border border-white/10">
                <Camera size={14} /> Câmera Ativa
              </div>
            </div>
          </div>
        </div>

        <div className="w-full flex flex-col gap-3 pb-8">
          <button onClick={() => registrar('entrada')} disabled={carregando} className="w-full flex items-center justify-center gap-3 py-4 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-['Montserrat'] font-semibold rounded-xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)]">
            <LogIn size={22} /> Registrar Entrada
          </button>
          <button onClick={() => registrar('saida')} disabled={carregando} className="w-full flex items-center justify-center gap-3 py-4 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-['Montserrat'] font-semibold rounded-xl transition-all">
            <LogOut size={22} /> Registrar Saída
          </button>
        </div>

        {status && (
          <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-sm flex items-center gap-3 p-4 rounded-xl text-sm font-medium border backdrop-blur-md z-50 ${status === 'Sucesso!' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/90 border-red-700 text-white'}`}>
            {status === 'Sucesso!' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />} {status}
          </div>
        )}
      </div>
    </div>
  );
}