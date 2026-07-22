// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { MapPin, Plus, X, FileText, Send, Share2, Eye, AlertTriangle, Building2, Trash2, Search, Navigation, Loader2, ArrowLeft, Clock, ShieldCheck, Fingerprint, FileSignature, Lock } from 'lucide-react';

const BadgeLocalizacao = ({ gps }) => {
  const [endereco, setEndereco] = useState('Buscando...');
  useEffect(() => {
    if (!gps) return;
    const [lat, lon] = gps.split(',');
    fetch(`https://photon.komoot.io/reverse?lon=${lon}&lat=${lat}`).then(res => res.json()).then(data => {
        if (data.features && data.features.length > 0) {
          const props = data.features[0].properties;
          setEndereco([props.street || props.name, props.city || props.town || props.state].filter(Boolean).join(', ') || 'Ver no mapa');
        } else setEndereco('Ver no mapa');
      }).catch(() => setEndereco('Ver no mapa')); 
  }, [gps]);
  return <a href={`https://www.google.com/maps/?q=${gps}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-2 py-1 bg-slate-800/50 hover:bg-slate-700 text-blue-400 rounded text-[11px] font-medium transition-colors border border-slate-700/50 print:hidden mt-1"><MapPin size={12} className="shrink-0" /> <span className="truncate max-w-[150px]">{endereco}</span></a>;
};

export default function Dashboard() {
  const [pontosAgrupados, setPontosAgrupados] = useState([]);
  const [resumoMensal, setResumoMensal] = useState([]);
  const [funcionarios, setFuncionarios] = useState([]);
  const [obrasList, setObrasList] = useState([]); 
  const [folhasPagamento, setFolhasPagamento] = useState([]); 
  const [carregando, setCarregando] = useState(true);
  
  const [dataMinimaLog, setDataMinimaLog] = useState('');
  const [dataMaximaLog, setDataMaximaLog] = useState('');
  
  const [fotoExpandida, setFotoExpandida] = useState(null);
  const [modalAberto, setModalAberto] = useState(false); 
  const [modalObraAberto, setModalObraAberto] = useState(false); 
  const [extratoSelecionado, setExtratoSelecionado] = useState(null); 
  const [certificadoSelecionado, setCertificadoSelecionado] = useState(null); 
  
  const [buscandoEndereco, setBuscandoEndereco] = useState(false);
  const [resultadosBusca, setResultadosBusca] = useState([]); 
  
  const [formManual, setFormManual] = useState({ 
    funcionario_id: '', 
    data: '', 
    hora_entrada: '07:00', 
    hora_saida: '17:00', 
    obra_nome: 'Lançamento Manual / Base' 
  });
  
  const [formObra, setFormObra] = useState({ nome: '', gps: '', buscaEndereco: '' });

  const dataAtual = new Date();
  const mesFiltroPadrao = `${dataAtual.getFullYear()}-${String(dataAtual.getMonth() + 1).padStart(2, '0')}`;
  const [mesFiltro, setMesFiltro] = useState(mesFiltroPadrao);

  useEffect(() => { buscarDados(); }, [mesFiltro]);

  const buscarDados = async () => {
    setCarregando(true);
    const { data: perfis } = await supabase.from('perfis').select('id, nome, funcao, cpf').eq('is_admin', false).order('nome');
    if (perfis) setFuncionarios(perfis);

    const { data: obrasData } = await supabase.from('obras').select('*').order('nome');
    if (obrasData) setObrasList(obrasData);

    const { data: folhas } = await supabase.from('folhas_pagamento').select('*').eq('mes_ano', mesFiltro);
    if (folhas) setFolhasPagamento(folhas);

    const [ano, mes] = mesFiltro.split('-');
    const dataInicio = new Date(ano, mes - 1, 1).toISOString();
    const dataFim = new Date(ano, mes, 0, 23, 59, 59).toISOString();

    const { data, error } = await supabase
      .from('registros_ponto')
      .select('id, tipo_registro, data_hora, foto_url, localizacao_gps, funcionario_id, obra_nome, perfis ( nome, funcao, cpf )')
      .gte('data_hora', dataInicio)
      .lte('data_hora', dataFim)
      .order('data_hora', { ascending: true });

    if (error) { console.error(error); setCarregando(false); return; }

    const agrupamento = {};
    let maiorDataEncontrada = null;

    // === PASSO 1: Apenas organiza as batidas nos dias (sem calcular ainda) ===
    data.forEach((ponto) => {
      const dataObj = new Date(ponto.data_hora);
      const dataLocal = dataObj.toLocaleDateString('pt-BR');
      const horaLocal = dataObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const nomeFuncionario = ponto.perfis?.nome || 'Desconhecido';
      const cargoFuncionario = ponto.perfis?.funcao || 'Não definida';
      const chave = `${nomeFuncionario}-${dataLocal}`;

      if (!maiorDataEncontrada || dataObj > maiorDataEncontrada) { maiorDataEncontrada = dataObj; }

      if (!agrupamento[chave]) {
        agrupamento[chave] = { nome: nomeFuncionario, cargo: cargoFuncionario, data: dataLocal, entrada: null, saida: null, minutosTrabalhadosDia: 0, descontouAlmoco: false };
      }
      
      if (ponto.tipo_registro === 'entrada') agrupamento[chave].entrada = { hora: horaLocal, gps: ponto.localizacao_gps, foto: ponto.foto_url, rawIso: ponto.data_hora, obra: ponto.obra_nome };
      if (ponto.tipo_registro === 'saida') agrupamento[chave].saida = { hora: horaLocal, gps: ponto.localizacao_gps, foto: ponto.foto_url, rawIso: ponto.data_hora, obra: ponto.obra_nome };
    });

    const totaisMinutosMes = {};

    // === PASSO 2: A matemática final e infalível, calculando o dia inteiro UMA ÚNICA VEZ ===
    Object.values(agrupamento).forEach(dia => {
      if (!totaisMinutosMes[dia.nome]) totaisMinutosMes[dia.nome] = 0;

      if (dia.entrada && dia.saida) {
        let minutos = Math.max(0, Math.floor((new Date(dia.saida.rawIso).getTime() - new Date(dia.entrada.rawIso).getTime()) / 60000));
        
        // Desconto de 1 hora automático
        if (minutos >= 60) {
          minutos -= 60;
          dia.descontouAlmoco = true;
        } else {
          minutos = 0;
        }

        dia.minutosTrabalhadosDia = minutos;
        totaisMinutosMes[dia.nome] += minutos;
      }
    });

    const todosPontos = Object.values(agrupamento).reverse();
    setPontosAgrupados(todosPontos);
    setDataMinimaLog(`01/${mes}/${ano}`);
    if (maiorDataEncontrada) setDataMaximaLog(maiorDataEncontrada.toLocaleDateString('pt-BR')); else setDataMaximaLog(`${mes}/${ano}`);
    
    const resumo = Object.keys(totaisMinutosMes).map(nome => {
      const totalMins = totaisMinutosMes[nome];
      const diasDoFuncionario = todosPontos.filter(p => p.nome === nome);
      return { nome, cargo: diasDoFuncionario[0]?.cargo || 'Não definido', totalMinutos: totalMins, horasFormatadas: `${Math.floor(totalMins / 60)}h ${(totalMins % 60).toString().padStart(2, '0')}m`, logs: diasDoFuncionario };
    });
    setResumoMensal(resumo);
    setCarregando(false);
  };

  const fecharFolhaDoMes = async () => {
    if(!window.confirm(`ATENÇÃO GESTOR:\nVocê está prestes a FECHAR a folha de ${mesFiltro} para TODOS os colaboradores.\nIsso enviará o espelho de ponto deste mês para todos assinarem digitalmente pelo aplicativo.\n\nTem certeza que os registros estão corretos?`)) return;
    setCarregando(true);
    const inserts = funcionarios.map(f => ({ funcionario_id: f.id, mes_ano: mesFiltro, status: 'pendente' }));
    const { error } = await supabase.from('folhas_pagamento').upsert(inserts, { onConflict: 'funcionario_id, mes_ano', ignoreDuplicates: true });
    if(error) alert('Erro ao fechar a folha: ' + error.message); else alert('Folha fechada com sucesso! Os colaboradores foram notificados.');
    buscarDados();
  };

  const fecharFolhaIndividual = async (funcionarioId, funcionarioNome) => {
    if(!window.confirm(`ATENÇÃO GESTOR:\nVocê está prestes a FECHAR a folha de ${mesFiltro} APENAS para o colaborador(a) ${funcionarioNome}.\n\nTem certeza que os registros deste funcionário estão corretos?`)) return;
    setCarregando(true);
    const { error } = await supabase.from('folhas_pagamento').upsert({
      funcionario_id: funcionarioId,
      mes_ano: mesFiltro,
      status: 'pendente'
    }, { onConflict: 'funcionario_id, mes_ano', ignoreDuplicates: true });
    
    if(error) alert('Erro ao fechar a folha: ' + error.message); 
    else alert(`Folha de ${funcionarioNome} fechada e enviada para assinatura!`);
    
    buscarDados();
  };

  const enviarRelatorioGeralWhats = () => {
    const [ano, mes] = mesFiltro.split('-'); let texto = `*📊 RELATÓRIO MENSAL DE HORAS - ${mes}/${ano}*\n\n`;
    resumoMensal.forEach(r => { texto += `👤 *${r.nome}* (${r.cargo})\n⏱️ Total: *${r.horasFormatadas}*\n\n`; });
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(texto + '_Gerado via PontoSeguro._')}`, '_blank');
  };

  const enviarExtratoIndividualWhats = (funcionario) => {
    const [ano, mes] = mesFiltro.split('-');
    let texto = `*📄 EXTRATO DE HORAS - COMPETÊNCIA ${mes}/${ano}*\n\n*Colaborador:* ${funcionario.nome}\n*Total Acumulado:* ${funcionario.horasFormatadas}\n\n*Detalhamento:*\n`;
    funcionario.logs.forEach(l => { texto += `📅 ${l.data} | 🟢 ${l.entrada ? l.entrada.hora : '-'} | 🔴 ${l.saida ? l.saida.hora : '-'} (${l.minutosTrabalhadosDia > 0 ? `${Math.floor(l.minutosTrabalhadosDia / 60)}h` : '-'})\n`; });
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(texto)}`, '_blank');
  };

  const lancarPontoManual = async (e) => {
    e.preventDefault(); 
    setCarregando(true);

    const dataInicio = new Date(`${formManual.data}T00:00:00`).toISOString();
    const dataFim = new Date(`${formManual.data}T23:59:59`).toISOString();

    const { data: registrosExistentes } = await supabase
      .from('registros_ponto')
      .select('id')
      .eq('funcionario_id', formManual.funcionario_id)
      .gte('data_hora', dataInicio)
      .lte('data_hora', dataFim);

    // === ATUALIZADO: Remoção cirúrgica pelas IDs exatas ===
    if (registrosExistentes && registrosExistentes.length > 0) {
      const confirma = window.confirm(`⚠️ ATENÇÃO!\n\nJá existem batidas de ponto registradas para este colaborador na data informada.\n\nDeseja SUBSTITUIR todos os pontos deste dia pelos novos horários (Entrada: ${formManual.hora_entrada} e Saída: ${formManual.hora_saida})?`);
      
      if (!confirma) {
        setCarregando(false);
        return;
      }

      const idsParaDeletar = registrosExistentes.map(r => r.id);
      
      const { error: deleteError } = await supabase
        .from('registros_ponto')
        .delete()
        .in('id', idsParaDeletar);

      if (deleteError) {
        alert("Erro ao remover os pontos antigos: " + deleteError.message);
        setCarregando(false);
        return;
      }
    }

    const dataIsoEntrada = new Date(`${formManual.data}T${formManual.hora_entrada}:00`).toISOString();
    const dataIsoSaida = new Date(`${formManual.data}T${formManual.hora_saida}:00`).toISOString();

    const batidasMassa = [
      { funcionario_id: formManual.funcionario_id, tipo_registro: 'entrada', data_hora: dataIsoEntrada, obra_nome: formManual.obra_nome },
      { funcionario_id: formManual.funcionario_id, tipo_registro: 'saida', data_hora: dataIsoSaida, obra_nome: formManual.obra_nome }
    ];

    const { error } = await supabase.from('registros_ponto').insert(batidasMassa);

    if (!error) { 
      setModalAberto(false);
      setFormManual({ funcionario_id: '', data: '', hora_entrada: '07:00', hora_saida: '17:00', obra_nome: 'Lançamento Manual / Base' });
      buscarDados(); 
    } else { 
      alert("Erro ao lançar pontos."); 
    }
    setCarregando(false);
  };

  const buscarCoordenadasPorEndereco = async () => {
    if (!formObra.buscaEndereco) return;
    setBuscandoEndereco(true);
    try {
      const data = await (await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(formObra.buscaEndereco)}&limit=5`)).json();
      if (data.features?.length > 0) setResultadosBusca(data.features); else { alert('Endereço não localizado.'); setResultadosBusca([]); }
    } catch (err) { alert('Erro de conexão com o satélite.'); }
    setBuscandoEndereco(false);
  };

  const pegarLocalizacaoParaObra = () => navigator.geolocation.getCurrentPosition((pos) => setFormObra({...formObra, gps: `${pos.coords.latitude.toFixed(6)},${pos.coords.longitude.toFixed(6)}`}), () => alert("Permita o uso do GPS."));

  const salvarNovaObra = async (e) => {
    e.preventDefault(); setCarregando(true);
    const { error } = await supabase.from('obras').insert({ nome: formObra.nome, localizacao_gps: formObra.gps });
    if (!error) { setFormObra({ nome: '', gps: '', buscaEndereco: '' }); buscarDados(); } else alert(`Erro ao cadastrar obra.`);
  };

  const apagarObra = async (idObra) => {
    if(!window.confirm('Tem certeza?')) return;
    setObrasList(prev => prev.filter(obra => obra.id !== idObra));
    await supabase.from('obras').delete().eq('id', idObra); buscarDados();
  };

  return (
    <div className="min-h-screen bg-[#020617] font-['Inter'] text-slate-100">
      
      <style>
        {`
            html, body { touch-action: pan-y; overscroll-behavior-y: none; -webkit-user-select: none; user-select: none; }
            input, select, textarea { font-size: 16px !important; -webkit-user-select: auto; user-select: auto; }

            @media print {
              @page { size: ${extratoSelecionado ? 'A4 portrait' : certificadoSelecionado ? 'A4 portrait' : 'A4 landscape'}; margin: 10mm; }
              html, body, #root, main, .min-h-screen { background: white !important; color: black !important; display: block !important; width: 100% !important; margin: 0 !important; padding: 0 !important; box-sizing: border-box !important; }
              * { -webkit-print-color-adjust: exact; print-color-adjust: exact; box-shadow: none !important; color: black !important; }
              header, .tela-interativa, .modais-extracao { display: none !important; }
              .area-impressao { display: block !important; position: relative !important; width: 100% !important; background: white !important; padding: 10mm !important; box-sizing: border-box !important; }
              
              .pdf-table { width: 100% !important; border-collapse: collapse !important; margin-top: 15px !important; table-layout: fixed !important; }
              .pdf-table th { border: 1px solid #cbd5e1 !important; padding: 6px 8px !important; font-size: 9px !important; background-color: #f1f5f9 !important; text-transform: uppercase !important; font-weight: bold !important; text-align: left !important; }
              .pdf-table td { border: 1px solid #cbd5e1 !important; padding: 6px 8px !important; font-size: 10px !important; word-wrap: break-word !important; }
              
              thead { display: table-header-group !important; }
              tr { page-break-inside: avoid !important; page-break-after: auto !important; }
              
              .pdf-title { font-family: 'Montserrat', sans-serif !important; font-weight: bold !important; font-size: 16px !important; margin: 0 0 5px 0 !important; text-transform: uppercase !important; border-bottom: 2px solid #cbd5e1 !important; padding-bottom: 8px !important; }
              .pdf-subtitle { font-size: 10px !important; color: #475569 !important; margin: 6px 0 15px 0 !important; }
              .pdf-section { font-family: 'Montserrat', sans-serif !important; font-weight: bold !important; font-size: 11px !important; border-bottom: 1px solid #cbd5e1 !important; padding-bottom: 4px !important; margin-top: 20px !important; margin-bottom: 8px !important; text-transform: uppercase !important; }
              .pdf-box { border: 1px solid #cbd5e1 !important; padding: 10px !important; margin-top: 15px !important; display: flex !important; justify-content: space-between !important; background-color: #f8fafc !important; }

              .certificado-container { border: 4px double #1e293b !important; padding: 40px !important; border-radius: 10px !important; }
              .certificado-header { text-align: center !important; margin-bottom: 30px !important; }
              .certificado-body { line-height: 1.8 !important; font-size: 12px !important; margin-bottom: 30px !important; text-align: justify !important;}
              .certificado-hash { font-family: monospace !important; background: #f1f5f9 !important; padding: 15px !important; border: 1px solid #cbd5e1 !important; word-wrap: break-word !important; font-size: 10px !important; }
            }
        `}
      </style>

      <div className="modais-extracao">
        {fotoExpandida && (
          <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"><div className="relative max-w-xl w-full flex flex-col items-center"><button onClick={() => setFotoExpandida(null)} className="absolute -top-12 right-0 p-3 bg-slate-800 hover:bg-slate-700 rounded-full text-white z-50"><X size={24} /></button><img src={fotoExpandida} alt="Auditoria" className="w-full h-auto max-h-[80vh] object-cover rounded-2xl border-4 border-slate-700" /></div></div>
        )}

        {certificadoSelecionado && (
          <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 print:hidden">
            <div className="bg-[#0f172a] border border-slate-700 rounded-2xl w-full max-w-2xl p-8 shadow-2xl relative">
              <button onClick={() => setCertificadoSelecionado(null)} className="absolute top-4 right-4 text-slate-400 hover:text-white p-2 hover:bg-slate-800 rounded-lg transition-colors"><X size={24} /></button>
              <div className="flex flex-col items-center mb-6 border-b border-slate-800 pb-6"><ShieldCheck size={48} className="text-emerald-500 mb-3" /><h2 className="text-2xl font-bold font-['Montserrat'] text-white text-center">Auditoria de Assinatura Eletrônica</h2><p className="text-sm text-slate-400">Laudo Técnico de Validade Jurídica (Lei 14.063/2020)</p></div>
              <div className="space-y-4 mb-8">
                <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800"><span className="block text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-1">Assinado por</span><div className="flex justify-between items-center"><span className="text-lg font-bold text-slate-200">{certificadoSelecionado.nomeFuncionario}</span><span className="font-mono text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded border border-emerald-500/20">CPF: {certificadoSelecionado.cpfFuncionario}</span></div></div>
                <div className="grid grid-cols-2 gap-4"><div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800"><span className="block text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-1">Competência (Folha)</span><span className="font-bold text-slate-200">{certificadoSelecionado.folha.mes_ano.split('-')[1]}/{certificadoSelecionado.folha.mes_ano.split('-')[0]}</span></div><div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800"><span className="block text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-1">Data/Hora da Assinatura</span><span className="font-bold text-slate-200">{new Date(certificadoSelecionado.folha.data_assinatura).toLocaleString('pt-BR')}</span></div></div>
                <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 space-y-2"><div><span className="block text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-0.5">Rastreabilidade de Rede (IP)</span><span className="font-mono text-xs text-blue-400">{certificadoSelecionado.folha.ip_assinatura || 'Não registrado'}</span></div><div><span className="block text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-0.5 mt-2">Coordenada GPS no momento do aceite</span><span className="font-mono text-xs text-blue-400">{certificadoSelecionado.folha.gps_assinatura || 'Não registrado'}</span></div></div>
                <div className="bg-[#020617] p-4 rounded-xl border border-slate-700"><span className="block text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1 flex items-center gap-1.5"><Lock size={12}/> Hash Criptográfico (Imutabilidade)</span><span className="font-mono text-[10px] text-slate-300 break-all">{certificadoSelecionado.folha.hash_auditoria}</span></div>
              </div>
              <div className="flex gap-4"><button onClick={() => setCertificadoSelecionado(null)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold py-4 rounded-xl transition-colors">Voltar</button><button onClick={() => window.print()} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-blue-900/20 flex justify-center items-center gap-2"><FileText size={18}/> Imprimir Laudo</button></div>
            </div>
          </div>
        )}

        {extratoSelecionado && (
          <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 print:hidden">
            <div className="bg-[#0f172a] border border-slate-700 rounded-3xl w-full max-w-3xl p-6 md:p-8 shadow-2xl relative max-h-[95vh] overflow-y-auto custom-scrollbar">
              <div className="flex justify-between items-center mb-6 border-b border-slate-800 pb-4"><h2 className="text-xl md:text-2xl font-bold font-['Montserrat'] text-white">Demonstrativo Individual</h2><button onClick={() => setExtratoSelecionado(null)} className="absolute top-4 right-4 text-slate-400 hover:text-white p-3 rounded-xl hover:bg-slate-800 transition-colors z-50"><X size={24} /></button></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 bg-slate-900/50 p-5 rounded-2xl border border-slate-800 mt-2"><div><span className="block text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">Colaborador</span><span className="font-bold text-slate-200 text-lg">{extratoSelecionado.nome}</span></div><div><span className="block text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">Função / Cargo</span><span className="font-bold text-slate-200 text-lg">{extratoSelecionado.cargo}</span></div></div>
              
              <div className="border border-slate-800 rounded-2xl overflow-hidden mb-6 shadow-lg">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse min-w-[600px]">
                    <thead>
                      <tr className="bg-slate-900/80 border-b border-slate-800">
                        <th className="p-4 text-slate-400 font-semibold uppercase text-xs tracking-wider whitespace-nowrap">Data</th>
                        <th className="p-4 text-slate-400 font-semibold uppercase text-xs tracking-wider">Obra / Local</th>
                        <th className="p-4 text-slate-400 font-semibold uppercase text-xs tracking-wider">Entrada</th>
                        <th className="p-4 text-slate-400 font-semibold uppercase text-xs tracking-wider">Saída</th>
                        <th className="p-4 text-slate-400 font-semibold uppercase text-xs tracking-wider">Intervalo</th>
                        <th className="p-4 text-slate-400 font-semibold uppercase text-xs tracking-wider text-right">Jornada</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {extratoSelecionado.logs.map((l, i) => (
                        <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                          <td className="p-4 font-medium text-slate-200 whitespace-nowrap">{l.data}</td>
                          <td className="p-4 text-[11px] text-blue-400 font-medium"><span className="flex items-center gap-1.5"><Building2 size={12}/> {l.entrada?.obra || l.saida?.obra || '-'}</span></td>
                          <td className="p-4 text-emerald-400 font-bold">{l.entrada ? l.entrada.hora : '-'}</td>
                          <td className="p-4 text-slate-300 font-bold">{l.saida ? l.saida.hora : '-'}</td>
                          <td className="p-4 text-slate-400 text-xs">{l.descontouAlmoco ? '12:00 às 13:00' : 'Sem pausa'}</td>
                          <td className="p-4 font-mono font-bold text-right text-blue-400">
                            {l.minutosTrabalhadosDia > 0 ? `${Math.floor(l.minutosTrabalhadosDia / 60)}h ${(l.minutosTrabalhadosDia % 60).toString().padStart(2, '0')}m` : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="flex justify-between items-center bg-gradient-to-r from-slate-900 to-[#0f172a] p-5 rounded-2xl border border-blue-900/30 mb-8 shadow-inner"><span className="text-sm font-bold text-slate-400 uppercase tracking-wider">Saldo Acumulado:</span><span className="text-3xl font-black text-blue-400 font-mono">{extratoSelecionado.horasFormatadas}</span></div>
              
              {extratoSelecionado.folha?.status === 'assinado' && (
                <div className="mb-8 p-5 bg-emerald-950/30 border-2 border-emerald-500/50 rounded-xl flex items-start gap-4">
                  <Fingerprint size={40} className="text-emerald-500 shrink-0" />
                  <div>
                    <h4 className="text-emerald-400 font-bold uppercase tracking-wider text-sm mb-1">Documento Assinado Eletronicamente</h4>
                    <p className="text-xs text-slate-300 mb-1">Assinado por <strong className="text-white">{extratoSelecionado.nome}</strong> no dia {new Date(extratoSelecionado.folha.data_assinatura).toLocaleString('pt-BR')}.</p>
                    <p className="text-[10px] text-slate-500 font-mono break-all mt-2">Hash da Transação: {extratoSelecionado.folha.hash_auditoria}</p>
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3"><button onClick={() => setExtratoSelecionado(null)} className="w-full sm:w-auto px-6 flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white font-bold py-4 rounded-xl transition-all border border-slate-700"><ArrowLeft size={20} /> Voltar</button><button onClick={() => window.print()} className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-blue-900/20"><FileText size={20} /> Imprimir PDF</button><button onClick={() => enviarExtratoIndividualWhats(extratoSelecionado)} className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-emerald-900/20"><Send size={20} /> Enviar p/ WhatsApp</button></div>
            </div>
          </div>
        )}

        {modalAberto && (
          <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 print:hidden">
            <div className="bg-[#0f172a] border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
              <button onClick={() => setModalAberto(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white p-3 rounded-xl hover:bg-slate-800 transition-colors z-50"><X size={20} /></button>
              <h2 className="text-xl font-bold mb-6 font-['Montserrat'] mt-2">Lançamento Manual</h2>
              <form onSubmit={lancarPontoManual} className="flex flex-col gap-4">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Colaborador</label>
                  <select required value={formManual.funcionario_id} onChange={e => setFormManual({...formManual, funcionario_id: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-white focus:border-emerald-500 outline-none">
                    <option value="">Selecione...</option>
                    {funcionarios.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                  </select>
                </div>
                
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="text-xs text-slate-400 mb-1 block">Data da Batida</label>
                    <input type="date" required value={formManual.data} onChange={e => setFormManual({...formManual, data: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-white [color-scheme:dark] focus:border-emerald-500 outline-none" />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-slate-400 mb-1 block">Obra / Local</label>
                    <select required value={formManual.obra_nome} onChange={e => setFormManual({...formManual, obra_nome: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-white focus:border-emerald-500 outline-none">
                      <option value="Lançamento Manual / Base">Manual / Base</option>
                      {obrasList.map(o => <option key={o.id} value={o.nome}>{o.nome}</option>)}
                    </select>
                  </div>
                </div>

                <div className="flex gap-4 mt-2">
                  <div className="flex-1">
                    <label className="text-xs text-slate-400 mb-1 block">Hora da Entrada</label>
                    <input type="time" required value={formManual.hora_entrada} onChange={e => setFormManual({...formManual, hora_entrada: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-white [color-scheme:dark] focus:border-emerald-500 outline-none" />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-slate-400 mb-1 block">Hora da Saída</label>
                    <input type="time" required value={formManual.hora_saida} onChange={e => setFormManual({...formManual, hora_saida: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-white [color-scheme:dark] focus:border-emerald-500 outline-none" />
                  </div>
                </div>

                <button type="submit" disabled={carregando} className="mt-4 w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl transition-colors">
                  {carregando ? <Loader2 className="animate-spin mx-auto" size={20} /> : 'Registrar Dia Completo'}
                </button>
              </form>
            </div>
          </div>
        )}

        {modalObraAberto && (
          <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 print:hidden">
            <div className="bg-[#0f172a] border border-slate-700 rounded-3xl w-full max-w-4xl p-6 md:p-8 shadow-2xl relative flex flex-col md:flex-row gap-8 max-h-[90vh] overflow-y-auto">
              <button onClick={() => setModalObraAberto(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white p-3 rounded-xl hover:bg-slate-800 transition-colors z-50"><X size={24} /></button>
              <div className="flex-1 md:border-r border-slate-800 pb-6 md:pb-0 md:pr-8 mt-4 md:mt-0">
                <h2 className="text-2xl font-bold mb-2 font-['Montserrat'] text-white flex items-center gap-2"><Building2 size={24} className="text-blue-400" /> Gestão de Obras</h2>
                <form onSubmit={salvarNovaObra} className="flex flex-col gap-4">
                  <div><label className="text-xs text-slate-400 mb-1.5 block font-semibold uppercase tracking-wider">Nome</label><input type="text" required value={formObra.nome} onChange={e => setFormObra({...formObra, nome: e.target.value})} className="w-full bg-[#020617] border border-slate-700 rounded-xl p-3.5 text-sm text-white focus:border-blue-500 outline-none transition-colors" /></div>
                  <div className="relative">
                    <label className="text-xs text-slate-400 mb-1.5 block font-semibold uppercase tracking-wider">Buscar Endereço</label>
                    <div className="flex gap-2 relative">
                      <input type="text" value={formObra.buscaEndereco || ''} onChange={e => { setFormObra({...formObra, buscaEndereco: e.target.value}); if (e.target.value === '') setResultadosBusca([]); }} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); buscarCoordenadasPorEndereco(); } }} className="flex-1 bg-[#020617] border border-slate-700 rounded-xl p-3.5 text-sm text-white focus:border-blue-500 outline-none transition-colors" />
                      <button type="button" onClick={buscarCoordenadasPorEndereco} disabled={buscandoEndereco || !formObra.buscaEndereco} className="bg-blue-600 hover:bg-blue-500 text-white px-5 rounded-xl transition-all shadow-md disabled:opacity-50 flex items-center justify-center shrink-0">{buscandoEndereco ? <Loader2 size={20} className="animate-spin" /> : <Search size={20} />}</button>
                    </div>
                    {resultadosBusca.length > 0 && (
                      <div className="absolute top-full left-0 w-full mt-2 bg-[#1e293b] border border-slate-600 rounded-xl shadow-2xl z-50 overflow-hidden">
                        <ul className="max-h-48 overflow-y-auto py-2">
                          {resultadosBusca.map((end, i) => (
                            <li key={i} onClick={() => { setFormObra({...formObra, gps: `${end.geometry.coordinates[1].toFixed(6)},${end.geometry.coordinates[0].toFixed(6)}`, buscaEndereco: end.properties.name}); setResultadosBusca([]); }} className="p-3.5 text-xs text-slate-300 hover:bg-blue-600/20 cursor-pointer">{end.properties.name}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  <button type="button" onClick={pegarLocalizacaoParaObra} className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 py-3.5 rounded-xl text-sm font-semibold transition-all shadow-sm"><Navigation size={18} className="text-emerald-400" /> Usar meu GPS atual</button>
                  <div><label className="text-xs text-slate-500 mb-1.5 block font-medium uppercase tracking-wider">Coordenada Matemática</label><input type="text" required value={formObra.gps} onChange={e => setFormObra({...formObra, gps: e.target.value})} className="w-full bg-[#020617]/50 border border-slate-800 rounded-xl p-3.5 text-sm text-blue-400 font-mono outline-none" /></div>
                  <button type="submit" disabled={carregando} className="mt-2 w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-emerald-900/20">Cadastrar Obra</button>
                </form>
              </div>
              <div className="flex-1 flex flex-col mt-4 md:mt-0">
                <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2">Obras Ativas ({obrasList.length})</h3>
                <div className="flex flex-col gap-3 max-h-[450px] overflow-y-auto pr-2 custom-scrollbar">
                  {obrasList.map(obra => (
                    <div key={obra.id} className="bg-slate-900/80 hover:bg-slate-800/80 border border-slate-700/60 rounded-xl p-4 flex justify-between items-center transition-colors group"><div className="overflow-hidden"><span className="block text-sm font-bold text-slate-100 truncate">{obra.nome}</span><span className="block text-[11px] text-slate-400 font-mono mt-1"><MapPin size={10} className="inline text-blue-500" /> {obra.localizacao_gps}</span></div><button type="button" onClick={() => apagarObra(obra.id)} className="p-2.5 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white rounded-lg transition-colors ml-3"><Trash2 size={16} /></button></div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="tela-interativa p-4 md:p-8 max-w-[1200px] mx-auto relative z-10">
        <div className="block">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-5">
            <div><h1 className="font-['Montserrat'] text-2xl md:text-3xl font-bold text-white mb-1">Painel de Fechamento</h1><p className="text-slate-400 text-sm">Gestão de horas, equipe e auditoria de assinaturas.</p></div>
            <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 w-full md:w-auto">
              <button onClick={fecharFolhaDoMes} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm rounded-xl transition-all shadow-lg shadow-blue-900/30"><FileSignature size={18} /> Fechar Mês Geral</button>
              <button onClick={() => setModalAberto(true)} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700/60 font-semibold text-sm rounded-xl transition-all shadow-sm"><Plus size={18} /> Ponto Manual</button>
              <button onClick={() => setModalObraAberto(true)} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/60 font-semibold text-sm rounded-xl transition-all shadow-sm"><Building2 size={18} /> Obras</button>
              <button onClick={() => { setExtratoSelecionado(null); setTimeout(() => window.print(), 100); }} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/60 font-semibold text-sm rounded-xl transition-all shadow-sm"><FileText size={18} /> PDF Geral</button>
            </div>
          </div>

          <div className="mb-8">
            <div className="bg-[#0f172a] border border-slate-700 rounded-2xl p-5 md:w-1/3 shadow-xl mb-6"><label className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 block">Filtro de Competência (Mês/Ano)</label><input type="month" value={mesFiltro} onChange={(e) => setMesFiltro(e.target.value)} className="w-full bg-slate-900 border-2 border-slate-600 hover:border-slate-500 text-slate-100 font-semibold text-lg p-3.5 rounded-xl focus:border-emerald-500 outline-none transition-colors [color-scheme:dark]" /></div>
            
            <div className="bg-[#0f172a]/80 border border-slate-800 rounded-2xl shadow-xl overflow-hidden mb-8">
              <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-900/50"><h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2"><ShieldCheck size={18} className="text-emerald-500" /> Controle de Folha e Assinaturas</h3></div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[800px]">
                  <thead>
                    <tr className="bg-slate-900/80 border-b border-slate-800"><th className="p-4 text-slate-400 text-xs font-semibold uppercase tracking-wider">Colaborador</th><th className="p-4 text-slate-400 text-xs font-semibold uppercase tracking-wider text-center">Horas no Mês</th><th className="p-4 text-slate-400 text-xs font-semibold uppercase tracking-wider text-center">Status da Folha</th><th className="p-4 text-slate-400 text-xs font-semibold uppercase tracking-wider text-right">Ações</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40">
                    {funcionarios.length === 0 ? ( <tr><td colSpan="4" className="p-8 text-center text-slate-500">Nenhum funcionário cadastrado no sistema ainda.</td></tr> ) : (
                      funcionarios.map(func => {
                        const resumo = resumoMensal.find(r => r.nome === func.nome);
                        const horas = resumo ? resumo.horasFormatadas : '0h 00m';
                        const folhaDB = folhasPagamento.find(f => f.funcionario_id === func.id);
                        
                        let badgeStatus = <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-400 border border-slate-700/50"><Clock size={12} /> Não Fechada</span>;
                        if (folhaDB) {
                          if (folhaDB.status === 'pendente') badgeStatus = <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20"><AlertTriangle size={12} /> Aguardando Assinatura</span>;
                          else if (folhaDB.status === 'assinado') badgeStatus = <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"><Fingerprint size={12} /> Assinado Digitalmente</span>;
                        }

                        return (
                          <tr key={func.id} className="hover:bg-slate-800/30 transition-colors">
                            <td className="p-4"><span className="font-bold text-slate-200 block">{func.nome}</span><span className={`text-[10px] font-mono mt-1 block ${func.cpf ? 'text-slate-400' : 'text-red-400 font-bold'}`}>{func.cpf ? `CPF: ${func.cpf}` : 'SEM CPF CADASTRADO NO APP'}</span></td>
                            <td className="p-4 text-blue-400 font-mono font-bold text-center text-lg">{horas}</td>
                            <td className="p-4 text-center">{badgeStatus}</td>
                            <td className="p-4 text-right">
                              
                              <div className="flex justify-end gap-2">
                                {!folhaDB && resumo && (
                                  <button onClick={() => fecharFolhaIndividual(func.id, func.nome)} title="Fechar Folha Individualmente" className="px-3 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/30 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors flex items-center gap-2">
                                    <Lock size={14} /> Fechar
                                  </button>
                                )}

                                {resumo && (
                                  <button onClick={() => setExtratoSelecionado({ ...resumo, folha: folhaDB })} title={folhaDB?.status === 'assinado' ? "Ver Folha Assinada" : "Ver Espelho Mensal"} className={`px-3 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-2 ${folhaDB?.status === 'assinado' ? 'bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30' : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'}`}>
                                    <FileText size={14} /> {folhaDB?.status === 'assinado' ? 'Folha Assinada' : 'Ver Folha'}
                                  </button>
                                )}
                                {folhaDB?.status === 'assinado' && (
                                  <button onClick={() => setCertificadoSelecionado({ folha: folhaDB, nomeFuncionario: func.nome, cpfFuncionario: func.cpf })} title="Ver Laudo Técnico de Auditoria" className="px-3 py-2 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 border border-emerald-500/30 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors flex items-center gap-2 shadow-sm">
                                    <ShieldCheck size={14} /> Laudo
                                  </button>
                                )}
                              </div>

                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="bg-[#0f172a]/60 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-900/30"><h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Espelho de Ponto Geral Diário</h3></div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-slate-900/70 border-b border-slate-800">
                    <th className="p-5 text-slate-400 text-xs font-semibold uppercase tracking-wider">Colaborador / Obra</th>
                    <th className="p-5 text-slate-400 text-xs font-semibold uppercase tracking-wider whitespace-nowrap">Data</th>
                    <th className="p-5 text-slate-400 text-xs font-semibold uppercase tracking-wider">Entrada</th>
                    <th className="p-5 text-slate-400 text-xs font-semibold uppercase tracking-wider">Saída</th>
                    <th className="p-5 text-slate-400 text-xs font-semibold uppercase tracking-wider">Intervalo</th>
                    <th className="p-5 text-slate-400 text-xs font-semibold uppercase tracking-wider text-right">Jornada Diária</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {pontosAgrupados.map((linha, index) => (
                    <tr key={index} className="hover:bg-slate-800/30 transition-colors">
                      <td className="p-5"><div className="font-medium text-slate-200 text-sm">{linha.nome}</div><div className="text-[10px] text-blue-400 font-medium flex items-center gap-1 mt-1"><Building2 size={10} /> {linha.entrada?.obra || linha.saida?.obra || 'Não especificada'}</div></td>
                      <td className="p-5 text-slate-400 text-sm font-mono whitespace-nowrap">{linha.data}</td>
                      <td className="p-5">{linha.entrada ? ( <div className="flex items-start gap-3">{linha.entrada.foto && <img src={linha.entrada.foto} alt="Selfie" onClick={() => setFotoExpandida(linha.entrada.foto)} className="w-10 h-10 rounded-full object-cover border-2 border-slate-700 cursor-pointer shrink-0" />}<div className="flex flex-col gap-1.5"><span className="font-semibold text-emerald-400 text-base">{linha.entrada.hora}</span>{linha.entrada.gps && <BadgeLocalizacao gps={linha.entrada.gps} />}</div></div> ) : <span className="text-slate-700">-</span>}</td>
                      <td className="p-5">{linha.saida ? ( <div className="flex items-start gap-3">{linha.saida.foto && <img src={linha.saida.foto} alt="Selfie" onClick={() => setFotoExpandida(linha.saida.foto)} className="w-10 h-10 rounded-full object-cover border-2 border-slate-700 cursor-pointer shrink-0" />}<div className="flex flex-col gap-1.5"><span className="font-semibold text-slate-300 text-base">{linha.saida.hora}</span>{linha.saida.gps && <BadgeLocalizacao gps={linha.saida.gps} />}</div></div> ) : <span className="text-xs bg-amber-500/10 text-amber-400 px-2.5 py-1 rounded-full font-medium">Em andamento</span>}</td>
                      <td className="p-5 text-slate-400 text-xs">{linha.descontouAlmoco ? '12:00 às 13:00' : 'Sem pausa'}</td>
                      <td className="p-5 text-right">
                        {linha.minutosTrabalhadosDia > 0 ? ( 
                          <span className="inline-flex items-center gap-1 bg-slate-900 text-blue-400 px-3 py-1.5 rounded-lg text-sm font-mono font-bold border border-slate-800">
                            {Math.floor(linha.minutosTrabalhadosDia / 60)}h {(linha.minutosTrabalhadosDia % 60).toString().padStart(2, '0')}m
                          </span> 
                        ) : <span className="text-slate-600">-</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <div className="hidden print:block area-impressao font-sans text-black">
        {certificadoSelecionado ? (
          <div className="certificado-container">
            <div className="certificado-header">
              <h1 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '24px', fontWeight: '900', borderBottom: '2px solid black', paddingBottom: '10px', marginBottom: '10px' }}>CERTIFICADO DE ASSINATURA ELETRÔNICA</h1>
              <p style={{ fontSize: '12px', fontWeight: 'bold' }}>Documento de validade jurídica amparado pela Medida Provisória nº 2.200-2/2001 e Lei 14.063/2020.</p>
            </div>
            <div className="certificado-body">
              <p>O presente documento certifica, para todos os fins de direito e comprovação junto a Justiça do Trabalho, que o colaborador abaixo identificado validou, conferiu e <strong>ASSINOU ELETRONICAMENTE</strong> o espelho de controle de jornada (Folha de Ponto) referente à competência descrita.</p>
              <div style={{ marginTop: '30px', padding: '20px', border: '1px solid #ccc', background: '#f9f9f9' }}>
                <p><strong>COLABORADOR:</strong> {certificadoSelecionado.nomeFuncionario}</p>
                <p><strong>CPF DO ASSINANTE:</strong> {certificadoSelecionado.cpfFuncionario}</p>
                <p><strong>COMPETÊNCIA DA FOLHA:</strong> {certificadoSelecionado.folha.mes_ano}</p>
                <hr style={{ margin: '15px 0' }}/>
                <p><strong>DATA E HORA DO ACEITE (Servidor UTC-3):</strong> {new Date(certificadoSelecionado.folha.data_assinatura).toLocaleString('pt-BR')}</p>
                <p><strong>RASTREAMENTO DE REDE (IP):</strong> {certificadoSelecionado.folha.ip_assinatura}</p>
                <p><strong>COORDENADA GEOGRÁFICA (GPS):</strong> {certificadoSelecionado.folha.gps_assinatura}</p>
              </div>
            </div>
            <div style={{ marginTop: '40px' }}><p style={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '5px' }}>Chave Criptográfica de Imutabilidade (Hash SHA-256):</p><div className="certificado-hash">{certificadoSelecionado.folha.hash_auditoria}</div></div>
          </div>
        ) : extratoSelecionado ? (
          <div>
            <h1 className="pdf-title">DEMONSTRATIVO INDIVIDUAL DE JORNADA</h1>
            <p className="pdf-subtitle">Competência Fiscal: <strong>{mesFiltro.split('-')[1]}/{mesFiltro.split('-')[0]}</strong></p>
            <div className="pdf-section">1. Dados do Colaborador</div>
            <table className="pdf-table" style={{ marginTop: '5px', marginBottom: '20px' }}><thead><tr><th style={{ width: '50%' }}>Colaborador</th><th style={{ width: '50%' }}>Função / Cargo</th></tr></thead><tbody><tr><td style={{ fontWeight: 'bold', fontSize: '12px' }}>{extratoSelecionado.nome}</td><td style={{ fontWeight: 'bold', fontSize: '12px' }}>{extratoSelecionado.cargo}</td></tr></tbody></table>
            <div className="pdf-section">2. Espelho de Ponto Detalhado</div>
            <table className="pdf-table" style={{ marginTop: '5px' }}>
              <thead>
                <tr>
                  <th style={{ width: '12%', whiteSpace: 'nowrap' }}>Data</th>
                  <th style={{ width: '33%' }}>Obra Local</th>
                  <th style={{ width: '12%' }}>Entrada</th>
                  <th style={{ width: '12%' }}>Saída</th>
                  <th style={{ width: '16%' }}>Intervalo</th>
                  <th style={{ width: '15%', textAlign: 'right' }}>Total Diário</th>
                </tr>
              </thead>
              <tbody>
                {extratoSelecionado.logs.map((l, i) => ( 
                  <tr key={i}>
                    <td style={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>{l.data}</td>
                    <td>{l.entrada?.obra || l.saida?.obra || '-'}</td>
                    <td>{l.entrada ? l.entrada.hora : '-'}</td>
                    <td>{l.saida ? l.saida.hora : '-'}</td>
                    <td style={{ fontSize: '10px' }}>{l.descontouAlmoco ? '12:00 às 13:00' : 'Sem pausa'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold', fontFamily: 'monospace', fontSize: '11px' }}>
                      {l.minutosTrabalhadosDia > 0 ? `${Math.floor(l.minutosTrabalhadosDia / 60)}h ${(l.minutosTrabalhadosDia % 60).toString().padStart(2, '0')}m` : '-'}
                    </td>
                  </tr> 
                ))}
              </tbody>
            </table>
            <div className="pdf-box"><span style={{ fontWeight: 'bold', textTransform: 'uppercase', fontSize: '11px' }}>Saldo Acumulado:</span><span style={{ fontSize: '14px', fontWeight: 'bold', fontFamily: 'monospace' }}>{extratoSelecionado.horasFormatadas}</span></div>
            
            {extratoSelecionado.folha?.status === 'assinado' && (
              <div style={{ marginTop: '30px', padding: '15px', border: '2px solid #10b981', borderRadius: '8px', backgroundColor: '#ecfdf5', color: '#065f46' }}>
                <h4 style={{ margin: '0 0 10px 0', textTransform: 'uppercase', fontSize: '12px' }}>✓ Documento Assinado Eletronicamente</h4>
                <p style={{ margin: '0', fontSize: '10px' }}><strong>Assinante:</strong> {extratoSelecionado.nome} (CPF cadastrado no sistema)</p>
                <p style={{ margin: '5px 0 0 0', fontSize: '10px' }}><strong>Data/Hora:</strong> {new Date(extratoSelecionado.folha.data_assinatura).toLocaleString('pt-BR')}</p>
                <p style={{ margin: '5px 0 0 0', fontSize: '10px' }}><strong>Chave de Autenticidade (Hash):</strong> {extratoSelecionado.folha.hash_auditoria}</p>
                <p style={{ margin: '5px 0 0 0', fontSize: '10px' }}><strong>Auditoria Completa:</strong> Ver Laudo Técnico anexo.</p>
              </div>
            )}
          </div>
        ) : (
          <div>
            <h1 className="pdf-title">RELATÓRIO GERENCIAL DE FECHAMENTO</h1>
            <p className="pdf-subtitle">Apuração do Sistema: <strong>{dataMinimaLog}</strong> até <strong>{dataMaximaLog}</strong></p>
            <div className="pdf-section">1. Resumo Consolidado de Horas (Banco Mensal)</div>
            <table className="pdf-table" style={{ marginTop: '5px', marginBottom: '20px' }}><thead><tr><th style={{ width: '50%' }}>Nome do Colaborador</th><th style={{ width: '30%' }}>Função Registrada</th><th style={{ width: '20%', textAlign: 'right' }}>Carga Horária Total</th></tr></thead><tbody>{resumoMensal.map((r, i) => ( <tr key={i}><td style={{ fontWeight: 'bold' }}>{r.nome}</td><td>{r.cargo}</td><td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold', fontSize: '12px' }}>{r.horasFormatadas}</td></tr> ))}</tbody></table>
            <div className="pdf-section">2. Espelho de Ponto Detalhado Geral</div>
            <table className="pdf-table" style={{ marginTop: '5px' }}>
              <thead>
                <tr>
                  <th style={{ width: '22%' }}>Colaborador / Obra</th>
                  <th style={{ width: '12%', whiteSpace: 'nowrap' }}>Data</th>
                  <th style={{ width: '12%' }}>Entrada</th>
                  <th style={{ width: '12%' }}>Saída</th>
                  <th style={{ width: '22%' }}>Intervalo</th>
                  <th style={{ width: '20%', textAlign: 'right' }}>Total Dia</th>
                </tr>
              </thead>
              <tbody>
                {pontosAgrupados.map((linha, index) => ( 
                  <tr key={index}>
                    <td style={{ fontWeight: 'bold' }}>{linha.nome}<div style={{ fontSize: '9px', color: '#475569', marginTop: '2px', fontWeight: 'normal' }}>{linha.entrada?.obra || linha.saida?.obra || ''}</div></td>
                    <td style={{ whiteSpace: 'nowrap' }}>{linha.data}</td>
                    <td>{linha.entrada ? linha.entrada.hora : '-'}</td>
                    <td>{linha.saida ? linha.saida.hora : (linha.minutosTrabalhadosDia === 0 ? 'Em andamento' : '-')}</td>
                    <td style={{ fontSize: '10px' }}>{linha.descontouAlmoco ? '12:00 às 13:00' : 'Sem pausa'}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold' }}>
                      {linha.minutosTrabalhadosDia > 0 ? `${Math.floor(linha.minutosTrabalhadosDia / 60)}h ${(linha.minutosTrabalhadosDia % 60).toString().padStart(2, '0')}m` : '-'}
                    </td>
                  </tr> 
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}