// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { RefreshCw, MapPin, Plus, X, FileText, Send, Share2, Eye, AlertTriangle } from 'lucide-react';

// Meu componente para renderizar o endereço na tabela
const BadgeLocalizacao = ({ gps }) => {
  const [endereco, setEndereco] = useState('Buscando...');
  useEffect(() => {
    if (!gps) return;
    const [lat, lon] = gps.split(',');
    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`)
      .then(res => res.json())
      .then(data => {
        const rua = data.address?.road || data.address?.suburb;
        const cidade = data.address?.city || data.address?.town;
        if (rua && cidade) setEndereco(`${rua}, ${cidade}`);
        else if (rua) setEndereco(rua);
        else setEndereco('📍 Mapa');
      }).catch(() => setEndereco('📍 Mapa'));
  }, [gps]);

  return (
    <a href={`https://www.google.com/maps/?q=${gps}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-2 py-1 bg-slate-800/50 hover:bg-slate-700 text-blue-400 rounded text-[11px] font-medium transition-colors border border-slate-700/50 print:hidden mt-1">
      <MapPin size={12} className="shrink-0" /> <span className="truncate max-w-[150px]">{endereco}</span>
    </a>
  );
};

export default function Dashboard() {
  const [pontosAgrupados, setPontosAgrupados] = useState([]);
  const [resumoMensal, setResumoMensal] = useState([]);
  const [funcionarios, setFuncionarios] = useState([]);
  const [carregando, setCarregando] = useState(true);
  
  const [dataMinimaLog, setDataMinimaLog] = useState('');
  const [dataMaximaLog, setDataMaximaLog] = useState('');
  
  const [fotoExpandida, setFotoExpandida] = useState(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [extratoSelecionado, setExtratoSelecionado] = useState(null); 
  const [formManual, setFormManual] = useState({ funcionario_id: '', data: '', hora: '', tipo_registro: 'entrada' });

  const dataAtual = new Date();
  const mesFiltroPadrao = `${dataAtual.getFullYear()}-${String(dataAtual.getMonth() + 1).padStart(2, '0')}`;
  const [mesFiltro, setMesFiltro] = useState(mesFiltroPadrao);

  useEffect(() => { buscarDados(); }, [mesFiltro]);

  const buscarDados = async () => {
    setCarregando(true);
    const { data: perfis } = await supabase.from('perfis').select('id, nome, funcao').order('nome');
    if (perfis) setFuncionarios(perfis);

    const [ano, mes] = mesFiltro.split('-');
    const dataInicio = new Date(ano, mes - 1, 1).toISOString();
    const dataFim = new Date(ano, mes, 0, 23, 59, 59).toISOString();

    const { data, error } = await supabase
      .from('registros_ponto')
      .select('id, tipo_registro, data_hora, foto_url, localizacao_gps, funcionario_id, perfis ( nome, funcao )')
      .gte('data_hora', dataInicio)
      .lte('data_hora', dataFim)
      .order('data_hora', { ascending: true });

    if (error) { console.error(error); setCarregando(false); return; }

    const agrupamento = {};
    const totaisMinutosMes = {};
    let maiorDataEncontrada = null;

    data.forEach((ponto) => {
      const dataObj = new Date(ponto.data_hora);
      const dataLocal = dataObj.toLocaleDateString('pt-BR');
      const horaLocal = dataObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const nomeFuncionario = ponto.perfis?.nome || 'Desconhecido';
      const cargoFuncionario = ponto.perfis?.funcao || 'Não definida';
      const chave = `${nomeFuncionario}-${dataLocal}`;

      if (!maiorDataEncontrada || dataObj > maiorDataEncontrada) {
        maiorDataEncontrada = dataObj;
      }

      if (!agrupamento[chave]) {
        agrupamento[chave] = {
          nome: nomeFuncionario, cargo: cargoFuncionario, data: dataLocal, 
          entrada: ponto.tipo_registro === 'entrada' ? { hora: horaLocal, gps: ponto.localizacao_gps, foto: ponto.foto_url, rawIso: ponto.data_hora } : null,
          saida: ponto.tipo_registro === 'saida' ? { hora: horaLocal, gps: ponto.localizacao_gps, foto: ponto.foto_url, rawIso: ponto.data_hora } : null,
          minutosTrabalhadosDia: 0,
          divergente: false
        };
      } else {
        if (ponto.tipo_registro === 'entrada') agrupamento[chave].entrada = { hora: horaLocal, gps: ponto.localizacao_gps, foto: ponto.foto_url, rawIso: ponto.data_hora };
        if (ponto.tipo_registro === 'saida') agrupamento[chave].saida = { hora: horaLocal, gps: ponto.localizacao_gps, foto: ponto.foto_url, rawIso: ponto.data_hora };
      }

      if (agrupamento[chave].entrada && agrupamento[chave].saida) {
        const ms = new Date(agrupamento[chave].saida.rawIso).getTime() - new Date(agrupamento[chave].entrada.rawIso).getTime();
        const minutos = Math.max(0, Math.floor(ms / 60000));
        agrupamento[chave].minutosTrabalhadosDia = minutos;
        totaisMinutosMes[nomeFuncionario] = (totaisMinutosMes[nomeFuncionario] || 0) + minutos;

        if (agrupamento[chave].entrada.gps && agrupamento[chave].saida.gps) {
          if (agrupamento[chave].entrada.gps.trim() !== agrupamento[chave].saida.gps.trim()) {
            agrupamento[chave].divergente = true;
          }
        }
      }
    });

    const todosPontos = Object.values(agrupamento).reverse();
    setPontosAgrupados(todosPontos);
    
    setDataMinimaLog(`01/${mes}/${ano}`);
    if (maiorDataEncontrada) {
      setDataMaximaLog(maiorDataEncontrada.toLocaleDateString('pt-BR'));
    } else {
      setDataMaximaLog(`${mes}/${ano}`);
    }
    
    const resumo = Object.keys(totaisMinutosMes).map(nome => {
      const totalMins = totaisMinutosMes[nome];
      const diasDoFuncionario = todosPontos.filter(p => p.nome === nome);
      return { 
        nome, 
        cargo: diasDoFuncionario[0]?.cargo || 'Não definido',
        totalMinutos: totalMins,
        horasFormatadas: `${Math.floor(totalMins / 60)}h ${(totalMins % 60).toString().padStart(2, '0')}m`,
        logs: diasDoFuncionario
      };
    });
    setResumoMensal(resumo);
    setCarregando(false);
  };

  const enviarRelatorioGeralWhats = () => {
    const [ano, mes] = mesFiltro.split('-');
    let texto = `*📊 RELATÓRIO MENSAL DE HORAS - ${mes}/${ano}*\n\n`;
    resumoMensal.forEach(r => {
      texto += `👤 *${r.nome}* (${r.cargo})\n⏱️ Total: *${r.horasFormatadas}*\n\n`;
    });
    texto += `_Gerado automaticamente via PontoSeguro._`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(texto)}`, '_blank');
  };

  const enviarExtratoIndividualWhats = (funcionario) => {
    const [ano, mes] = mesFiltro.split('-');
    let texto = `*📄 EXTRATO DE HORAS - COMPETÊNCIA ${mes}/${ano}*\n\n`;
    texto += `*Colaborador:* ${funcionario.nome}\n`;
    texto += `*Função:* ${funcionario.cargo}\n`;
    texto += `*Total Acumulado:* ${funcionario.horasFormatadas}\n\n`;
    texto += `*Detalhamento de Jornadas:*\n`;
    funcionario.logs.forEach(l => {
      const entrada = l.entrada ? l.entrada.hora : '-';
      const saida = l.saida ? l.saida.hora : '-';
      const totalDia = l.minutosTrabalhadosDia > 0 ? `${Math.floor(l.minutosTrabalhadosDia / 60)}h` : '-';
      texto += `📅 ${l.data} | 🟢 C: ${entrada} | 🔴 S: ${saida} (${totalDia})\n`;
    });
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(texto)}`, '_blank');
  };

  const lancarPontoManual = async (e) => {
    e.preventDefault();
    setCarregando(true);
    const dataIso = new Date(`${formManual.data}T${formManual.hora}:00`).toISOString();
    const { error } = await supabase.from('registros_ponto').insert({
      funcionario_id: formManual.funcionario_id,
      tipo_registro: formManual.tipo_registro,
      data_hora: dataIso
    });
    if (!error) { setModalAberto(false); buscarDados(); } 
    else { alert("Erro ao lançar ponto."); setCarregando(false); }
  };

  return (
    <div className="min-h-screen bg-[#020617] font-['Inter'] text-slate-100">
      
      {/* O MEU TRATOR CSS DE IMPRESSÃO CONTINUA AQUI INTACTO */}
      <style>
        {`@media print {
            @page { size: ${extratoSelecionado ? 'A4 portrait' : 'A4 landscape'}; margin: 12mm; }
            html, body, #root, #root > div, main { display: block !important; width: 100% !important; max-width: none !important; height: auto !important; min-height: 0 !important; margin: 0 !important; padding: 0 !important; background: white !important; color: black !important; overflow: visible !important; position: static !important; }
            * { box-shadow: none !important; transition: none !important; }
            header, .tela-interativa { display: none !important; }
            .area-impressao { display: block !important; position: absolute !important; top: 0 !important; left: 0 !important; width: 100% !important; background: white !important; color: black !important; }
            .pdf-table { width: 100% !important; border-collapse: collapse !important; margin-top: 15px !important; table-layout: fixed !important; }
            .pdf-table th { background-color: #f8fafc !important; border: 1px solid #94a3b8 !important; padding: 10px !important; font-size: 11px !important; text-transform: uppercase !important; color: black !important; font-weight: bold !important; text-align: left !important; }
            .pdf-table td { border: 1px solid #cbd5e1 !important; padding: 10px !important; font-size: 12px !important; color: black !important; word-wrap: break-word !important; }
            tr { page-break-inside: avoid !important; }
            .pdf-title { font-family: 'Montserrat', sans-serif !important; font-weight: bold !important; font-size: 22px !important; margin: 0 0 5px 0 !important; color: black !important; text-transform: uppercase !important; }
            .pdf-subtitle { font-size: 13px !important; color: #334155 !important; margin: 0 0 20px 0 !important; }
            .pdf-section { font-family: 'Montserrat', sans-serif !important; font-weight: bold !important; font-size: 14px !important; color: black !important; border-bottom: 2px solid black !important; padding-bottom: 4px !important; margin-top: 30px !important; margin-bottom: 10px !important; }
        }`}
      </style>

      {/* =================================================================================
          DIMENSÃO DA TELA (MOBILE-FIRST APLICADO AQUI)
          ================================================================================= */}
      <div className="tela-interativa p-4 md:p-8 max-w-[1200px] mx-auto relative z-10">
        
        {/* Modais Escuros (Intactos) */}
        {fotoExpandida && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="relative max-w-xl w-full flex flex-col items-center">
              <button onClick={() => setFotoExpandida(null)} className="absolute -top-12 right-0 p-2 bg-slate-800 hover:bg-slate-700 rounded-full text-white"><X size={24} /></button>
              <img src={fotoExpandida} alt="Auditoria" className="w-full h-auto max-h-[80vh] object-cover rounded-2xl border-4 border-slate-700" />
            </div>
          </div>
        )}

        {modalAberto && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-[#0f172a] border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
              <button onClick={() => setModalAberto(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X size={20} /></button>
              <h2 className="text-xl font-bold mb-6 font-['Montserrat']">Lançamento Manual</h2>
              <form onSubmit={lancarPontoManual} className="flex flex-col gap-4">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Colaborador</label>
                  <select required onChange={e => setFormManual({...formManual, funcionario_id: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-white focus:border-emerald-500 outline-none">
                    <option value="">Selecione...</option>
                    {funcionarios.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                  </select>
                </div>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="text-xs text-slate-400 mb-1 block">Data</label>
                    <input type="date" required onChange={e => setFormManual({...formManual, data: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-white [color-scheme:dark] focus:border-emerald-500 outline-none" />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-slate-400 mb-1 block">Hora</label>
                    <input type="time" required onChange={e => setFormManual({...formManual, hora: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-white [color-scheme:dark] focus:border-emerald-500 outline-none" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Tipo de Batida</label>
                  <select required onChange={e => setFormManual({...formManual, tipo_registro: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-white focus:border-emerald-500 outline-none">
                    <option value="entrada">Entrada</option>
                    <option value="saida">Saída</option>
                  </select>
                </div>
                <button type="submit" className="mt-6 w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl transition-colors">Confirmar Lançamento</button>
              </form>
            </div>
          </div>
        )}

        {extratoSelecionado && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
            <div className="bg-[#0f172a] border border-slate-800 rounded-3xl w-full max-w-2xl p-6 md:p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6 border-b border-slate-800 pb-4">
                <h2 className="text-xl font-bold font-['Montserrat'] text-white">Demonstrativo de Jornada</h2>
                <button onClick={() => setExtratoSelecionado(null)} className="text-slate-400 hover:text-white"><X size={22} /></button>
              </div>
              <div className="border border-slate-800 rounded-2xl p-6 mb-6 bg-slate-900/50">
                <div className="flex justify-between items-start mb-6 border-b border-slate-800 pb-4">
                  <div>
                    <h3 className="font-['Montserrat'] font-bold text-lg text-white">RECIBO DE HORAS TRABALHADAS</h3>
                    <p className="text-xs text-slate-400">Competência Fiscal: {mesFiltro.split('-')[1]}/{mesFiltro.split('-')[0]}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded">Auditado</span>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 text-sm">
                  <div>
                    <span className="block text-xs text-slate-500 font-medium">Colaborador</span>
                    <span className="font-semibold text-slate-200">{extratoSelecionado.nome}</span>
                  </div>
                  <div>
                    <span className="block text-xs text-slate-500 font-medium">Função / Cargo</span>
                    <span className="font-semibold text-slate-200">{extratoSelecionado.cargo}</span>
                  </div>
                </div>
                <div className="border border-slate-800 rounded-xl overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse min-w-[500px]">
                    <thead>
                      <tr className="bg-slate-950/60 border-b border-slate-800">
                        <th className="p-3 text-slate-400 font-semibold">Data</th>
                        <th className="p-3 text-slate-400 font-semibold">Entrada</th>
                        <th className="p-3 text-slate-400 font-semibold">Saída</th>
                        <th className="p-3 text-slate-400 font-semibold text-right">Total Dia</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {extratoSelecionado.logs.map((l, i) => (
                        <tr key={i}>
                          <td className="p-3 font-medium">{l.data}</td>
                          <td className="p-3 text-emerald-400">{l.entrada ? l.entrada.hora : '-'}</td>
                          <td className="p-3 text-slate-400">{l.saida ? l.saida.hora : '-'}</td>
                          <td className="p-3 font-mono font-bold text-right">
                            {l.minutosTrabalhadosDia > 0 ? `${Math.floor(l.minutosTrabalhadosDia / 60)}h ${(l.minutosTrabalhadosDia % 60).toString().padStart(2, '0')}m` : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-6 flex justify-between items-center bg-slate-950/40 p-4 rounded-xl border border-slate-800/60">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Saldo Total:</span>
                  <span className="text-xl font-black text-blue-400 font-mono">{extratoSelecionado.horasFormatadas}</span>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <button onClick={() => window.print()} className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-xl transition-colors text-sm">
                  <FileText size={18} /> Imprimir Recibo
                </button>
                <button onClick={() => enviarExtratoIndividualWhats(extratoSelecionado)} className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl transition-colors text-sm">
                  <Send size={18} /> Enviar p/ WhatsApp
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Dashboard Base */}
        <div className={extratoSelecionado ? 'hidden' : 'block'}>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-5">
            <div>
              <h1 className="font-['Montserrat'] text-2xl md:text-3xl font-bold text-white mb-1">Painel de Fechamento</h1>
              <p className="text-slate-400 text-sm">Gestão de horas e auditoria de equipe.</p>
            </div>
            
            {/* AQUI ESTÁ A MÁGICA DOS BOTÕES! No celular eles viram uma coluna empilhada, no PC ficam lado a lado */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
              <button onClick={() => setModalAberto(true)} className="flex items-center justify-center gap-2 px-5 py-3.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-900/50 font-semibold text-sm rounded-xl transition-all">
                <Plus size={18} /> Lançar Ponto
              </button>
              <button onClick={() => { setExtratoSelecionado(null); setTimeout(() => window.print(), 100); }} className="flex items-center justify-center gap-2 px-5 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm rounded-xl transition-all shadow-lg shadow-blue-900/20">
                <FileText size={18} /> Gerar PDF Mensal
              </button>
              <button onClick={enviarRelatorioGeralWhats} className="flex items-center justify-center gap-2 px-5 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm rounded-xl transition-all shadow-lg shadow-emerald-900/20">
                <Share2 size={18} /> Disparar Whats Geral
              </button>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-6 mb-8">
            <div className="bg-[#0f172a] border border-slate-700 rounded-2xl p-5 md:w-1/3 shadow-xl">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 block">Competência (Mês/Ano)</label>
              <input 
                type="month" 
                value={mesFiltro} 
                onChange={(e) => setMesFiltro(e.target.value)} 
                className="w-full bg-slate-900 border-2 border-slate-600 hover:border-slate-500 text-slate-100 font-semibold text-lg p-3.5 rounded-xl focus:border-emerald-500 outline-none transition-colors [color-scheme:dark]" 
              />
            </div>
            
            <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-5 flex-1 shadow-xl">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Totalizadores Acumulados da Competência</h3>
              {resumoMensal.length === 0 ? (
                <span className="text-sm text-slate-600">Nenhum registro consolidado neste mês.</span>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {resumoMensal.map((resumo, idx) => (
                    <div key={idx} className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl flex justify-between items-center group hover:border-slate-600 transition-colors">
                      <div>
                        <span className="block text-sm font-bold text-slate-200">{resumo.nome}</span>
                        <span className="block text-[11px] text-slate-400 mt-0.5">{resumo.cargo}</span>
                        <span className="block text-xl font-black text-blue-400 font-mono mt-2">{resumo.horasFormatadas}</span>
                      </div>
                      <button onClick={() => setExtratoSelecionado(resumo)} title="Ver Demonstrativo Detalhado" className="p-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-300 hover:text-white border border-slate-700/60 shadow-sm transition-all">
                        <Eye size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* AQUI ESTÁ A MÁGICA DA TABELA! Adicionei o overflow-x-auto e min-w-[800px] */}
          <div className="bg-[#0f172a]/60 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-slate-900/70 border-b border-slate-800">
                    <th className="p-5 text-slate-400 text-xs font-semibold uppercase tracking-wider">Colaborador</th>
                    <th className="p-5 text-slate-400 text-xs font-semibold uppercase tracking-wider">Data</th>
                    <th className="p-5 text-slate-400 text-xs font-semibold uppercase tracking-wider">Entrada</th>
                    <th className="p-5 text-slate-400 text-xs font-semibold uppercase tracking-wider">Saída</th>
                    <th className="p-5 text-slate-400 text-xs font-semibold uppercase tracking-wider">Jornada</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {pontosAgrupados.map((linha, index) => (
                    <tr key={index} className="hover:bg-slate-800/30 transition-colors">
                      <td className="p-5 font-medium text-slate-200 text-sm">{linha.nome}</td>
                      <td className="p-5 text-slate-400 text-sm font-mono">{linha.data}</td>
                      <td className="p-5">
                        {linha.entrada ? (
                          <div className="flex items-start gap-3">
                            {linha.entrada.foto && <img src={linha.entrada.foto} alt="Selfie" onClick={() => setFotoExpandida(linha.entrada.foto)} className="w-10 h-10 rounded-full object-cover border-2 border-slate-700 cursor-pointer hover:border-emerald-500 transition-all shrink-0" />}
                            <div className="flex flex-col gap-1.5">
                              <span className="font-semibold text-emerald-400 text-base">{linha.entrada.hora}</span>
                              {linha.entrada.gps && <BadgeLocalizacao gps={linha.entrada.gps} />}
                              {!linha.entrada.gps && <span className="text-[10px] text-amber-500 border border-amber-900 px-1.5 py-0.5 rounded uppercase font-bold tracking-wide w-max">Lançamento Manual</span>}
                            </div>
                          </div>
                        ) : <span className="text-slate-700">-</span>}
                      </td>
                      <td className="p-5">
                        {linha.saida ? (
                          <div className="flex items-start gap-3">
                            {linha.saida.foto && <img src={linha.saida.foto} alt="Selfie" onClick={() => setFotoExpandida(linha.saida.foto)} className="w-10 h-10 rounded-full object-cover border-2 border-slate-700 cursor-pointer hover:border-blue-500 transition-all shrink-0" />}
                            <div className="flex flex-col gap-1.5">
                              <span className="font-semibold text-slate-300 text-base">{linha.saida.hora}</span>
                              {linha.saida.gps && <BadgeLocalizacao gps={linha.saida.gps} />}
                              {!linha.saida.gps && <span className="text-[10px] text-amber-500 border border-amber-900 px-1.5 py-0.5 rounded uppercase font-bold tracking-wide w-max">Lançamento Manual</span>}
                              {linha.divergente && (
                                <span className="inline-flex items-center gap-1 text-[10px] bg-red-500/20 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded font-bold animate-pulse uppercase tracking-wide">
                                  <AlertTriangle size={12} /> Local Divergente
                                </span>
                              )}
                            </div>
                          </div>
                        ) : <span className="text-xs bg-amber-500/10 text-amber-400 px-2.5 py-1 rounded-full font-medium">Em andamento</span>}
                      </td>
                      <td className="p-5">
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

      {/* =================================================================================
          DIMENSÃO DO PAPEL (O HTML de impressão continua idêntico, intocável e blindado)
          ================================================================================= */}
      <div className="hidden print:block area-impressao font-sans text-black bg-white">
        
        {extratoSelecionado ? (
          <div style={{ padding: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '2px solid black', paddingBottom: '10px', marginBottom: '20px' }}>
              <div>
                <h1 className="pdf-title">DEMONSTRATIVO DE JORNADA</h1>
                <p className="pdf-subtitle">Competência Fiscal: <strong>{mesFiltro.split('-')[1]}/{mesFiltro.split('-')[0]}</strong></p>
              </div>
              <div style={{ border: '2px solid black', padding: '5px 12px', fontWeight: 'bold', fontSize: '11px', letterSpacing: '1px' }}>
                DOCUMENTO AUDITADO
              </div>
            </div>

            <div style={{ display: 'flex', gap: '40px', marginBottom: '20px' }}>
              <div>
                <span style={{ fontSize: '11px', color: '#555', textTransform: 'uppercase', fontWeight: 'bold' }}>Colaborador</span>
                <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{extratoSelecionado.nome}</div>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: '#555', textTransform: 'uppercase', fontWeight: 'bold' }}>Função / Cargo</span>
                <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{extratoSelecionado.cargo}</div>
              </div>
            </div>

            <table className="pdf-table">
              <thead>
                <tr>
                  <th style={{ width: '25%' }}>Data da Jornada</th>
                  <th style={{ width: '25%' }}>Registro de Entrada</th>
                  <th style={{ width: '25%' }}>Registro de Saída</th>
                  <th style={{ width: '25%', textAlign: 'right' }}>Total Diário</th>
                </tr>
              </thead>
              <tbody>
                {extratoSelecionado.logs.map((l, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 'bold' }}>{l.data}</td>
                    <td>{l.entrada ? l.entrada.hora : '-'}</td>
                    <td>{l.saida ? l.saida.hora : '-'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold', fontFamily: 'monospace', fontSize: '14px' }}>
                      {l.minutosTrabalhadosDia > 0 ? `${Math.floor(l.minutosTrabalhadosDia / 60)}h ${(l.minutosTrabalhadosDia % 60).toString().padStart(2, '0')}m` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ marginTop: '20px', backgroundColor: '#f8fafc', padding: '15px', border: '1px solid black', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 'bold', textTransform: 'uppercase', fontSize: '12px' }}>Saldo Total Acumulado no Período:</span>
              <span style={{ fontSize: '20px', fontWeight: 'bold', fontFamily: 'monospace' }}>{extratoSelecionado.horasFormatadas}</span>
            </div>
          </div>
        ) : (
          <div style={{ padding: '10px' }}>
            <div style={{ borderBottom: '3px solid black', paddingBottom: '12px', marginBottom: '20px' }}>
              <h1 className="pdf-title">RELATÓRIO GERENCIAL DE FECHAMENTO DE PONTO</h1>
              <p className="pdf-subtitle">
                Período de Apuração Sistêmica: <strong>{dataMinimaLog}</strong> até <strong>{dataMaximaLog}</strong>
              </p>
            </div>

            <div className="pdf-section">1. Resumo Consolidado de Horas (Banco Mensal)</div>
            <table className="pdf-table">
              <thead>
                <tr>
                  <th style={{ width: '40%' }}>Nome do Colaborador</th>
                  <th style={{ width: '40%' }}>Função Registrada</th>
                  <th style={{ width: '20%', textAlign: 'right' }}>Carga Horária Total</th>
                </tr>
              </thead>
              <tbody>
                {resumoMensal.map((r, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 'bold' }}>{r.nome}</td>
                    <td>{r.cargo}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold', fontSize: '14px' }}>{r.horasFormatadas}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="pdf-section" style={{ marginTop: '40px' }}>2. Espelho de Ponto Detalhado (Log de Auditoria)</div>
            <table className="pdf-table">
              <thead>
                <tr>
                  <th style={{ width: '20%' }}>Colaborador</th>
                  <th style={{ width: '15%' }}>Data</th>
                  <th style={{ width: '20%' }}>Horário de Entrada</th>
                  <th style={{ width: '25%' }}>Horário de Saída</th>
                  <th style={{ width: '20%', textAlign: 'right' }}>Total Dia</th>
                </tr>
              </thead>
              <tbody>
                {pontosAgrupados.map((linha, index) => (
                  <tr key={index}>
                    <td style={{ fontWeight: 'bold' }}>{linha.nome}</td>
                    <td>{linha.data}</td>
                    <td>
                      {linha.entrada ? linha.entrada.hora : '-'} 
                      {!linha.entrada?.gps && linha.entrada ? ' (Lançamento Manual)' : ''}
                    </td>
                    <td>
                      {linha.saida ? linha.saida.hora : (linha.minutosTrabalhadosDia === 0 ? 'Em andamento' : '-')}
                      {!linha.saida?.gps && linha.saida ? ' (Lançamento Manual)' : ''}
                      {linha.divergente ? ' [ATENÇÃO: LOCAL DIVERGENTE]' : ''}
                    </td>
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