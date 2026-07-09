// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { RefreshCw, MapPin, Plus, X, FileText, Send, Share2, Eye, AlertTriangle, Building2, Trash2, Search, Navigation, Loader2 } from 'lucide-react';

const BadgeLocalizacao = ({ gps }) => {
  const [endereco, setEndereco] = useState('Buscando...');
  
  useEffect(() => {
    if (!gps) return;
    const [lat, lon] = gps.split(',');
    
    fetch(`https://photon.komoot.io/reverse?lon=${lon}&lat=${lat}`)
      .then(res => res.json())
      .then(data => {
        if (data.features && data.features.length > 0) {
          const props = data.features[0].properties;
          const rua = props.street || props.name;
          const cidade = props.city || props.town || props.state;
          if (rua && cidade) setEndereco(`${rua}, ${cidade}`);
          else if (rua) setEndereco(rua);
          else setEndereco('Ver no mapa');
        } else { setEndereco('Ver no mapa'); }
      }).catch(() => setEndereco('Ver no mapa')); 
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
  const [obrasList, setObrasList] = useState([]); 
  const [carregando, setCarregando] = useState(true);
  
  const [dataMinimaLog, setDataMinimaLog] = useState('');
  const [dataMaximaLog, setDataMaximaLog] = useState('');
  
  const [fotoExpandida, setFotoExpandida] = useState(null);
  const [modalAberto, setModalAberto] = useState(false); 
  const [modalObraAberto, setModalObraAberto] = useState(false); 
  const [extratoSelecionado, setExtratoSelecionado] = useState(null); 
  
  const [buscandoEndereco, setBuscandoEndereco] = useState(false);
  const [resultadosBusca, setResultadosBusca] = useState([]); 
  
  const [formManual, setFormManual] = useState({ funcionario_id: '', data: '', hora: '', tipo_registro: 'entrada', obra_nome: 'Lançamento Manual / Base' });
  const [formObra, setFormObra] = useState({ nome: '', gps: '', buscaEndereco: '' });

  const dataAtual = new Date();
  const mesFiltroPadrao = `${dataAtual.getFullYear()}-${String(dataAtual.getMonth() + 1).padStart(2, '0')}`;
  const [mesFiltro, setMesFiltro] = useState(mesFiltroPadrao);

  useEffect(() => { buscarDados(); }, [mesFiltro]);

  const buscarDados = async () => {
    setCarregando(true);
    const { data: perfis } = await supabase.from('perfis').select('id, nome, funcao').order('nome');
    if (perfis) setFuncionarios(perfis);

    const { data: obrasData } = await supabase.from('obras').select('*').order('nome');
    if (obrasData) setObrasList(obrasData);

    const [ano, mes] = mesFiltro.split('-');
    const dataInicio = new Date(ano, mes - 1, 1).toISOString();
    const dataFim = new Date(ano, mes, 0, 23, 59, 59).toISOString();

    const { data, error } = await supabase
      .from('registros_ponto')
      .select('id, tipo_registro, data_hora, foto_url, localizacao_gps, funcionario_id, obra_nome, perfis ( nome, funcao )')
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

      if (!maiorDataEncontrada || dataObj > maiorDataEncontrada) { maiorDataEncontrada = dataObj; }

      if (!agrupamento[chave]) {
        agrupamento[chave] = {
          nome: nomeFuncionario, cargo: cargoFuncionario, data: dataLocal, 
          entrada: ponto.tipo_registro === 'entrada' ? { hora: horaLocal, gps: ponto.localizacao_gps, foto: ponto.foto_url, rawIso: ponto.data_hora, obra: ponto.obra_nome } : null,
          saida: ponto.tipo_registro === 'saida' ? { hora: horaLocal, gps: ponto.localizacao_gps, foto: ponto.foto_url, rawIso: ponto.data_hora, obra: ponto.obra_nome } : null,
          minutosTrabalhadosDia: 0, descontouAlmoco: false, divergente: false
        };
      } else {
        if (ponto.tipo_registro === 'entrada') agrupamento[chave].entrada = { hora: horaLocal, gps: ponto.localizacao_gps, foto: ponto.foto_url, rawIso: ponto.data_hora, obra: ponto.obra_nome };
        if (ponto.tipo_registro === 'saida') agrupamento[chave].saida = { hora: horaLocal, gps: ponto.localizacao_gps, foto: ponto.foto_url, rawIso: ponto.data_hora, obra: ponto.obra_nome };
      }

      if (agrupamento[chave].entrada && agrupamento[chave].saida) {
        const dtEntrada = new Date(agrupamento[chave].entrada.rawIso);
        const dtSaida = new Date(agrupamento[chave].saida.rawIso);
        const ms = dtSaida.getTime() - dtEntrada.getTime();
        let minutos = Math.max(0, Math.floor(ms / 60000));
        const horaEntradaDec = dtEntrada.getHours() + (dtEntrada.getMinutes() / 60);
        const horaSaidaDec = dtSaida.getHours() + (dtSaida.getMinutes() / 60);

        if (horaEntradaDec <= 12.0 && horaSaidaDec >= 13.0) {
          minutos -= 60;
          agrupamento[chave].descontouAlmoco = true;
        }

        agrupamento[chave].minutosTrabalhadosDia = minutos;
        totaisMinutosMes[nomeFuncionario] = (totaisMinutosMes[nomeFuncionario] || 0) + minutos;

        if (agrupamento[chave].entrada.gps && agrupamento[chave].saida.gps) {
          if (agrupamento[chave].entrada.gps.trim() !== agrupamento[chave].saida.gps.trim()) agrupamento[chave].divergente = true;
        }
      }
    });

    const todosPontos = Object.values(agrupamento).reverse();
    setPontosAgrupados(todosPontos);
    setDataMinimaLog(`01/${mes}/${ano}`);
    if (maiorDataEncontrada) setDataMaximaLog(maiorDataEncontrada.toLocaleDateString('pt-BR'));
    else setDataMaximaLog(`${mes}/${ano}`);
    
    const resumo = Object.keys(totaisMinutosMes).map(nome => {
      const totalMins = totaisMinutosMes[nome];
      const diasDoFuncionario = todosPontos.filter(p => p.nome === nome);
      return { 
        nome, cargo: diasDoFuncionario[0]?.cargo || 'Não definido', totalMinutos: totalMins,
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
    resumoMensal.forEach(r => { texto += `👤 *${r.nome}* (${r.cargo})\n⏱️ Total: *${r.horasFormatadas}*\n\n`; });
    texto += `_Gerado via PontoSeguro._`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(texto)}`, '_blank');
  };

  const enviarExtratoIndividualWhats = (funcionario) => {
    const [ano, mes] = mesFiltro.split('-');
    let texto = `*📄 EXTRATO DE HORAS - COMPETÊNCIA ${mes}/${ano}*\n\n*Colaborador:* ${funcionario.nome}\n*Função:* ${funcionario.cargo}\n*Total Acumulado:* ${funcionario.horasFormatadas}\n\n*Detalhamento:*\n`;
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
      funcionario_id: formManual.funcionario_id, tipo_registro: formManual.tipo_registro, data_hora: dataIso, obra_nome: formManual.obra_nome
    });
    if (!error) { setModalAberto(false); buscarDados(); } else { alert("Erro ao lançar."); setCarregando(false); }
  };

  const buscarCoordenadasPorEndereco = async () => {
    if (!formObra.buscaEndereco) { alert("Digite o nome da rua e cidade!"); return; }
    setBuscandoEndereco(true);
    try {
      const response = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(formObra.buscaEndereco)}&limit=5`);
      const data = await response.json();
      if (data.features && data.features.length > 0) setResultadosBusca(data.features); 
      else { alert('Endereço não localizado.'); setResultadosBusca([]); }
    } catch (err) { alert('Erro de conexão com o satélite.'); }
    setBuscandoEndereco(false);
  };

  const pegarLocalizacaoParaObra = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => setFormObra({...formObra, gps: `${pos.coords.latitude.toFixed(6)},${pos.coords.longitude.toFixed(6)}`}),
      (err) => alert("Permita o uso do GPS no navegador.")
    );
  };

  const salvarNovaObra = async (e) => {
    e.preventDefault();
    setCarregando(true);
    const { error } = await supabase.from('obras').insert({ nome: formObra.nome, localizacao_gps: formObra.gps });
    if (!error) { setFormObra({ nome: '', gps: '', buscaEndereco: '' }); buscarDados(); } 
    else { alert(`Erro ao cadastrar obra.`); }
    setCarregando(false);
  };

  const apagarObra = async (idObra) => {
    if(!window.confirm('Tem certeza que deseja remover esta Obra?')) return;
    setObrasList(prev => prev.filter(obra => obra.id !== idObra));
    const { error } = await supabase.from('obras').delete().eq('id', idObra);
    if (error) { alert(`O banco bloqueou: ${error.message}`); buscarDados(); }
  };

  return (
    <div className="min-h-screen bg-[#020617] font-['Inter'] text-slate-100">
      
      {/* MEU TRATOR CSS: O Bloqueio da Margem Esquerda de Impressão foi injetado aqui */}
      <style>
        {`
            html, body {
              touch-action: pan-y;
              overscroll-behavior-y: none;
              -webkit-user-select: none;
              user-select: none;
            }
            input, select, textarea {
              font-size: 16px !important; 
              -webkit-user-select: auto;
              user-select: auto;
            }

            @media print {
              @page { size: ${extratoSelecionado ? 'A4 portrait' : 'A4 landscape'}; margin: 15mm; }
              html, body, #root, main, .min-h-screen { 
                background: white !important; 
                color: black !important; 
                display: block !important; 
                width: 100% !important; 
                margin: 0 !important; 
                padding: 0 !important; 
                box-sizing: border-box !important;
              }
              * { 
                -webkit-print-color-adjust: exact; 
                print-color-adjust: exact; 
                box-shadow: none !important; 
                color: black !important; 
              }
              header, .tela-interativa { display: none !important; }
              
              /* A mágica do padding forçado resolve o problema da margem colada na esquerda */
              .area-impressao { 
                display: block !important; 
                position: relative !important; 
                width: 100% !important; 
                background: white !important; 
                padding: 10mm 20mm !important; 
                box-sizing: border-box !important;
              }
              
              .pdf-table { width: 100% !important; border-collapse: collapse !important; margin-top: 15px !important; table-layout: auto !important; }
              .pdf-table th { border: 1px solid #cbd5e1 !important; padding: 10px !important; font-size: 10px !important; background-color: #f1f5f9 !important; text-transform: uppercase !important; font-weight: bold !important; text-align: left !important; }
              .pdf-table td { border: 1px solid #cbd5e1 !important; padding: 10px !important; font-size: 12px !important; word-wrap: break-word !important; }
              tr { page-break-inside: avoid !important; }
              
              .pdf-title { font-family: 'Montserrat', sans-serif !important; font-weight: bold !important; font-size: 18px !important; margin: 0 0 5px 0 !important; text-transform: uppercase !important; border-bottom: 2px solid #cbd5e1 !important; padding-bottom: 8px !important; }
              .pdf-subtitle { font-size: 11px !important; color: #475569 !important; margin: 8px 0 20px 0 !important; }
              .pdf-section { font-family: 'Montserrat', sans-serif !important; font-weight: bold !important; font-size: 12px !important; border-bottom: 1px solid #cbd5e1 !important; padding-bottom: 4px !important; margin-top: 25px !important; margin-bottom: 10px !important; text-transform: uppercase !important; }
              .pdf-box { border: 1px solid #cbd5e1 !important; padding: 15px !important; margin-top: 20px !important; display: flex !important; justify-content: space-between !important; background-color: #f8fafc !important; }
            }
        `}
      </style>

      {/* DIMENSÃO DA TELA INTERATIVA */}
      <div className="tela-interativa p-4 md:p-8 max-w-[1200px] mx-auto relative z-10">
        
        {fotoExpandida && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="relative max-w-xl w-full flex flex-col items-center">
              <button onClick={() => setFotoExpandida(null)} className="absolute -top-12 right-0 p-2 bg-slate-800 hover:bg-slate-700 rounded-full text-white"><X size={24} /></button>
              <img src={fotoExpandida} alt="Auditoria" className="w-full h-auto max-h-[80vh] object-cover rounded-2xl border-4 border-slate-700" />
            </div>
          </div>
        )}

        {/* MODAL HOLERITE INDIVIDUAL */}
        {extratoSelecionado && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 print:hidden">
            <div className="bg-[#0f172a] border border-slate-700 rounded-3xl w-full max-w-3xl p-6 md:p-8 shadow-2xl relative max-h-[95vh] overflow-y-auto custom-scrollbar">
              
              <div className="flex justify-between items-center mb-6 border-b border-slate-800 pb-4">
                <h2 className="text-xl md:text-2xl font-bold font-['Montserrat'] text-white">Demonstrativo Individual</h2>
                <button onClick={() => setExtratoSelecionado(null)} className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition-colors"><X size={24} /></button>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 bg-slate-900/50 p-5 rounded-2xl border border-slate-800">
                <div>
                  <span className="block text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">Colaborador</span>
                  <span className="font-bold text-slate-200 text-lg">{extratoSelecionado.nome}</span>
                </div>
                <div>
                  <span className="block text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">Função / Cargo</span>
                  <span className="font-bold text-slate-200 text-lg">{extratoSelecionado.cargo}</span>
                </div>
              </div>

              <div className="border border-slate-800 rounded-2xl overflow-hidden mb-6 shadow-lg">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse min-w-[600px]">
                    <thead>
                      <tr className="bg-slate-900/80 border-b border-slate-800">
                        <th className="p-4 text-slate-400 font-semibold uppercase text-xs tracking-wider">Data</th>
                        <th className="p-4 text-slate-400 font-semibold uppercase text-xs tracking-wider">Obra / Local</th>
                        <th className="p-4 text-slate-400 font-semibold uppercase text-xs tracking-wider">Entrada</th>
                        <th className="p-4 text-slate-400 font-semibold uppercase text-xs tracking-wider">Saída</th>
                        <th className="p-4 text-slate-400 font-semibold uppercase text-xs tracking-wider text-right">Jornada</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {extratoSelecionado.logs.map((l, i) => (
                        <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                          <td className="p-4 font-medium text-slate-200">{l.data}</td>
                          <td className="p-4 text-[11px] text-blue-400 font-medium">
                            <span className="flex items-center gap-1.5"><Building2 size={12}/> {l.entrada?.obra || l.saida?.obra || '-'}</span>
                          </td>
                          <td className="p-4 text-emerald-400 font-bold">{l.entrada ? l.entrada.hora : '-'}</td>
                          <td className="p-4 text-slate-300 font-bold">{l.saida ? l.saida.hora : '-'}</td>
                          <td className="p-4 font-mono font-bold text-right text-blue-400">
                            <div className="flex flex-col items-end">
                              <span>{l.minutosTrabalhadosDia > 0 ? `${Math.floor(l.minutosTrabalhadosDia / 60)}h ${(l.minutosTrabalhadosDia % 60).toString().padStart(2, '0')}m` : '-'}</span>
                              {l.descontouAlmoco && <span className="text-[9px] text-slate-500 font-sans mt-0.5">(-1h Almoço)</span>}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              
              <div className="flex justify-between items-center bg-gradient-to-r from-slate-900 to-[#0f172a] p-5 rounded-2xl border border-blue-900/30 mb-8 shadow-inner">
                <span className="text-sm font-bold text-slate-400 uppercase tracking-wider">Saldo Acumulado:</span>
                <span className="text-3xl font-black text-blue-400 font-mono">{extratoSelecionado.horasFormatadas}</span>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <button onClick={() => window.print()} className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-blue-900/20">
                  <FileText size={20} /> Imprimir PDF
                </button>
                <button onClick={() => enviarExtratoIndividualWhats(extratoSelecionado)} className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-emerald-900/20">
                  <Send size={20} /> Enviar p/ WhatsApp
                </button>
              </div>

            </div>
          </div>
        )}

        {/* MODAL DE LANÇAMENTO MANUAL */}
        {modalAberto && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 print:hidden">
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
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="text-xs text-slate-400 mb-1 block">Tipo de Batida</label>
                    <select required onChange={e => setFormManual({...formManual, tipo_registro: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-white focus:border-emerald-500 outline-none">
                      <option value="entrada">Entrada</option>
                      <option value="saida">Saída</option>
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-slate-400 mb-1 block">Obra / Local</label>
                    <select required onChange={e => setFormManual({...formManual, obra_nome: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-white focus:border-emerald-500 outline-none">
                      <option value="Lançamento Manual / Base">Manual / Base</option>
                      {obrasList.map(o => <option key={o.id} value={o.nome}>{o.nome}</option>)}
                    </select>
                  </div>
                </div>
                <button type="submit" disabled={carregando} className="mt-4 w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl transition-colors">Confirmar Lançamento</button>
              </form>
            </div>
          </div>
        )}

        {/* MODAL DE GESTÃO DE OBRAS */}
        {modalObraAberto && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 print:hidden">
            <div className="bg-[#0f172a] border border-slate-700 rounded-3xl w-full max-w-4xl p-6 md:p-8 shadow-2xl relative flex flex-col md:flex-row gap-8 max-h-[90vh] overflow-y-auto">
              <button onClick={() => setModalObraAberto(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X size={20} /></button>
              
              <div className="flex-1 md:border-r border-slate-800 pb-6 md:pb-0 md:pr-8">
                <h2 className="text-2xl font-bold mb-2 font-['Montserrat'] text-white flex items-center gap-2">
                  <Building2 size={24} className="text-blue-400" /> Gestão de Obras
                </h2>
                <p className="text-sm text-slate-400 mb-6">Cadastre as frentes de trabalho. Os colaboradores farão check-in pelo app dentro destas cercas virtuais.</p>
                
                <form onSubmit={salvarNovaObra} className="flex flex-col gap-4">
                  <div>
                    <label className="text-xs text-slate-400 mb-1.5 block font-semibold uppercase tracking-wider">Nome de Identificação</label>
                    <input type="text" required value={formObra.nome} onChange={e => setFormObra({...formObra, nome: e.target.value})} className="w-full bg-[#020617] border border-slate-700 rounded-xl p-3.5 text-sm text-white focus:border-blue-500 outline-none transition-colors" placeholder="Ex: Obra Shopping - Zona Sul" />
                  </div>

                  <div className="relative">
                    <label className="text-xs text-slate-400 mb-1.5 block font-semibold uppercase tracking-wider">Buscar por Endereço</label>
                    <div className="flex gap-2 relative">
                      <input 
                        type="text" 
                        value={formObra.buscaEndereco || ''} 
                        onChange={e => { setFormObra({...formObra, buscaEndereco: e.target.value}); if (e.target.value === '') setResultadosBusca([]); }} 
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); buscarCoordenadasPorEndereco(); } }}
                        className="flex-1 bg-[#020617] border border-slate-700 rounded-xl p-3.5 text-sm text-white focus:border-blue-500 outline-none transition-colors" 
                        placeholder="Ex: Avenida Paulista, 1000, São Paulo" 
                      />
                      <button 
                        type="button" 
                        onClick={buscarCoordenadasPorEndereco} 
                        disabled={buscandoEndereco || !formObra.buscaEndereco}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-5 rounded-xl transition-all shadow-md disabled:opacity-50 flex items-center justify-center shrink-0"
                      >
                        {buscandoEndereco ? <Loader2 size={20} className="animate-spin" /> : <Search size={20} />}
                      </button>
                    </div>

                    {resultadosBusca.length > 0 && (
                      <div className="absolute top-full left-0 w-full mt-2 bg-[#1e293b] border border-slate-600 rounded-xl shadow-2xl z-50 overflow-hidden">
                        <div className="bg-slate-800 p-2.5 border-b border-slate-700 text-[10px] font-bold text-slate-400 uppercase tracking-widest flex justify-between items-center">
                          <span>Selecione o local exato:</span>
                          <button type="button" onClick={() => setResultadosBusca([])} className="p-1 hover:text-white"><X size={14}/></button>
                        </div>
                        <ul className="max-h-48 overflow-y-auto custom-scrollbar divide-y divide-slate-700/50">
                          {resultadosBusca.map((end, i) => {
                            const p = end.properties;
                            const displayName = [p.name, p.street, p.city, p.state].filter(Boolean).join(', ');
                            return (
                              <li 
                                key={i}
                                onClick={() => {
                                  const lat = end.geometry.coordinates[1].toFixed(6);
                                  const lon = end.geometry.coordinates[0].toFixed(6);
                                  setFormObra({...formObra, gps: `${lat},${lon}`, buscaEndereco: displayName});
                                  setResultadosBusca([]);
                                }}
                                className="p-3.5 text-xs text-slate-300 hover:bg-blue-600/20 hover:text-blue-300 cursor-pointer transition-colors flex items-start gap-3"
                              >
                                <MapPin size={16} className="shrink-0 mt-0.5 opacity-60" />
                                <span className="leading-relaxed">{displayName}</span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3 my-1 opacity-30">
                    <div className="h-[1px] bg-slate-500 flex-1"></div>
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-500"></div>
                    <div className="h-[1px] bg-slate-500 flex-1"></div>
                  </div>

                  <button 
                    type="button" 
                    onClick={pegarLocalizacaoParaObra} 
                    className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 py-3.5 rounded-xl text-sm font-semibold transition-all shadow-sm"
                  >
                    <Navigation size={18} className="text-emerald-400" /> Capturar meu GPS de onde estou agora
                  </button>

                  <div className="mt-2">
                    <label className="text-xs text-slate-500 mb-1.5 block font-medium uppercase tracking-wider">Coordenada Matemática da Cerca</label>
                    <input 
                      type="text" 
                      required 
                      value={formObra.gps} 
                      onChange={e => setFormObra({...formObra, gps: e.target.value})} 
                      className="w-full bg-[#020617]/50 border border-slate-800 rounded-xl p-3.5 text-sm text-blue-400 font-mono outline-none transition-colors" 
                      placeholder="-26.4842,-49.0984" 
                    />
                  </div>

                  <button type="submit" disabled={carregando} className="mt-2 w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-emerald-900/20">
                    Cadastrar e Ativar Obra
                  </button>
                </form>
              </div>

              <div className="flex-1 flex flex-col">
                <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2">Obras Ativas ({obrasList.length})</h3>
                <div className="flex flex-col gap-3 max-h-[450px] overflow-y-auto pr-2 custom-scrollbar">
                  {obrasList.length === 0 ? (
                    <div className="text-center p-8 bg-[#020617] border border-slate-800 rounded-2xl">
                      <Building2 size={32} className="text-slate-600 mx-auto mb-3" />
                      <span className="text-sm text-slate-400">O seu banco de obras está vazio. Adicione a primeira!</span>
                    </div>
                  ) : (
                    obrasList.map(obra => (
                      <div key={obra.id} className="bg-slate-900/80 hover:bg-slate-800/80 border border-slate-700/60 rounded-xl p-4 flex justify-between items-center transition-colors group">
                        <div className="overflow-hidden">
                          <span className="block text-sm font-bold text-slate-100 truncate">{obra.nome}</span>
                          <span className="block text-[11px] text-slate-400 font-mono mt-1 flex items-center gap-1">
                            <MapPin size={10} className="text-blue-500" /> {obra.localizacao_gps}
                          </span>
                        </div>
                        <button type="button" onClick={() => apagarObra(obra.id)} className="p-2.5 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white rounded-lg transition-colors ml-3 shrink-0" title="Excluir Obra">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* Dashboard Base (Sempre bloco para não bugar no Modal) */}
        <div className="block">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-5">
            <div>
              <h1 className="font-['Montserrat'] text-2xl md:text-3xl font-bold text-white mb-1">Painel de Fechamento</h1>
              <p className="text-slate-400 text-sm">Gestão de horas e auditoria de equipe.</p>
            </div>
            
            <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 w-full md:w-auto">
              <button onClick={() => setModalAberto(true)} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700/60 font-semibold text-sm rounded-xl transition-all shadow-sm">
                <Plus size={18} /> Lançar Ponto
              </button>
              
              <button onClick={() => setModalObraAberto(true)} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3.5 bg-slate-800 hover:bg-slate-700 text-blue-400 border border-slate-700/60 font-semibold text-sm rounded-xl transition-all shadow-sm">
                <Building2 size={18} /> Gestão de Obras
              </button>
              
              <button onClick={() => { setExtratoSelecionado(null); setTimeout(() => window.print(), 100); }} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm rounded-xl transition-all shadow-lg shadow-blue-900/20">
                <FileText size={18} /> Gerar PDF Mensal
              </button>

              <button onClick={enviarRelatorioGeralWhats} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm rounded-xl transition-all shadow-lg shadow-emerald-900/20">
                <Share2 size={18} /> Disparar Whats Geral
              </button>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-6 mb-8">
            <div className="bg-[#0f172a] border border-slate-700 rounded-2xl p-5 md:w-1/3 shadow-xl">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 block">Competência (Mês/Ano)</label>
              <input type="month" value={mesFiltro} onChange={(e) => setMesFiltro(e.target.value)} className="w-full bg-slate-900 border-2 border-slate-600 hover:border-slate-500 text-slate-100 font-semibold text-lg p-3.5 rounded-xl focus:border-emerald-500 outline-none transition-colors [color-scheme:dark]" />
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

          <div className="bg-[#0f172a]/60 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-slate-900/70 border-b border-slate-800">
                    <th className="p-5 text-slate-400 text-xs font-semibold uppercase tracking-wider">Colaborador / Obra</th>
                    <th className="p-5 text-slate-400 text-xs font-semibold uppercase tracking-wider">Data</th>
                    <th className="p-5 text-slate-400 text-xs font-semibold uppercase tracking-wider">Entrada</th>
                    <th className="p-5 text-slate-400 text-xs font-semibold uppercase tracking-wider">Saída</th>
                    <th className="p-5 text-slate-400 text-xs font-semibold uppercase tracking-wider">Jornada</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {pontosAgrupados.map((linha, index) => (
                    <tr key={index} className="hover:bg-slate-800/30 transition-colors">
                      <td className="p-5">
                        <div className="font-medium text-slate-200 text-sm">{linha.nome}</div>
                        <div className="text-[10px] text-blue-400 font-medium flex items-center gap-1 mt-1">
                          <Building2 size={10} /> {linha.entrada?.obra || linha.saida?.obra || 'Não especificada'}
                        </div>
                      </td>
                      <td className="p-5 text-slate-400 text-sm font-mono">{linha.data}</td>
                      <td className="p-5">
                        {linha.entrada ? (
                          <div className="flex items-start gap-3">
                            {linha.entrada.foto && <img src={linha.entrada.foto} alt="Selfie" onClick={() => setFotoExpandida(linha.entrada.foto)} className="w-10 h-10 rounded-full object-cover border-2 border-slate-700 cursor-pointer hover:border-emerald-500 transition-all shrink-0" />}
                            <div className="flex flex-col gap-1.5">
                              <span className="font-semibold text-emerald-400 text-base">{linha.entrada.hora}</span>
                              {linha.entrada.gps && <BadgeLocalizacao gps={linha.entrada.gps} />}
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
                              {linha.divergente && (
                                <span className="inline-flex items-center gap-1 text-[10px] bg-red-500/20 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded font-bold animate-pulse uppercase tracking-wide mt-1">
                                  <AlertTriangle size={12} /> Local Divergente
                                </span>
                              )}
                            </div>
                          </div>
                        ) : <span className="text-xs bg-amber-500/10 text-amber-400 px-2.5 py-1 rounded-full font-medium">Em andamento</span>}
                      </td>
                      <td className="p-5">
                        {linha.minutosTrabalhadosDia > 0 ? (
                          <div className="flex flex-col items-start gap-1">
                            <span className="inline-flex items-center gap-1 bg-slate-900 text-blue-400 px-3 py-1.5 rounded-lg text-sm font-mono font-bold border border-slate-800">
                              {Math.floor(linha.minutosTrabalhadosDia / 60)}h {(linha.minutosTrabalhadosDia % 60).toString().padStart(2, '0')}m
                            </span>
                            {linha.descontouAlmoco && <span className="text-[10px] text-slate-500 ml-1">(-1h Almoço)</span>}
                          </div>
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

      {/* ÁREA DE IMPRESSÃO CEGA (Onde mora o código gerador de PDF) */}
      <div className="hidden print:block area-impressao font-sans text-black">
        
        {extratoSelecionado ? (
          
          /* LAYOUT IMPRESSÃO: INDIVIDUAL */
          <div>
            <h1 className="pdf-title">DEMONSTRATIVO INDIVIDUAL DE JORNADA</h1>
            <p className="pdf-subtitle">Competência Fiscal: <strong>{mesFiltro.split('-')[1]}/{mesFiltro.split('-')[0]}</strong></p>

            <div className="pdf-section">1. Dados do Colaborador</div>
            <table className="pdf-table" style={{ marginTop: '5px', marginBottom: '20px' }}>
              <thead>
                <tr>
                  <th style={{ width: '50%' }}>Colaborador</th>
                  <th style={{ width: '50%' }}>Função / Cargo</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ fontWeight: 'bold', fontSize: '13px' }}>{extratoSelecionado.nome}</td>
                  <td style={{ fontWeight: 'bold', fontSize: '13px' }}>{extratoSelecionado.cargo}</td>
                </tr>
              </tbody>
            </table>

            <div className="pdf-section">2. Espelho de Ponto Detalhado</div>
            <table className="pdf-table" style={{ marginTop: '5px' }}>
              <thead>
                <tr>
                  <th style={{ width: '15%' }}>Data</th>
                  <th style={{ width: '35%' }}>Obra Local</th>
                  <th style={{ width: '15%' }}>Entrada</th>
                  <th style={{ width: '15%' }}>Saída</th>
                  <th style={{ width: '20%', textAlign: 'right' }}>Total Diário</th>
                </tr>
              </thead>
              <tbody>
                {extratoSelecionado.logs.map((l, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 'bold' }}>{l.data}</td>
                    <td>{l.entrada?.obra || l.saida?.obra || '-'}</td>
                    <td>{l.entrada ? l.entrada.hora : '-'}</td>
                    <td>{l.saida ? l.saida.hora : '-'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold', fontFamily: 'monospace', fontSize: '12px' }}>
                      {l.minutosTrabalhadosDia > 0 ? `${Math.floor(l.minutosTrabalhadosDia / 60)}h ${(l.minutosTrabalhadosDia % 60).toString().padStart(2, '0')}m` : '-'}
                      {l.descontouAlmoco ? ' (Almoço Desc.)' : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            <div className="pdf-box">
              <span style={{ fontWeight: 'bold', textTransform: 'uppercase', fontSize: '12px' }}>Saldo Total Acumulado no Período:</span>
              <span style={{ fontSize: '16px', fontWeight: 'bold', fontFamily: 'monospace' }}>{extratoSelecionado.horasFormatadas}</span>
            </div>
          </div>

        ) : (
          
          /* LAYOUT IMPRESSÃO: MENSAL GERAL */
          <div>
            <h1 className="pdf-title">RELATÓRIO GERENCIAL DE FECHAMENTO</h1>
            <p className="pdf-subtitle">Apuração do Sistema: <strong>{dataMinimaLog}</strong> até <strong>{dataMaximaLog}</strong></p>

            <div className="pdf-section">1. Resumo Consolidado de Horas (Banco Mensal)</div>
            <table className="pdf-table" style={{ marginTop: '5px', marginBottom: '20px' }}>
              <thead>
                <tr>
                  <th style={{ width: '50%' }}>Nome do Colaborador</th>
                  <th style={{ width: '30%' }}>Função Registrada</th>
                  <th style={{ width: '20%', textAlign: 'right' }}>Carga Horária Total</th>
                </tr>
              </thead>
              <tbody>
                {resumoMensal.map((r, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 'bold' }}>{r.nome}</td>
                    <td>{r.cargo}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold', fontSize: '13px' }}>{r.horasFormatadas}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="pdf-section">2. Espelho de Ponto Detalhado Geral</div>
            <table className="pdf-table" style={{ marginTop: '5px' }}>
              <thead>
                <tr>
                  <th style={{ width: '25%' }}>Colaborador / Obra</th>
                  <th style={{ width: '15%' }}>Data</th>
                  <th style={{ width: '15%' }}>Entrada</th>
                  <th style={{ width: '25%' }}>Saída</th>
                  <th style={{ width: '20%', textAlign: 'right' }}>Total Dia</th>
                </tr>
              </thead>
              <tbody>
                {pontosAgrupados.map((linha, index) => (
                  <tr key={index}>
                    <td style={{ fontWeight: 'bold' }}>
                      {linha.nome}
                      <div style={{ fontSize: '9px', color: '#475569', marginTop: '2px', fontWeight: 'normal' }}>{linha.entrada?.obra || linha.saida?.obra || ''}</div>
                    </td>
                    <td>{linha.data}</td>
                    <td>{linha.entrada ? linha.entrada.hora : '-'}</td>
                    <td>{linha.saida ? linha.saida.hora : (linha.minutosTrabalhadosDia === 0 ? 'Em andamento' : '-')} {linha.divergente ? ' [LOCAL DIVERGENTE]' : ''}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold' }}>
                      {linha.minutosTrabalhadosDia > 0 ? `${Math.floor(linha.minutosTrabalhadosDia / 60)}h ${(linha.minutosTrabalhadosDia % 60).toString().padStart(2, '0')}m` : '-'}
                      {linha.descontouAlmoco ? ' (Desc.)' : ''}
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