// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { MapPin, Plus, X, FileText, Send, Share2, Eye, AlertTriangle, Building2, Trash2, Search, Navigation, Loader2, ArrowLeft, Clock, ShieldCheck, Fingerprint, FileSignature, Lock, Users, User, Key, Shield, Pencil, Calendar, Filter } from 'lucide-react';

// meu componente para renderizar o link do gps transformado em endereço
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
  // meus estados para gerenciar os dados da tela
  const [pontosAgrupados, setPontosAgrupados] = useState([]);
  const [resumoMensal, setResumoMensal] = useState([]);
  const [funcionarios, setFuncionarios] = useState([]);
  const [obrasList, setObrasList] = useState([]); 
  const [folhasPagamento, setFolhasPagamento] = useState([]); 
  const [carregando, setCarregando] = useState(true);
  
  const [dataMinimaLog, setDataMinimaLog] = useState('');
  const [dataMaximaLog, setDataMaximaLog] = useState('');
  
  // meus controles de modais e telas por cima da principal
  const [fotoExpandida, setFotoExpandida] = useState(null);
  const [modalAberto, setModalAberto] = useState(false); 
  const [modalObraAberto, setModalObraAberto] = useState(false); 
  const [extratoSelecionado, setExtratoSelecionado] = useState(null); 
  const [certificadoSelecionado, setCertificadoSelecionado] = useState(null); 
  
  // meus estados da gestão de equipe
  const [modalEquipeAberto, setModalEquipeAberto] = useState(false);
  const [equipeCompleta, setEquipeCompleta] = useState([]);
  
  const [buscandoEndereco, setBuscandoEndereco] = useState(false);
  const [resultadosBusca, setResultadosBusca] = useState([]); 
  
  // meus estados de filtros e edição rápida
  const [filtroNome, setFiltroNome] = useState('');
  const [filtroData, setFiltroData] = useState('');
  const [editandoPonto, setEditandoPonto] = useState(false);

  // meu estado para controlar o formulário turbinado de lançamento e edição
  const [formManual, setFormManual] = useState({ 
    funcionario_id: '', 
    tipo_lancamento: 'normal', 
    data_inicio: '', 
    data_fim: '', 
    hora_entrada: '07:00', 
    hora_saida: '17:00', 
    obra_nome: 'Lançamento Manual / Base' 
  });
  
  const [formObra, setFormObra] = useState({ nome: '', gps: '', buscaEndereco: '' });

  // pego o mês atual para ser o filtro padrão logo que abre a tela
  const dataAtual = new Date();
  const mesFiltroPadrao = `${dataAtual.getFullYear()}-${String(dataAtual.getMonth() + 1).padStart(2, '0')}`;
  const [mesFiltro, setMesFiltro] = useState(mesFiltroPadrao);

  // meu gatilho que roda a busca de dados de novo sempre que o mês mudar
  useEffect(() => { buscarDados(); }, [mesFiltro]);

  // meu gatilho secundário para buscar a equipe completa só quando abrir a tela de gestão
  useEffect(() => {
    if (modalEquipeAberto) { buscarEquipeCompleta(); }
  }, [modalEquipeAberto]);

  // minha engrenagem principal que busca tudo no supabase e mastiga a matemática de horas
  const buscarDados = async () => {
    setCarregando(true);
    
    // na tabela de horas eu só exibo quem é funcionário comum
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

    // meu passo 1: apenas organizo as batidas nos seus devidos dias e descubro se é folga ou férias
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
          funcionario_id: ponto.funcionario_id, 
          nome: nomeFuncionario, 
          cargo: cargoFuncionario, 
          data: dataLocal, 
          entrada: null, 
          saida: null, 
          minutosTrabalhadosDia: 0, 
          descontouAlmoco: false, 
          isEspecial: false 
        };
      }
      
      // checo se o lançamento foi de folga, férias ou viagem
      if (['FOLGA', 'FÉRIAS', 'VIAGEM'].includes(ponto.obra_nome)) {
        agrupamento[chave].isEspecial = ponto.obra_nome;
      }

      if (ponto.tipo_registro === 'entrada') agrupamento[chave].entrada = { hora: horaLocal, gps: ponto.localizacao_gps, foto: ponto.foto_url, rawIso: ponto.data_hora, obra: ponto.obra_nome };
      if (ponto.tipo_registro === 'saida') agrupamento[chave].saida = { hora: horaLocal, gps: ponto.localizacao_gps, foto: ponto.foto_url, rawIso: ponto.data_hora, obra: ponto.obra_nome };
    });

    const totaisMinutosMes = {};

    // meu passo 2: faço a matemática de descontos infalível
    Object.values(agrupamento).forEach(dia => {
      if (!totaisMinutosMes[dia.nome]) totaisMinutosMes[dia.nome] = 0;

      // se for um dia de folga ou férias fica zero
      if (dia.isEspecial) {
        dia.minutosTrabalhadosDia = 0;
      } 
      // se for um dia normal de trabalho aplica a regra
      else if (dia.entrada && dia.saida) {
        let minutos = Math.max(0, Math.floor((new Date(dia.saida.rawIso).getTime() - new Date(dia.entrada.rawIso).getTime()) / 60000));
        
        // meu desconto de 1 hora automático
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

    // passo crucial: ordeno os dias de forma cronológica (do dia 01 ao dia 31)
    const todosPontosCronologicos = Object.values(agrupamento).sort((a, b) => {
      const [d1, m1, y1] = a.data.split('/');
      const [d2, m2, y2] = b.data.split('/');
      return new Date(`${y1}-${m1}-${d1}T00:00:00`).getTime() - new Date(`${y2}-${m2}-${d2}T00:00:00`).getTime();
    });

    setPontosAgrupados(todosPontosCronologicos);
    setDataMinimaLog(`01/${mes}/${ano}`);
    if (maiorDataEncontrada) setDataMaximaLog(maiorDataEncontrada.toLocaleDateString('pt-BR')); else setDataMaximaLog(`${mes}/${ano}`);
    
    // crio o resumo agrupando por nome e injetando a lista de dias dentro de cada cara
    const resumo = Object.keys(totaisMinutosMes).sort().map(nome => {
      const totalMins = totaisMinutosMes[nome];
      const diasDoFuncionario = todosPontosCronologicos.filter(p => p.nome === nome);
      return { nome, cargo: diasDoFuncionario[0]?.cargo || 'Não definido', totalMinutos: totalMins, horasFormatadas: `${Math.floor(totalMins / 60)}h ${(totalMins % 60).toString().padStart(2, '0')}m`, logs: diasDoFuncionario };
    });
    setResumoMensal(resumo);
    setCarregando(false);
  };

  // inicio do meu motor de gestão de equipe para promover e demitir
  const buscarEquipeCompleta = async () => {
    // puxo todo mundo para podermos rebaixar admins se precisar
    const { data } = await supabase.from('perfis').select('*').order('nome');
    if (data) setEquipeCompleta(data);
  };

  const alternarPermissaoGestor = async (membro) => {
    const novoStatus = !membro.is_admin;
    const acao = novoStatus ? 'Promover a Gestor' : 'Remover o acesso de Gestor de';
    
    if (!window.confirm(`Você deseja ${acao} ${membro.nome}?`)) return;

    setCarregando(true);
    const { error } = await supabase.from('perfis').update({ is_admin: novoStatus }).eq('id', membro.id);

    if (error) {
      alert("Erro ao alterar permissão: " + error.message);
    } else {
      alert(`Feito! ${novoStatus ? 'Acesso concedido.' : 'Acesso removido.'}\n\nAVISO: Peça para o colaborador FECHAR O APLICATIVO E ABRIR DE NOVO no celular dele para o sistema atualizar a tela.`);
      buscarEquipeCompleta();
      buscarDados(); 
    }
    setCarregando(false);
  };

  const excluirColaborador = async (membro) => {
    if (!window.confirm(`⚠️ EXCLUSÃO DE CONTA ⚠️\n\nTem certeza que deseja EXCLUIR DEFINITIVAMENTE o colaborador ${membro.nome}?\n\nIsso apagará o acesso dele, todas as folhas de pagamento e todo o histórico de pontos dele do sistema. Esta ação não tem volta.`)) return;

    setCarregando(true);
    await supabase.from('folhas_pagamento').delete().eq('funcionario_id', membro.id);
    await supabase.from('registros_ponto').delete().eq('funcionario_id', membro.id);
    const { error } = await supabase.from('perfis').delete().eq('id', membro.id);

    if (error) {
      alert("Erro ao excluir colaborador: " + error.message);
    } else {
      alert(`${membro.nome} foi removido do sistema com sucesso!`);
      buscarEquipeCompleta();
      buscarDados();
    }
    setCarregando(false);
  };

  // minhas funções de disparo em lote e individual para fechar a folha
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
    
    if(error) alert('Erro ao fechar a folha: ' + error.message); else alert(`Folha de ${funcionarioNome} fechada e enviada para assinatura!`);
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
    funcionario.logs.forEach(l => {
      texto += `📅 ${l.data} | ${l.isEspecial
        ? `🌟 ${l.isEspecial}`
        : `🟢 ${l.entrada ? l.entrada.hora : '-'} | 🔴 ${l.saida ? l.saida.hora : '-'} (${l.minutosTrabalhadosDia > 0 ? `${Math.floor(l.minutosTrabalhadosDia / 60)}h` : '-'})`
      }\n`;
    });
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(texto)}`, '_blank');
  };

  // inicio da minha função que preenche o modal para edição a jato
  const abrirEdicaoPonto = (linha) => {
    const [d, m, y] = linha.data.split('/');
    const dataIso = `${y}-${m}-${d}`;

    let tipo = 'normal';
    if (linha.isEspecial === 'FOLGA') tipo = 'folga';
    else if (linha.isEspecial === 'FÉRIAS') tipo = 'ferias';
    else if (linha.isEspecial === 'VIAGEM') tipo = 'viagem';

    setFormManual({
      funcionario_id: linha.funcionario_id,
      tipo_lancamento: tipo,
      data_inicio: dataIso,
      data_fim: dataIso, 
      hora_entrada: linha.entrada?.hora || '07:00',
      hora_saida: linha.saida?.hora || '17:00',
      obra_nome: linha.isEspecial ? linha.isEspecial : (linha.entrada?.obra || linha.saida?.obra || 'Lançamento Manual / Base')
    });
    
    setEditandoPonto(true);
    setModalAberto(true);
  };

  const fecharModalManual = () => {
    setModalAberto(false);
    setEditandoPonto(false);
    setFormManual({ funcionario_id: '', tipo_lancamento: 'normal', data_inicio: '', data_fim: '', hora_entrada: '07:00', hora_saida: '17:00', obra_nome: 'Lançamento Manual / Base' });
  }

  // meu lançamento manual e edição usando o motor unificado
  const lancarPontoManual = async (e) => {
    e.preventDefault(); 
    setCarregando(true);

    const dataInicioIso = new Date(`${formManual.data_inicio}T00:00:00`).toISOString();
    const dataFimIso = new Date(`${formManual.data_fim || formManual.data_inicio}T23:59:59`).toISOString();

    const { data: registrosExistentes } = await supabase
      .from('registros_ponto')
      .select('id')
      .eq('funcionario_id', formManual.funcionario_id)
      .gte('data_hora', dataInicioIso)
      .lte('data_hora', dataFimIso);

    if (registrosExistentes && registrosExistentes.length > 0) {
      let mensagem = `⚠️ ATENÇÃO!\n\nJá existem registros para este colaborador dentro do período informado.\n\nDeseja SUBSTITUIR tudo o que estiver lançado nestes dias pelos novos dados?`;
      if (editandoPonto) {
        mensagem = `CONFIRMAÇÃO DE EDIÇÃO\n\nVocê está alterando os horários deste dia.\nDeseja salvar as novas informações e recalcular a jornada automaticamente?`;
      }

      const confirma = window.confirm(mensagem);
      if (!confirma) { setCarregando(false); return; }

      const idsParaDeletar = registrosExistentes.map(r => r.id);
      const { error: deleteError } = await supabase.from('registros_ponto').delete().in('id', idsParaDeletar);
      if (deleteError) { alert("Erro ao limpar os dias antigos: " + deleteError.message); setCarregando(false); return; }
    }

    const batidasMassa = [];
    const parseDate = (d) => { const [y, m, day] = d.split('-'); return new Date(y, m - 1, day); };
    
    let currentDate = parseDate(formManual.data_inicio);
    const endDate = parseDate(formManual.data_fim || formManual.data_inicio);

    while (currentDate <= endDate) {
      const dateStr = [currentDate.getFullYear(), String(currentDate.getMonth() + 1).padStart(2, '0'), String(currentDate.getDate()).padStart(2, '0')].join('-');
      
      if (formManual.tipo_lancamento === 'normal') {
        batidasMassa.push({ funcionario_id: formManual.funcionario_id, tipo_registro: 'entrada', data_hora: new Date(`${dateStr}T${formManual.hora_entrada}:00`).toISOString(), obra_nome: formManual.obra_nome });
        batidasMassa.push({ funcionario_id: formManual.funcionario_id, tipo_registro: 'saida', data_hora: new Date(`${dateStr}T${formManual.hora_saida}:00`).toISOString(), obra_nome: formManual.obra_nome });
      } else {
        const label = formManual.tipo_lancamento === 'folga' ? 'FOLGA' : formManual.tipo_lancamento === 'ferias' ? 'FÉRIAS' : 'VIAGEM';
        batidasMassa.push({ funcionario_id: formManual.funcionario_id, tipo_registro: 'entrada', data_hora: new Date(`${dateStr}T00:00:00`).toISOString(), obra_nome: label });
        batidasMassa.push({ funcionario_id: formManual.funcionario_id, tipo_registro: 'saida', data_hora: new Date(`${dateStr}T00:00:00`).toISOString(), obra_nome: label });
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    const { error } = await supabase.from('registros_ponto').insert(batidasMassa);

    if (!error) { 
      fecharModalManual();
      buscarDados(); 
    } else { 
      alert("Erro ao lançar pontos no banco de dados."); 
    }
    setCarregando(false);
  };

  // minha integração com a api da photon
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

  // === A MÁGICA DOS FILTROS E AGRUPAMENTOS ===
  let resumoFiltrado = resumoMensal;

  if (filtroNome) {
    resumoFiltrado = resumoFiltrado.filter(r => r.nome === filtroNome);
  }

  if (filtroData) {
    const [y, m, d] = filtroData.split('-');
    const dataFormatada = `${d}/${m}/${y}`;
    // eu varro a lista, jogo fora os dias que não batem com o filtro, e se o cara não bateu ponto nesse dia ele some da lista
    resumoFiltrado = resumoFiltrado.map(r => ({
      ...r,
      logs: r.logs.filter(l => l.data === dataFormatada)
    })).filter(r => r.logs.length > 0);
  }

  // construo a lista de nomes apenas com a galera do mês atual para o select
  const nomesComPontos = resumoMensal.map(r => r.nome);

  return (
    <div className="min-h-screen bg-[#020617] font-['Inter'] text-slate-100">
      
      <style>
        {`
            /* meu css blindado para a tela e impressão com anti guilhotina ativado */
            html, body { touch-action: pan-y; overscroll-behavior-y: none; -webkit-user-select: none; user-select: none; }
            input, select, textarea { font-size: 16px !important; -webkit-user-select: auto; user-select: auto; }

            @media print {
              @page { size: ${certificadoSelecionado ? 'A4 portrait' : extratoSelecionado ? 'A4 portrait' : 'A4 portrait'}; margin: 10mm; }
              
              html, body, #root, main, .min-h-screen { 
                background: white !important; 
                color: black !important; 
                display: block !important; 
                position: relative !important;
                width: 100% !important; 
                height: auto !important; 
                min-height: auto !important; 
                overflow: visible !important; 
                margin: 0 !important; 
                padding: 0 !important; 
                box-sizing: border-box !important; 
              }
              
              * { -webkit-print-color-adjust: exact; print-color-adjust: exact; box-shadow: none !important; color: black !important; box-sizing: border-box !important; }
              header, .tela-interativa, .modais-extracao { display: none !important; }
              
              .area-impressao { 
                display: block !important; 
                position: relative !important; 
                width: 100% !important; 
                height: auto !important; 
                overflow: visible !important; 
                background: white !important; 
                padding: 10mm !important; 
              }
              
              .pdf-table { width: 100% !important; border-collapse: collapse !important; margin-top: 15px !important; page-break-inside: auto !important; }
              .pdf-table th { border: 1px solid #cbd5e1 !important; padding: 8px 10px !important; font-size: 10px !important; background-color: #f1f5f9 !important; text-transform: uppercase !important; font-weight: bold !important; text-align: left !important; }
              
              tr { page-break-inside: avoid !important; break-inside: avoid !important; -webkit-column-break-inside: avoid !important; page-break-after: auto !important; }
              .pdf-table td { border: 1px solid #cbd5e1 !important; padding: 8px 10px !important; font-size: 11px !important; vertical-align: middle !important; page-break-inside: avoid !important; break-inside: avoid !important; }
              
              thead { display: table-header-group !important; }
              tfoot { display: table-footer-group !important; }
              
              .pdf-title { font-family: 'Montserrat', sans-serif !important; font-weight: bold !important; font-size: 18px !important; margin: 0 0 5px 0 !important; text-transform: uppercase !important; border-bottom: 2px solid #cbd5e1 !important; padding-bottom: 8px !important; }
              .pdf-subtitle { font-size: 11px !important; color: #475569 !important; margin: 6px 0 15px 0 !important; }
              .pdf-section { font-family: 'Montserrat', sans-serif !important; font-weight: bold !important; font-size: 12px !important; border-bottom: 1px solid #cbd5e1 !important; padding-bottom: 4px !important; margin-top: 20px !important; margin-bottom: 8px !important; text-transform: uppercase !important; page-break-inside: avoid !important; break-inside: avoid !important; }
              .pdf-box { border: 1px solid #cbd5e1 !important; padding: 12px !important; margin-top: 15px !important; display: flex !important; justify-content: space-between !important; background-color: #f8fafc !important; page-break-inside: avoid !important; break-inside: avoid !important; }

              .certificado-container { border: 4px double #1e293b !important; padding: 40px !important; border-radius: 10px !important; page-break-inside: avoid !important; break-inside: avoid !important; }
              .certificado-header { text-align: center !important; margin-bottom: 30px !important; }
              .certificado-body { line-height: 1.8 !important; font-size: 12px !important; margin-bottom: 30px !important; text-align: justify !important;}
              .certificado-hash { font-family: monospace !important; background: #f1f5f9 !important; padding: 15px !important; border: 1px solid #cbd5e1 !important; word-wrap: break-word !important; font-size: 10px !important; }

              /* a mágica da paginação e modo holerite compacto */
              .extrato-compacto .pdf-title { font-size: 16px !important; margin-bottom: 2px !important; padding-bottom: 4px !important; }
              .extrato-compacto .pdf-subtitle { margin-bottom: 8px !important; font-size: 10px !important; }
              .extrato-compacto .pdf-section { margin-top: 8px !important; padding-bottom: 2px !important; margin-bottom: 4px !important; font-size: 10px !important; }
              .extrato-compacto .pdf-table { margin-top: 4px !important; }
              .extrato-compacto .pdf-table th { padding: 4px 6px !important; font-size: 9px !important; }
              .extrato-compacto .pdf-table td { padding: 4px 6px !important; font-size: 10px !important; }
              .extrato-compacto .pdf-box { margin-top: 8px !important; padding: 6px 12px !important; }
              .extrato-compacto .carimbo-assinatura { margin-top: 15px !important; padding: 10px !important; }
              .extrato-compacto .carimbo-assinatura h4 { margin-bottom: 4px !important; font-size: 11px !important; }
              .extrato-compacto .carimbo-assinatura p { margin-top: 2px !important; font-size: 9px !important; line-height: 1.2 !important; }
            }
        `}
      </style>

      {/* área de modais e minhas sobreposições na tela */}
      <div className="modais-extracao">
        
        {/* meu modal de gestão de equipe */}
        {modalEquipeAberto && (
          <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 print:hidden">
            <div className="bg-[#0f172a] border border-slate-700 rounded-3xl w-full max-w-3xl p-6 md:p-8 shadow-2xl relative max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95">
              <button onClick={() => setModalEquipeAberto(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white p-3 rounded-xl hover:bg-slate-800 transition-colors z-50"><X size={24} /></button>
              
              <div className="mb-6 border-b border-slate-800 pb-4 pr-8">
                 <h2 className="text-2xl font-bold font-['Montserrat'] text-white flex items-center gap-2"><Users size={28} className="text-blue-400" /> Gestão de Equipe</h2>
                 <p className="text-sm text-slate-400 mt-1">Conceda permissões de Gestor ou exclua contas de colaboradores desligados.</p>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                {carregando ? (
                  <div className="flex justify-center py-10"><Loader2 size={32} className="animate-spin text-blue-500"/></div>
                ) : (
                  <div className="flex flex-col gap-3">
                     {equipeCompleta.map(membro => (
                       <div key={membro.id} className="bg-slate-900/80 border border-slate-700/60 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-800 transition-colors group">
                          <div>
                             <span className="block text-sm font-bold text-slate-100">{membro.nome}</span>
                             <span className="block text-[11px] text-slate-400 font-mono mt-1">{membro.cpf ? `CPF: ${membro.cpf}` : 'Sem CPF'} • {membro.funcao || 'Sem função'}</span>
                          </div>
                          
                          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                             {/* meu badge visual de quem manda na parada */}
                             {membro.is_admin ? (
                               <span className="px-3 py-1.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5"><Shield size={14}/> Gestor</span>
                             ) : (
                               <span className="px-3 py-1.5 bg-slate-800 text-slate-400 border border-slate-700 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5"><User size={14}/> Comum</span>
                             )}

                             <div className="h-8 w-px bg-slate-700 mx-1 hidden sm:block"></div>

                             {/* meu botão de promover ou rebaixar */}
                             <button onClick={() => alternarPermissaoGestor(membro)} title={membro.is_admin ? "Remover acesso de Gestor" : "Tornar Gestor do Sistema"} className={`p-2.5 rounded-lg transition-colors flex items-center gap-2 ${membro.is_admin ? 'bg-amber-500/10 text-amber-500 hover:bg-amber-500 hover:text-white' : 'bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white'}`}>
                                <Key size={18} />
                             </button>

                             {/* meu botão da guilhotina de demissão */}
                             <button onClick={() => excluirColaborador(membro)} title="Excluir Conta e Histórico" className="p-2.5 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white rounded-lg transition-colors flex items-center gap-2">
                                <Trash2 size={18} />
                             </button>
                          </div>
                       </div>
                     ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

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
                <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 space-y-2"><div><span className="block text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-0.5">Rastreabilidade de Rede (IP)</span><span className="font-mono text-xs text-blue-400">{certificadoSelecionado.folha.ip_assinatura || 'Não registrado'}</span></div><div><span className="block text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-0.5 mt-2">Coordenada GPS do Aceite</span><span className="font-mono text-xs text-blue-400">{certificadoSelecionado.folha.gps_assinatura || 'Não registrado'}</span></div></div>
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
                  <table className="w-full text-left text-sm border-collapse min-w-[750px]">
                    <thead>
                      <tr className="bg-slate-900/80 border-b border-slate-800">
                        <th className="p-4 text-slate-400 font-semibold uppercase text-xs tracking-wider whitespace-nowrap">Data</th>
                        <th className="p-4 text-slate-400 font-semibold uppercase text-xs tracking-wider">Obra / Local</th>
                        <th className="p-4 text-slate-400 font-semibold uppercase text-xs tracking-wider">Entrada</th>
                        <th className="p-4 text-slate-400 font-semibold uppercase text-xs tracking-wider">Intervalo</th>
                        <th className="p-4 text-slate-400 font-semibold uppercase text-xs tracking-wider">Saída</th>
                        <th className="p-4 text-slate-400 font-semibold uppercase text-xs tracking-wider text-right">Jornada</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {extratoSelecionado.logs.map((l, i) => (
                        <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                          <td className="p-4 font-medium text-slate-200 whitespace-nowrap">{l.data}</td>
                          
                          {l.isEspecial ? (
                            <>
                              <td className="p-4 text-xs font-bold text-amber-400 uppercase tracking-wider">{l.isEspecial}</td>
                              <td className="p-4 text-slate-600">-</td>
                              <td className="p-4 text-slate-600">-</td>
                              <td className="p-4 text-slate-600">-</td>
                              <td className="p-4 text-slate-600 text-right">-</td>
                            </>
                          ) : (
                            <>
                              <td className="p-4 text-[11px] text-blue-400 font-medium"><span className="flex items-center gap-1.5"><Building2 size={12}/> {l.entrada?.obra || l.saida?.obra || '-'}</span></td>
                              <td className="p-4 text-emerald-400 font-bold">{l.entrada ? l.entrada.hora : '-'}</td>
                              <td className="p-4 text-slate-400 text-xs whitespace-nowrap">{l.saida ? (l.descontouAlmoco ? '12:00 às 13:00' : 'Sem pausa') : '-'}</td>
                              <td className="p-4 text-slate-300 font-bold">{l.saida ? l.saida.hora : '-'}</td>
                              <td className="p-4 font-mono font-bold text-right text-blue-400">
                                {l.minutosTrabalhadosDia > 0 ? `${Math.floor(l.minutosTrabalhadosDia / 60)}h ${(l.minutosTrabalhadosDia % 60).toString().padStart(2, '0')}m` : '-'}
                              </td>
                            </>
                          )}
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

        {/* meu modal de lançamento manual e edição */}
        {modalAberto && (
          <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 print:hidden">
            <div className="bg-[#0f172a] border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
              <button onClick={fecharModalManual} className="absolute top-4 right-4 text-slate-400 hover:text-white p-3 rounded-xl hover:bg-slate-800 transition-colors z-50"><X size={20} /></button>
              <h2 className="text-xl font-bold mb-6 font-['Montserrat'] mt-2 flex items-center gap-2">
                {editandoPonto ? <><Pencil size={24} className="text-blue-400"/> Editar Ponto</> : <><Plus size={24} className="text-emerald-400"/> Lançamento Manual</>}
              </h2>
              <form onSubmit={lancarPontoManual} className="flex flex-col gap-4">
                
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Colaborador</label>
                  <select required disabled={editandoPonto} value={formManual.funcionario_id} onChange={e => setFormManual({...formManual, funcionario_id: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-white focus:border-blue-500 outline-none disabled:opacity-50">
                    <option value="">Selecione...</option>
                    {funcionarios.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Tipo de Lançamento</label>
                  <select required value={formManual.tipo_lancamento} onChange={e => setFormManual({...formManual, tipo_lancamento: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-white focus:border-blue-500 outline-none font-semibold">
                    <option value="normal">Dia de Trabalho Normal</option>
                    <option value="folga">Lançar Folga</option>
                    <option value="ferias">Lançar Férias</option>
                    <option value="viagem">Lançar Viagem Corporativa</option>
                  </select>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <label className="text-xs text-slate-400 mb-1 block">Data Início</label>
                    <input type="date" required disabled={editandoPonto} value={formManual.data_inicio} onChange={e => setFormManual({...formManual, data_inicio: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-white [color-scheme:dark] focus:border-blue-500 outline-none disabled:opacity-50" />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-slate-400 mb-1 block">Data Fim <span className="text-[9px] text-slate-500">(Opcional)</span></label>
                    <input type="date" disabled={editandoPonto} value={formManual.data_fim} onChange={e => setFormManual({...formManual, data_fim: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-white [color-scheme:dark] focus:border-blue-500 outline-none disabled:opacity-50" />
                  </div>
                </div>

                {/* se for trabalho normal peço a obra e a hora, se for férias eu oculto isso */}
                {formManual.tipo_lancamento === 'normal' && (
                  <div className="animate-in fade-in slide-in-from-top-2 flex flex-col gap-4">
                    <div>
                      <label className="text-xs text-slate-400 mb-1 block">Obra / Local</label>
                      <select required value={formManual.obra_nome} onChange={e => setFormManual({...formManual, obra_nome: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-white focus:border-blue-500 outline-none">
                        <option value="Lançamento Manual / Base">Manual / Base</option>
                        {obrasList.map(o => <option key={o.id} value={o.nome}>{o.nome}</option>)}
                      </select>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 mt-2">
                      <div className="flex-1">
                        <label className="text-xs text-slate-400 mb-1 block">Hora da Entrada</label>
                        <input type="time" required value={formManual.hora_entrada} onChange={e => setFormManual({...formManual, hora_entrada: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-white [color-scheme:dark] focus:border-blue-500 outline-none" />
                      </div>
                      <div className="flex-1">
                        <label className="text-xs text-slate-400 mb-1 block">Hora da Saída</label>
                        <input type="time" required value={formManual.hora_saida} onChange={e => setFormManual({...formManual, hora_saida: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-white [color-scheme:dark] focus:border-blue-500 outline-none" />
                      </div>
                    </div>
                  </div>
                )}

                <button type="submit" disabled={carregando} className={`mt-4 w-full text-white font-bold py-3.5 rounded-xl transition-colors ${editandoPonto ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/20' : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/20'} shadow-lg`}>
                  {carregando ? <Loader2 className="animate-spin mx-auto" size={20} /> : (editandoPonto ? 'Salvar Alterações' : 'Processar Registros')}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* restante dos modais da tela continuam intactos */}
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

      {/* área principal da tela do gestor */}
      <div className="tela-interativa p-4 md:p-8 max-w-[1200px] mx-auto relative z-10">
        <div className="block">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-5">
            <div><h1 className="font-['Montserrat'] text-2xl md:text-3xl font-bold text-white mb-1">Painel de Fechamento</h1><p className="text-slate-400 text-sm">Gestão de horas, equipe e auditoria de assinaturas.</p></div>
            <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 w-full md:w-auto">
              
              {/* meu novo botão de gestão de equipe aqui no topo */}
              <button onClick={() => setModalEquipeAberto(true)} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3.5 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/30 font-bold text-sm rounded-xl transition-all shadow-sm"><Users size={18} /> Equipe</button>
              
              <button onClick={fecharFolhaDoMes} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl transition-all shadow-lg shadow-emerald-900/30"><FileSignature size={18} /> Fechar Mês</button>
              <button onClick={() => { setFormManual({ funcionario_id: '', tipo_lancamento: 'normal', data_inicio: '', data_fim: '', hora_entrada: '07:00', hora_saida: '17:00', obra_nome: 'Lançamento Manual / Base' }); setEditandoPonto(false); setModalAberto(true); }} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3.5 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700/60 font-semibold text-sm rounded-xl transition-all shadow-sm"><Plus size={18} /> Lançamento</button>
              <button onClick={() => setModalObraAberto(true)} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/60 font-semibold text-sm rounded-xl transition-all shadow-sm"><Building2 size={18} /> Obras</button>
              <button onClick={() => { setExtratoSelecionado(null); setTimeout(() => window.print(), 100); }} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/60 font-semibold text-sm rounded-xl transition-all shadow-sm"><FileText size={18} /> PDF Geral</button>
            </div>
          </div>

          <div className="mb-8">
            <div className="bg-[#0f172a] border border-slate-700 rounded-2xl p-5 md:w-1/3 shadow-xl mb-6"><label className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 block">Filtro de Competência (Mês/Ano)</label><input type="month" value={mesFiltro} onChange={(e) => setMesFiltro(e.target.value)} className="w-full bg-slate-900 border-2 border-slate-600 hover:border-slate-500 text-slate-100 font-semibold text-lg p-3.5 rounded-xl focus:border-emerald-500 outline-none transition-colors [color-scheme:dark]" /></div>
            
            {/* minha tabela de fechamento por funcionário */}
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
                            <td className="p-4"><span className="font-bold text-slate-200 block">{func.nome}</span><span className={`text-[10px] font-mono mt-1 block ${func.cpf ? 'text-slate-400' : 'text-red-400 font-bold'}`}>{func.cpf ? `CPF: ${func.cpf}` : 'Sem CPF cadastrado no App'}</span></td>
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

          {/* a mágica visual acontece aqui com o espelho geral dividido por funcionários */}
          <div className="bg-[#0f172a]/60 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-900/30"><h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Espelho de Ponto Geral Diário</h3></div>
            
            {/* minha barra de filtros elegante */}
            <div className="flex flex-col sm:flex-row gap-4 p-5 border-b border-slate-800 bg-slate-900/50">
               <div className="flex-1">
                 <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Search size={14}/> Buscar Colaborador</label>
                 
                 {/* menu dropdown inteligente que só exibe nomes que possuem pontos no mês */}
                 <select value={filtroNome} onChange={e => setFiltroNome(e.target.value)} className="w-full bg-[#020617] border border-slate-700 rounded-xl p-3 text-sm text-white focus:border-blue-500 outline-none transition-colors">
                   <option value="">Todos os Colaboradores</option>
                   {nomesComPontos.map(nome => (
                     <option key={nome} value={nome}>{nome}</option>
                   ))}
                 </select>
               </div>
               
               <div className="flex-1">
                 <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Filter size={14}/> Filtrar por Data</label>
                 <div className="flex gap-2">
                   <input type="date" value={filtroData} onChange={e => setFiltroData(e.target.value)} className="w-full bg-[#020617] border border-slate-700 rounded-xl p-3 text-sm text-white [color-scheme:dark] focus:border-blue-500 outline-none transition-colors" />
                   
                   {/* botão x para limpar o filtro de data corrigindo bug nativo do celular */}
                   {filtroData && (
                     <button onClick={() => setFiltroData('')} className="bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-red-400 px-4 rounded-xl transition-colors flex items-center justify-center border border-slate-700" title="Limpar Filtro de Data">
                       <X size={20} />
                     </button>
                   )}
                 </div>
               </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[950px]">
                <thead>
                  <tr className="bg-slate-900/70 border-b border-slate-800">
                    <th className="p-5 text-slate-400 text-xs font-semibold uppercase tracking-wider w-24">Data</th>
                    <th className="p-5 text-slate-400 text-xs font-semibold uppercase tracking-wider">Obra / Local</th>
                    <th className="p-5 text-slate-400 text-xs font-semibold uppercase tracking-wider w-32">Entrada</th>
                    <th className="p-5 text-slate-400 text-xs font-semibold uppercase tracking-wider w-32">Intervalo</th>
                    <th className="p-5 text-slate-400 text-xs font-semibold uppercase tracking-wider w-32">Saída</th>
                    <th className="p-5 text-slate-400 text-xs font-semibold uppercase tracking-wider text-right w-32">Jornada Diária</th>
                    <th className="p-5 text-slate-400 text-xs font-semibold uppercase tracking-wider text-right w-16">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {resumoFiltrado.length === 0 ? (
                    <tr><td colSpan="7" className="p-8 text-center text-slate-500">Nenhum registro encontrado para este filtro.</td></tr>
                  ) : (
                    resumoFiltrado.map(func => (
                      <React.Fragment key={func.nome}>
                        
                        {/* meu cabeçalho lindo que separa os funcionários */}
                        <tr className="bg-blue-900/20 border-y border-blue-900/30">
                          <td colSpan="7" className="px-5 py-3">
                            <div className="flex justify-between items-center">
                              <div className="flex items-center gap-2">
                                 <User size={16} className="text-blue-400" />
                                 <span className="font-bold text-blue-100 uppercase tracking-wider text-sm">{func.nome}</span>
                                 <span className="text-xs text-blue-400/70 ml-2">• {func.cargo}</span>
                              </div>
                              <div className="text-sm font-mono font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded border border-emerald-500/20">
                                 Total: {func.horasFormatadas}
                              </div>
                            </div>
                          </td>
                        </tr>
                        
                        {/* linhas com os dias de trabalho desse funcionário */}
                        {func.logs.map(linha => (
                          <tr key={linha.data} className="hover:bg-slate-800/50 transition-colors group">
                            <td className="p-5 text-slate-300 font-bold whitespace-nowrap">{linha.data}</td>
                            <td className="p-5">
                              {linha.isEspecial ? (
                                 <div className="text-xs text-amber-400 font-bold uppercase tracking-wider">{linha.isEspecial}</div>
                              ) : (
                                 <div className="text-xs text-blue-400 font-medium flex items-center gap-1.5"><Building2 size={12} /> {linha.entrada?.obra || linha.saida?.obra || 'Não especificada'}</div>
                              )}
                            </td>
                            
                            {/* meu condicional na tela geral se for folga ou férias */}
                            {linha.isEspecial ? (
                              <>
                                <td className="p-5 text-slate-600">-</td>
                                <td className="p-5 text-slate-600">-</td>
                                <td className="p-5 text-slate-600">-</td>
                                <td className="p-5 text-slate-600 text-right">-</td>
                              </>
                            ) : (
                              <>
                                <td className="p-5">{linha.entrada ? ( <div className="flex items-start gap-3">{linha.entrada.foto && <img src={linha.entrada.foto} alt="Selfie" onClick={() => setFotoExpandida(linha.entrada.foto)} className="w-10 h-10 rounded-full object-cover border-2 border-slate-700 cursor-pointer shrink-0" />}<div className="flex flex-col gap-1.5"><span className="font-semibold text-emerald-400 text-base">{linha.entrada.hora}</span>{linha.entrada.gps && <BadgeLocalizacao gps={linha.entrada.gps} />}</div></div> ) : <span className="text-slate-700">-</span>}</td>
                                <td className="p-5 text-slate-400 text-xs whitespace-nowrap">{linha.saida ? (linha.descontouAlmoco ? '12:00 às 13:00' : 'Sem pausa') : '-'}</td>
                                <td className="p-5">{linha.saida ? ( <div className="flex items-start gap-3">{linha.saida.foto && <img src={linha.saida.foto} alt="Selfie" onClick={() => setFotoExpandida(linha.saida.foto)} className="w-10 h-10 rounded-full object-cover border-2 border-slate-700 cursor-pointer shrink-0" />}<div className="flex flex-col gap-1.5"><span className="font-semibold text-slate-300 text-base">{linha.saida.hora}</span>{linha.saida.gps && <BadgeLocalizacao gps={linha.saida.gps} />}</div></div> ) : <span className="text-xs bg-amber-500/10 text-amber-400 px-2.5 py-1 rounded-full font-medium">Em andamento</span>}</td>
                                <td className="p-5 text-right">
                                  {linha.minutosTrabalhadosDia > 0 ? ( 
                                    <span className="inline-flex items-center gap-1 bg-slate-900 text-blue-400 px-3 py-1.5 rounded-lg text-sm font-mono font-bold border border-slate-800">
                                      {Math.floor(linha.minutosTrabalhadosDia / 60)}h {(linha.minutosTrabalhadosDia % 60).toString().padStart(2, '0')}m
                                    </span> 
                                  ) : <span className="text-slate-600">-</span>}
                                </td>
                              </>
                            )}
                            {/* meu botão mágico de edição */}
                            <td className="p-5 text-right">
                               <button onClick={() => abrirEdicaoPonto(linha)} title="Editar os horários deste dia" className="p-2.5 bg-blue-500/10 hover:bg-blue-500 text-blue-400 hover:text-white rounded-lg transition-colors opacity-50 group-hover:opacity-100">
                                  <Pencil size={16} />
                               </button>
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* meus layouts de impressão em pdf */}
      <div className="hidden print:block area-impressao font-sans text-black">
        
        {/* meu laudo técnico de auditoria */}
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
                <p><strong>DATA E HORA DO ACEITE:</strong> {new Date(certificadoSelecionado.folha.data_assinatura).toLocaleString('pt-BR')}</p>
                <p><strong>RASTREAMENTO DE REDE (IP):</strong> {certificadoSelecionado.folha.ip_assinatura}</p>
                <p><strong>COORDENADA GEOGRÁFICA (GPS):</strong> {certificadoSelecionado.folha.gps_assinatura}</p>
              </div>
            </div>
            <div style={{ marginTop: '40px' }}><p style={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '5px' }}>Chave Criptográfica de Imutabilidade (Hash SHA-256):</p><div className="certificado-hash">{certificadoSelecionado.folha.hash_auditoria}</div></div>
          </div>
          
        /* meu extrato individual que o funcionário recebe */
        ) : extratoSelecionado ? (
          <div className="extrato-compacto">
            <h1 className="pdf-title">DEMONSTRATIVO INDIVIDUAL DE JORNADA</h1>
            <p className="pdf-subtitle">Competência Fiscal: <strong>{mesFiltro.split('-')[1]}/{mesFiltro.split('-')[0]}</strong></p>
            <div className="pdf-section">1. Dados do Colaborador</div>
            <table className="pdf-table" style={{ marginTop: '5px', marginBottom: '20px' }}><thead><tr><th style={{ width: '50%' }}>Colaborador</th><th style={{ width: '50%' }}>Função / Cargo</th></tr></thead><tbody><tr><td style={{ fontWeight: 'bold', fontSize: '12px' }}>{extratoSelecionado.nome}</td><td style={{ fontWeight: 'bold', fontSize: '12px' }}>{extratoSelecionado.cargo}</td></tr></tbody></table>
            
            <div className="pdf-section">2. Espelho de Ponto Detalhado</div>
            <table className="pdf-table" style={{ marginTop: '5px' }}>
              <thead>
                <tr>
                  <th style={{ whiteSpace: 'nowrap' }}>Data</th>
                  <th>Obra Local</th>
                  <th>Entrada</th>
                  <th>Intervalo</th>
                  <th>Saída</th>
                  <th style={{ textAlign: 'right' }}>Total Diário</th>
                </tr>
              </thead>
              <tbody>
                {extratoSelecionado.logs.map((l, i) => ( 
                  <tr key={i}>
                    <td style={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>{l.data}</td>
                    {l.isEspecial ? (
                      <>
                        <td style={{ fontWeight: 'bold', color: '#475569' }}>{l.isEspecial}</td>
                        <td style={{ textAlign: 'center', color: '#94a3b8' }}>-</td>
                        <td style={{ textAlign: 'center', color: '#94a3b8' }}>-</td>
                        <td style={{ textAlign: 'center', color: '#94a3b8' }}>-</td>
                        <td style={{ textAlign: 'right', color: '#94a3b8' }}>-</td>
                      </>
                    ) : (
                      <>
                        <td>{l.entrada?.obra || l.saida?.obra || '-'}</td>
                        <td>{l.entrada ? l.entrada.hora : '-'}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>{l.saida ? (l.descontouAlmoco ? '12:00 às 13:00' : 'Sem pausa') : '-'}</td>
                        <td>{l.saida ? l.saida.hora : '-'}</td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold', fontFamily: 'monospace' }}>
                          {l.minutosTrabalhadosDia > 0 ? `${Math.floor(l.minutosTrabalhadosDia / 60)}h ${(l.minutosTrabalhadosDia % 60).toString().padStart(2, '0')}m` : '-'}
                        </td>
                      </>
                    )}
                  </tr> 
                ))}
              </tbody>
            </table>
            <div className="pdf-box"><span style={{ fontWeight: 'bold', textTransform: 'uppercase', fontSize: '11px' }}>Saldo Acumulado:</span><span style={{ fontSize: '14px', fontWeight: 'bold', fontFamily: 'monospace' }}>{extratoSelecionado.horasFormatadas}</span></div>
            
            {/* meu carimbo provando que já está assinado */}
            {extratoSelecionado.folha?.status === 'assinado' && (
              <div className="carimbo-assinatura" style={{ marginTop: '30px', padding: '15px', border: '2px solid #10b981', borderRadius: '8px', backgroundColor: '#ecfdf5', color: '#065f46' }}>
                <h4 style={{ margin: '0 0 10px 0', textTransform: 'uppercase', fontSize: '12px' }}>✓ Documento Assinado Eletronicamente</h4>
                <p style={{ margin: '0', fontSize: '10px' }}><strong>Assinante:</strong> {extratoSelecionado.nome} (CPF cadastrado no sistema)</p>
                <p style={{ margin: '5px 0 0 0', fontSize: '10px' }}><strong>Data/Hora:</strong> {new Date(extratoSelecionado.folha.data_assinatura).toLocaleString('pt-BR')}</p>
                <p style={{ margin: '5px 0 0 0', fontSize: '10px' }}><strong>Chave de Autenticidade (Hash):</strong> {extratoSelecionado.folha.hash_auditoria}</p>
                <p style={{ margin: '5px 0 0 0', fontSize: '10px' }}><strong>Auditoria Completa:</strong> Ver Laudo Técnico anexo.</p>
              </div>
            )}
          </div>

        /* meu relatório geral com a tabela pdf acompanhando os filtros da tela agrupado por funcionário */
        ) : (
          <div>
            <h1 className="pdf-title">RELATÓRIO GERENCIAL DE FECHAMENTO</h1>
            <p className="pdf-subtitle">Apuração do Sistema: <strong>{dataMinimaLog}</strong> até <strong>{dataMaximaLog}</strong></p>
            
            <table className="pdf-table" style={{ marginTop: '5px' }}>
              <thead>
                <tr>
                  <th style={{ whiteSpace: 'nowrap', width: '15%' }}>Data</th>
                  <th style={{ width: '35%' }}>Obra Local</th>
                  <th style={{ width: '10%' }}>Entrada</th>
                  <th style={{ width: '20%' }}>Intervalo</th>
                  <th style={{ width: '10%' }}>Saída</th>
                  <th style={{ textAlign: 'right', width: '10%' }}>Total Dia</th>
                </tr>
              </thead>
              <tbody>
                {resumoFiltrado.map((func) => (
                  <React.Fragment key={func.nome}>
                    
                    {/* cabeçalho escuro do funcionário e saldo no pdf */}
                    <tr>
                      <td colSpan="6" style={{ backgroundColor: '#e2e8f0', color: '#0f172a', fontWeight: 'bold', fontSize: '11px', paddingTop: '8px', paddingBottom: '8px', borderBottom: '1px solid #cbd5e1' }}>
                        👤 {func.nome.toUpperCase()} &nbsp;|&nbsp; {func.cargo.toUpperCase()} <span style={{ float: 'right', color: '#059669' }}>TOTAL ACUMULADO: {func.horasFormatadas}</span>
                      </td>
                    </tr>

                    {/* lista dos dias cravados do funcionário */}
                    {func.logs.map((linha, index) => (
                      <tr key={index}>
                        <td style={{ whiteSpace: 'nowrap', fontWeight: 'bold' }}>{linha.data}</td>
                        <td>
                          {linha.isEspecial ? (
                             <div style={{ fontSize: '10px', color: '#d97706', fontWeight: 'bold', textTransform: 'uppercase' }}>{linha.isEspecial}</div>
                          ) : (
                             <div style={{ fontSize: '10px', color: '#475569' }}>{linha.entrada?.obra || linha.saida?.obra || '-'}</div>
                          )}
                        </td>
                        
                        {linha.isEspecial ? (
                          <>
                            <td style={{ textAlign: 'center', color: '#94a3b8' }}>-</td>
                            <td style={{ textAlign: 'center', color: '#94a3b8' }}>-</td>
                            <td style={{ textAlign: 'center', color: '#94a3b8' }}>-</td>
                            <td style={{ textAlign: 'right', color: '#94a3b8' }}>-</td>
                          </>
                        ) : (
                          <>
                            <td>{linha.entrada ? linha.entrada.hora : '-'}</td>
                            <td style={{ whiteSpace: 'nowrap' }}>{linha.saida ? (linha.descontouAlmoco ? '12:00 às 13:00' : 'Sem pausa') : '-'}</td>
                            <td>{linha.saida ? linha.saida.hora : (linha.minutosTrabalhadosDia === 0 ? 'Em andamento' : '-')}</td>
                            <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold' }}>
                              {linha.minutosTrabalhadosDia > 0 ? `${Math.floor(linha.minutosTrabalhadosDia / 60)}h ${(linha.minutosTrabalhadosDia % 60).toString().padStart(2, '0')}m` : '-'}
                            </td>
                          </>
                        )}
                      </tr> 
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}