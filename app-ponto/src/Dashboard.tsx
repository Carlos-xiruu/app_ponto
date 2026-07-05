// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { RefreshCw, MapPin, Plus, X, FileText } from 'lucide-react';

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
    <a href={`https://www.google.com/maps/search/?api=1&query=${gps}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-2 py-1 bg-slate-800/50 hover:bg-slate-700 text-blue-400 rounded text-[11px] font-medium transition-colors border border-slate-700/50 print:border-none print:bg-transparent print:text-slate-600 print:px-0">
      <MapPin size={12} className="shrink-0" /> <span className="truncate max-w-[150px]">{endereco}</span>
    </a>
  );
};

export default function Dashboard() {
  const [pontosAgrupados, setPontosAgrupados] = useState([]);
  const [resumoMensal, setResumoMensal] = useState([]);
  const [funcionarios, setFuncionarios] = useState([]);
  const [carregando, setCarregando] = useState(true);
  
  // Controle da Foto Ampliada
  const [fotoExpandida, setFotoExpandida] = useState(null);

  const dataAtual = new Date();
  const mesAtual = `${dataAtual.getFullYear()}-${String(dataAtual.getMonth() + 1).padStart(2, '0')}`;
  const [mesFiltro, setMesFiltro] = useState(mesAtual);

  const [modalAberto, setModalAberto] = useState(false);
  const [formManual, setFormManual] = useState({ funcionario_id: '', data: '', hora: '', tipo_registro: 'entrada' });

  useEffect(() => { buscarDados(); }, [mesFiltro]);

  const buscarDados = async () => {
    setCarregando(true);
    const { data: perfis } = await supabase.from('perfis').select('id, nome').order('nome');
    if (perfis) setFuncionarios(perfis);

    const [ano, mes] = mesFiltro.split('-');
    const dataInicio = new Date(ano, mes - 1, 1).toISOString();
    const dataFim = new Date(ano, mes, 0, 23, 59, 59).toISOString();

    const { data, error } = await supabase
      .from('registros_ponto')
      .select('id, tipo_registro, data_hora, foto_url, localizacao_gps, funcionario_id, perfis ( nome )')
      .gte('data_hora', dataInicio)
      .lte('data_hora', dataFim)
      .order('data_hora', { ascending: true });

    if (error) { console.error(error); setCarregando(false); return; }

    const agrupamento = {};
    const totaisMinutosMes = {};

    data.forEach((ponto) => {
      const dataObj = new Date(ponto.data_hora);
      const dataLocal = dataObj.toLocaleDateString('pt-BR');
      const horaLocal = dataObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const nomeFuncionario = ponto.perfis?.nome || 'Desconhecido';
      const chave = `${nomeFuncionario}-${dataLocal}`;

      // VVVV CORREÇÃO: A foto voltou a ser repassada aqui VVVV
      if (!agrupamento[chave]) {
        agrupamento[chave] = {
          nome: nomeFuncionario, data: dataLocal, 
          entrada: ponto.tipo_registro === 'entrada' ? { hora: horaLocal, gps: ponto.localizacao_gps, foto: ponto.foto_url, rawIso: ponto.data_hora } : null,
          saida: ponto.tipo_registro === 'saida' ? { hora: horaLocal, gps: ponto.localizacao_gps, foto: ponto.foto_url, rawIso: ponto.data_hora } : null,
          minutosTrabalhadosDia: 0
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
      }
    });

    setPontosAgrupados(Object.values(agrupamento).reverse());
    
    const resumo = Object.keys(totaisMinutosMes).map(nome => {
      const totalMins = totaisMinutosMes[nome];
      return { nome, horasFormatadas: `${Math.floor(totalMins / 60)}h ${(totalMins % 60).toString().padStart(2, '0')}m` };
    });
    setResumoMensal(resumo);
    setCarregando(false);
  };

  const lancarPontoManual = async (e) => {
    e.preventDefault();
    setCarregando(true);
    const dataIso = new Date(`${formManual.data}T${formManual.hora}:00`).toISOString();
    const { error } = await supabase.from('registros_ponto').insert({
      funcionario_id: formManual.funcionario_id,
      tipo_registro: formManual.tipo_registro,
      data_hora: dataIso,
      localizacao_gps: null, 
      foto_url: null 
    });
    if (!error) { setModalAberto(false); buscarDados(); } 
    else { alert("Erro ao lançar ponto."); setCarregando(false); }
  };

  return (
    <div className="min-h-screen bg-[#020617] font-['Inter'] text-slate-100 p-4 md:p-8 print:bg-white print:text-black print:p-0">
      
      <style>{`@media print { @page { size: landscape; margin: 10mm; } body { -webkit-print-color-adjust: exact; background: white; } table { width: 100%; table-layout: fixed; } td, th { white-space: normal; word-wrap: break-word; padding: 8px !important; font-size: 11px !important; } }`}</style>

      {/* MODAL DA FOTO EXPANDIDA */}
      {fotoExpandida && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 print:hidden">
          <div className="relative max-w-xl w-full flex flex-col items-center">
            <button onClick={() => setFotoExpandida(null)} className="absolute -top-12 right-0 p-2 bg-slate-800 hover:bg-slate-700 rounded-full text-white transition-colors">
              <X size={24} />
            </button>
            <img src={fotoExpandida} alt="Auditoria" className="w-full h-auto max-h-[80vh] object-cover rounded-2xl border-4 border-slate-700 shadow-2xl" />
          </div>
        </div>
      )}

      {/* MODAL LANÇAMENTO MANUAL */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 print:hidden">
          <div className="bg-[#0f172a] border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <button onClick={() => setModalAberto(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X size={20} /></button>
            <h2 className="text-xl font-bold mb-6 font-['Montserrat']">Lançamento Manual</h2>
            <form onSubmit={lancarPontoManual} className="flex flex-col gap-4">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Colaborador</label>
                <select required onChange={e => setFormManual({...formManual, funcionario_id: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-white">
                  <option value="">Selecione...</option>
                  {funcionarios.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                </select>
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-xs text-slate-400 mb-1 block">Data</label>
                  <input type="date" required onChange={e => setFormManual({...formManual, data: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-white scheme-dark" />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-slate-400 mb-1 block">Hora</label>
                  <input type="time" required onChange={e => setFormManual({...formManual, hora: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-white scheme-dark" />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Tipo de Batida</label>
                <select required onChange={e => setFormManual({...formManual, tipo_registro: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-white">
                  <option value="entrada">Entrada</option>
                  <option value="saida">Saída</option>
                </select>
              </div>
              <button type="submit" disabled={carregando} className="mt-4 w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition-colors">
                Confirmar Lançamento
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="max-w-[1200px] mx-auto relative z-10">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 print:mb-4">
          <div>
            <h1 className="font-['Montserrat'] text-2xl font-bold text-white print:text-black">Painel de Fechamento</h1>
            <p className="text-slate-400 text-sm print:text-gray-600">Gestão de horas e auditoria de equipe.</p>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto print:hidden">
            <button onClick={() => setModalAberto(true)} className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-900/50 font-semibold text-sm rounded-xl transition-all">
              <Plus size={16} /> Lançar Ponto
            </button>
            <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm rounded-xl transition-all">
              <FileText size={16} /> Gerar PDF
            </button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-6 mb-8">
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-5 md:w-1/3 print:border-gray-300 print:bg-gray-50">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 block print:text-black">Competência (Mês/Ano)</label>
            <input type="month" value={mesFiltro} onChange={(e) => setMesFiltro(e.target.value)} className="w-full bg-slate-900/50 border border-slate-700 text-slate-100 text-lg p-3 rounded-xl scheme-dark print:border-none print:bg-transparent print:p-0 print:text-black" />
          </div>
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-5 flex-1 print:border-gray-300 print:bg-white">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 print:text-black">Total de Horas no Mês</h3>
            {resumoMensal.length === 0 ? (
              <span className="text-sm text-slate-600">Nenhum registro consolidado.</span>
            ) : (
              <div className="flex flex-wrap gap-4">
                {resumoMensal.map((resumo, idx) => (
                  <div key={idx} className="bg-slate-900/50 border border-slate-800 px-4 py-2 rounded-lg print:border-gray-300">
                    <span className="block text-xs text-slate-400 print:text-gray-600">{resumo.nome}</span>
                    <span className="block text-lg font-bold text-blue-400 font-mono print:text-black">{resumo.horasFormatadas}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-[#0f172a]/60 border border-slate-800 rounded-2xl overflow-hidden print:border-none">
          {carregando ? (
            <div className="py-20 text-center text-slate-400"><RefreshCw size={24} className="animate-spin mx-auto mb-2" /></div>
          ) : (
            <table className="w-full text-left border-collapse print:text-black">
              <thead>
                <tr className="bg-slate-900/50 border-b border-slate-800 print:bg-gray-100 print:border-gray-300">
                  <th className="p-4 text-slate-400 text-xs font-semibold uppercase">Colaborador</th>
                  <th className="p-4 text-slate-400 text-xs font-semibold uppercase">Data</th>
                  <th className="p-4 text-slate-400 text-xs font-semibold uppercase">Entrada</th>
                  <th className="p-4 text-slate-400 text-xs font-semibold uppercase">Saída</th>
                  <th className="p-4 text-slate-400 text-xs font-semibold uppercase">Jornada Diária</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40 print:divide-gray-200">
                {pontosAgrupados.map((linha, index) => (
                  <tr key={index} className="hover:bg-slate-800/20 print:hover:bg-transparent">
                    <td className="p-4 font-medium text-slate-200 text-sm print:text-black">{linha.nome}</td>
                    <td className="p-4 text-slate-400 text-sm print:text-gray-700">{linha.data}</td>
                    
                    <td className="p-4">
                      {linha.entrada ? (
                        <div className="flex items-start gap-3">
                          {/* VVVV O RETORNO DA FOTO VVVV */}
                          {linha.entrada.foto && (
                            <img src={linha.entrada.foto} alt="Selfie" onClick={() => setFotoExpandida(linha.entrada.foto)} className="w-9 h-9 rounded-full object-cover border border-slate-600 cursor-pointer hover:ring-2 hover:ring-emerald-500/50 transition-all print:hidden shrink-0 mt-1" />
                          )}
                          <div className="flex flex-col gap-1">
                            <span className="font-semibold text-emerald-400 print:text-emerald-700">{linha.entrada.hora}</span>
                            {linha.entrada.gps && <BadgeLocalizacao gps={linha.entrada.gps} />}
                            {!linha.entrada.gps && <span className="text-[10px] text-amber-500 border border-amber-900 px-1 rounded inline-block w-max print:text-black print:border-gray-300">Lançamento Manual</span>}
                          </div>
                        </div>
                      ) : <span className="text-slate-700">-</span>}
                    </td>

                    <td className="p-4">
                      {linha.saida ? (
                        <div className="flex items-start gap-3">
                          {linha.saida.foto && (
                            <img src={linha.saida.foto} alt="Selfie" onClick={() => setFotoExpandida(linha.saida.foto)} className="w-9 h-9 rounded-full object-cover border border-slate-600 cursor-pointer hover:ring-2 hover:ring-blue-500/50 transition-all print:hidden shrink-0 mt-1" />
                          )}
                          <div className="flex flex-col gap-1">
                            <span className="font-semibold text-slate-300 print:text-gray-900">{linha.saida.hora}</span>
                            {linha.saida.gps && <BadgeLocalizacao gps={linha.saida.gps} />}
                            {!linha.saida.gps && <span className="text-[10px] text-amber-500 border border-amber-900 px-1 rounded inline-block w-max print:text-black print:border-gray-300">Lançamento Manual</span>}
                          </div>
                        </div>
                      ) : <span className="text-xs bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full print:bg-transparent print:text-black">Em andamento</span>}
                    </td>

                    <td className="p-4">
                      {linha.minutosTrabalhadosDia > 0 ? (
                        <span className="inline-flex items-center gap-1 bg-slate-900 text-blue-400 px-2 py-1 rounded text-xs font-mono font-bold print:bg-transparent print:text-black">
                          {Math.floor(linha.minutosTrabalhadosDia / 60)}h {(linha.minutosTrabalhadosDia % 60).toString().padStart(2, '0')}m
                        </span>
                      ) : <span className="text-slate-600">-</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}