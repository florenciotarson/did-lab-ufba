// app/page.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { isAddress, BrowserProvider, JsonRpcSigner, Contract, keccak256, toUtf8Bytes } from 'ethers';
import abi from '@/lib/IdentidadeDID_ABI.json';

declare global {
  interface Window { ethereum?: any; }
}

type LogLevel = 'info' | 'success' | 'error' | 'step';
interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
}

const LabDIDPage: React.FC = () => {
  // --- Estados Globais ---
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [userAddress, setUserAddress] = useState<string | null>(null);
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [signer, setSigner] = useState<JsonRpcSigner | null>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // >>> NOVO: referencia estável do provider para usar nos listeners
  const providerRef = useRef<BrowserProvider | null>(null);

  // --- Estados do Formulário: Emissão ---
  const [emitirUsuarioAddr, setEmitirUsuarioAddr] = useState('');
  const [emitirDadosJson, setEmitirDadosJson] = useState('{"status":"ATIVO", "curso":"PGCOMP"}');
  const [emitirNomeAmigavel, setEmitirNomeAmigavel] = useState('Matrícula Ativa PGCOMP');
  const [emitirDescricao, setEmitirDescricao] = useState(`Emitido em ${new Date().toLocaleDateString()}`);
  const [isLoadingEmitir, setIsLoadingEmitir] = useState(false);

  // --- Estados do Formulário: Verificação ---
  const [verificarUsuarioAddr, setVerificarUsuarioAddr] = useState('');
  const [verificarDadosJson, setVerificarDadosJson] = useState('{"status":"ATIVO", "curso":"PGCOMP"}');
  const [isLoadingVerificar, setIsLoadingVerificar] = useState(false);
  const [resultadoVerificacao, setResultadoVerificacao] = useState<boolean | null>(null);
  const [hashVerificado, setHashVerificado] = useState<string | null>(null);

  // --- Estados do Formulário: Revogação ---
  const [revogarDadosJson, setRevogarDadosJson] = useState('{"status":"ATIVO", "curso":"PGCOMP"}');
  const [isLoadingRevoke, setIsLoadingRevoke] = useState(false);

  // --- Estados do Formulário: Exportação ---
  const [isLoadingExport, setIsLoadingExport] = useState(false);

  // --- Dados de Exemplo ---
  const EXAMPLE_USER_ADDRESS = '0xSEU_ENDERECO_DE_TESTE_AQUI';
  const EXAMPLE_CREDENTIAL_JSON = '{"status":"ATIVO", "curso":"PGCOMP"}';

  // Feedback de cópia
  const [copyStatus, setCopyStatus] = useState<'address' | 'json' | null>(null);

  // --- Logs ---
  const addLog = (message: string, level: LogLevel = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    const newEntry: LogEntry = { timestamp, level, message };
    console.log(`[${level.toUpperCase()}] ${message}`);
    setLogs(prev => [newEntry, ...prev.slice(0, 19)]);
    setTimeout(() => { if (logContainerRef.current) logContainerRef.current.scrollTop = 0; }, 50);
  };

  const getLogColor = (level: LogLevel): string => {
    switch (level) {
      case 'success': return 'text-green-400';
      case 'error': return 'text-red-400';
      case 'step': return 'text-yellow-400';
      case 'info':
      default: return 'text-gray-400';
    }
  };
  const getLogEmoji = (level: LogLevel): string => {
    switch (level) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'step': return '➡️';
      case 'info':
      default: return '🔵';
    }
  };

  const safeJsonParse = (jsonString: string): boolean => {
    try { JSON.parse(jsonString); return true; } catch { return false; }
  };

  const copyToClipboard = async (text: string, type: 'address' | 'json') => {
    if (!navigator.clipboard) { addLog('Erro: Clipboard API não disponível.', 'error'); return; }
    try {
      await navigator.clipboard.writeText(text);
      addLog(`${type === 'address' ? 'Endereço' : 'JSON'} de exemplo copiado!`, 'success');
      setCopyStatus(type);
      setTimeout(() => setCopyStatus(null), 1500);
    } catch (err) {
      addLog(`Erro ao copiar ${type === 'address' ? 'endereço' : 'JSON'}.`, 'error');
      console.error('Falha ao copiar:', err);
    }
  };

  // --- Conexão com MetaMask (roda UMA vez) ---
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleAccountsChanged = async (newAccounts: string[]) => {
      const ethProvider = providerRef.current;
      if (!ethProvider) return;

      if (newAccounts.length > 0) {
        const newAddress = newAccounts[0];
        setUserAddress(newAddress);
        try {
          const newSigner = await ethProvider.getSigner(newAddress);
          setSigner(newSigner);
          addLog(`Conta MetaMask alterada para: ${newAddress.substring(0, 6)}...`, 'info');
        } catch (err) {
          console.error('Erro ao obter novo signer:', err);
          addLog('Erro ao obter signer da conta alterada.', 'error');
          setSigner(null);
        }
      } else {
        setUserAddress(null);
        setSigner(null);
        addLog('Carteira MetaMask desconectada.', 'info');
      }
    };

    const initializeProvider = async () => {
      if (!window.ethereum) {
        addLog('MetaMask não detectado. Instale a extensão.', 'error');
        return;
      }

      // cria o provider uma única vez
      const ethProvider = new BrowserProvider(window.ethereum);
      providerRef.current = ethProvider;
      setProvider(ethProvider);
      addLog('Provider MetaMask inicializado.', 'info');

      const accounts = await ethProvider.listAccounts();
      if (accounts.length > 0) {
        const currentAddress = accounts[0].address;
        setUserAddress(currentAddress);
        try {
          const currentSigner = await ethProvider.getSigner(currentAddress);
          setSigner(currentSigner);
          addLog(`Carteira ${currentAddress.substring(0, 6)}... reconectada.`, 'success');
        } catch (err) {
          console.error('Erro ao obter signer:', err);
          addLog('Erro ao obter signer da conta reconectada.', 'error');
        }
      } else {
        addLog('Nenhuma conta MetaMask conectada encontrada.', 'info');
      }

      window.ethereum.on('accountsChanged', handleAccountsChanged);
    };

    initializeProvider();

    return () => {
      // remove o listener silenciosamente (sem log para evitar “piscadas” nos logs)
      if (window.ethereum?.removeListener) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      }
    };
  }, []); // <<< executa apenas no mount

  const connectWallet = async () => {
    // usa providerRef primeiro para evitar recriar
    let currentProvider = providerRef.current || provider;

    if (!currentProvider && typeof window.ethereum !== 'undefined') {
      try {
        currentProvider = new BrowserProvider(window.ethereum);
        providerRef.current = currentProvider;
        setProvider(currentProvider);
        addLog('Provider MetaMask inicializado na conexão.', 'info');
      } catch {
        addLog('Falha ao inicializar Provider MetaMask na conexão.', 'error');
        return;
      }
    } else if (!currentProvider) {
      addLog('MetaMask não detectado. Instale a extensão.', 'error');
      return;
    }

    try {
      addLog('Solicitando conexão com MetaMask...', 'step');
      const accounts = await currentProvider.send('eth_requestAccounts', []) as string[];
      if (accounts.length > 0) {
        const newAddress = accounts[0];
        setUserAddress(newAddress);
        const newSigner = await currentProvider.getSigner(newAddress);
        setSigner(newSigner);
        addLog(`Carteira ${newAddress.substring(0, 6)}... conectada!`, 'success');
      } else {
        addLog('Nenhuma conta selecionada no MetaMask.', 'info');
      }
    } catch (error: any) {
      addLog(`Erro ao conectar carteira: ${error.message}`, 'error');
      if (error.code === 4001) { addLog('Conexão rejeitada pelo usuário.', 'error'); }
    }
  };

  // --- Funções de Interação com API ---
  const handleEmitirCredencial = async () => {
    if (!isAddress(emitirUsuarioAddr)) { addLog('Erro Emissão: Endereço do usuário inválido.', 'error'); return; }
    if (!safeJsonParse(emitirDadosJson)) { addLog('Erro Emissão: Dados da Credencial (JSON) inválidos.', 'error'); return; }

    setIsLoadingEmitir(true); addLog('EMISSÃO: Iniciando...', 'step');
    setResultadoVerificacao(null); setHashVerificado(null);
    try {
      addLog('EMISSÃO: Enviando requisição para /api/emitir...', 'step');
      const response = await fetch('/api/emitir', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuarioAddress: emitirUsuarioAddr, dadosCredencialJsonString: emitirDadosJson,
          nomeAmigavel: emitirNomeAmigavel, descricao: emitirDescricao,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || `Erro HTTP ${response.status}: ${response.statusText}`);

      addLog(`EMISSÃO SUCESSO: ${data.message}`, 'success');
      addLog(`   ID no DB: ${data.idDb}`, 'info');
      addLog(`   Hash (Prova): ${data.hashVerificacao}`, 'info');
      const txLink = data.txHashOnChain ? `${data.txHashOnChain}` : '(já existia on-chain)';
      addLog(`   Tx On-Chain: ${txLink === '(já existia on-chain)' ? txLink : `https://sepolia.etherscan.io/tx/${txLink}`}`, 'info');
    } catch (error: any) { addLog(`ERRO EMISSÃO: ${error.message}`, 'error'); }
    finally { setIsLoadingEmitir(false); }
  };

  const handleVerificarCredencial = async () => {
    if (!isAddress(verificarUsuarioAddr)) { addLog('Erro Verificação: Endereço do usuário inválido.', 'error'); return; }
    if (!safeJsonParse(verificarDadosJson)) { addLog('Erro Verificação: Dados Exatos da Credencial (JSON) inválidos.', 'error'); return; }

    setIsLoadingVerificar(true); addLog('VERIFICAÇÃO: Iniciando consulta...', 'step');
    setResultadoVerificacao(null); setHashVerificado(null);
    try {
      addLog('VERIFICAÇÃO: Enviando requisição para /api/verificar...', 'step');
      const response = await fetch('/api/verificar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuarioAddress: verificarUsuarioAddr, dadosCredencialJsonString: verificarDadosJson,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || `Erro HTTP ${response.status}: ${response.statusText}`);

      addLog(`VERIFICAÇÃO: Consulta realizada para o hash: ${data.hashVerificacao}`, 'info');
      setResultadoVerificacao(data.verificado);
      setHashVerificado(data.hashVerificacao);
      addLog(
        `VERIFICAÇÃO RESULTADO: ${data.verificado ? 'VERDADEIRO ✅ (Credencial Válida e Ativa na Blockchain!)' : 'FALSO ❌ (Credencial Inválida, Revogada ou Inexistente na Blockchain)'}`,
        data.verificado ? 'success' : 'error'
      );
    } catch (error: any) { addLog(`ERRO VERIFICAÇÃO: ${error.message}`, 'error'); }
    finally { setIsLoadingVerificar(false); }
  };

  // --- Revogação (Contrato) ---
  const handleRevogarCredencial = async () => {
    if (!signer || !userAddress) {
      addLog('Erro Revogação: Carteira MetaMask não conectada.', 'error');
      connectWallet(); return;
    }
    if (!safeJsonParse(revogarDadosJson)) {
      addLog('Erro Revogação: Dados da Credencial (JSON) inválidos.', 'error'); return;
    }
    const contractAddress = process.env.NEXT_PUBLIC_CONTRATO_ENDERECO;
    if (!contractAddress || !isAddress(contractAddress)) {
      addLog('Erro Revogação: Endereço do contrato inválido ou não configurado (.env).', 'error'); return;
    }

    setIsLoadingRevoke(true);
    addLog(`REVOGAÇÃO: Iniciando para credencial: ${revogarDadosJson}`, 'step');
    setResultadoVerificacao(null); setHashVerificado(null);

    try {
      addLog('REVOGAÇÃO: Gerando hash Keccak256...', 'step');
      const hashParaRevogar = keccak256(toUtf8Bytes(revogarDadosJson));
      addLog(`REVOGAÇÃO: Hash gerado: ${hashParaRevogar}`, 'info');

      addLog(`REVOGAÇÃO: Conectando ao contrato em ${contractAddress.substring(0, 6)}...`, 'step');
      const contrato = new Contract(contractAddress, abi, signer);

      addLog('REVOGAÇÃO: Solicitando assinatura e envio da transação...', 'step');
      const tx = await contrato.revogarCredencial(hashParaRevogar);
      addLog(`REVOGAÇÃO: Transação enviada: ${tx.hash}. Aguardando confirmação...`, 'info');

      const receipt = await tx.wait(1);
      if (receipt?.status === 1) {
        addLog(`REVOGAÇÃO SUCESSO: Credencial (hash ${hashParaRevogar.substring(0, 10)}...) revogada on-chain!`, 'success');
        addLog(`   Tx: https://sepolia.etherscan.io/tx/${tx.hash}`, 'info');
      } else {
        throw new Error(`Transação falhou on-chain (Status: ${receipt?.status}). Verifique o Etherscan.`);
      }
    } catch (error: any) {
      addLog(`ERRO REVOGAÇÃO: ${error.reason || error.message}`, 'error');
      console.error('Erro detalhado na revogação:', error);
      if (error.code === 4001) { addLog('REVOGAÇÃO: Transação rejeitada pelo usuário.', 'error'); }
      if (error.reason?.includes('Credencial nao encontrada ou ja foi revogada')) {
        addLog('REVOGAÇÃO: Credencial não encontrada para sua conta ou já revogada.', 'error');
      }
    } finally { setIsLoadingRevoke(false); }
  };

  // --- Exportação ---
  const handleExportarDados = async () => {
    if (!userAddress) {
      addLog('Erro Exportação: Carteira não conectada.', 'error');
      connectWallet(); return;
    }

    setIsLoadingExport(true);
    addLog(`EXPORTAÇÃO: Iniciando para o usuário ${userAddress.substring(0, 6)}...`, 'step');

    try {
      addLog('EXPORTAÇÃO: Solicitando dados da API /api/exportar...', 'step');
      const response = await fetch(`/api/exportar?userAddress=${userAddress}`);
      if (!response.ok) {
        let errorMsg = `Erro HTTP ${response.status}: ${response.statusText}`;
        try { const errorData = await response.json(); errorMsg = errorData.message || errorMsg; } catch {}
        throw new Error(errorMsg);
      }

      const disposition = response.headers.get('content-disposition');
      let filename = `did_lab_backup_${userAddress.substring(0, 6)}_${Date.now()}.json`;
      if (disposition && disposition.includes('attachment')) {
        const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
        const matches = filenameRegex.exec(disposition);
        if (matches?.[1]) { filename = matches[1].replace(/['"]/g, ''); }
      }

      addLog(`EXPORTAÇÃO: Preparando download do arquivo "${filename}"...`, 'step');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none'; a.href = url; a.download = filename;
      document.body.appendChild(a); a.click();
      window.URL.revokeObjectURL(url); a.remove();
      addLog(`EXPORTAÇÃO SUCESSO: Arquivo "${filename}" gerado para download.`, 'success');

    } catch (error: any) { addLog(`ERRO EXPORTAÇÃO: ${error.message}`, 'error'); }
    finally { setIsLoadingExport(false); }
  };

  // --- Renderização ---
  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 p-4 md:p-8">
      {/* Header */}
      <header className="text-center mb-10">
        <h1 className="text-3xl md:text-4xl font-bold text-cyan-400 mb-2">Identidade Soberana (DID/SSI)</h1>
        <p className="text-md md:text-lg text-gray-400">Prova de Conceito - Projeto Mestrado PGCOMP/UFBA</p>
        <p className="text-sm mt-1">Desenvolvido por: Tarson Marcelo Florêncio</p>
        <div className="mt-4 flex flex-col sm:flex-row justify-center items-center gap-4">
          <a href="https://github.com/florenciotarson/did-lab-ufba" target="_blank" rel="noopener noreferrer"
             className="text-cyan-500 hover:text-cyan-300 underline">
            Ver Código no GitHub
          </a>
          {userAddress ? (
            <span className="bg-gray-700 text-xs px-3 py-1 rounded-full" title={`Endereço Completo: ${userAddress}`}>
              Conectado: {userAddress.substring(0, 6)}...{userAddress.substring(userAddress.length - 4)}
            </span>
          ) : (
            <button
              onClick={connectWallet}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm py-1 px-3 rounded-md transition-colors disabled:opacity-50"
              disabled={typeof window !== 'undefined' && typeof window.ethereum === 'undefined'}
              title={typeof window !== 'undefined' && typeof window.ethereum === 'undefined' ? 'Instale a extensão MetaMask' : 'Conectar Carteira'}
            >
              Conectar MetaMask
            </button>
          )}
        </div>
      </header>

      {/* Colunas Principais */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-7xl mx-auto">
        {/* Coluna Esquerda */}
        <div className="space-y-8">
          {/* Pitch */}
          <section className="bg-gray-800 p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-3 text-cyan-400 border-b border-gray-700 pb-2">O Projeto</h2>
            <p className="text-sm mb-2">
              Este lab demonstra uma arquitetura de identidade digital focada em <strong>privacidade</strong>, <strong>soberania do usuário</strong> e <strong>inclusão</strong>,
              alinhada à LGPD e às pesquisas da RNP. Em contraste com modelos centralizados (Okta/OAuth),
              a Identidade Descentralizada (DID) devolve o controle criptográfico ao cidadão.
            </p>
            <p className="text-sm mb-2">
              Utilizando Smart Contracts (atuando como "Cartório" público na blockchain Sepolia) e armazenamento off-chain criptografado
              (gerenciado pelo backend), o sistema permite a <strong>verificação Zero-Knowledge</strong>: provar um fato
              (ex: "Matrícula Ativa") sem revelar os dados subjacentes (ex: CPF, nº de matrícula).
            </p>
            <p className="text-xs text-gray-500">
              PGCOMP/UFBA: Linha Sistemas Computacionais, Área RCSD. Tópicos: Blockchain, Web Descentralizada, Cibersegurança, Internet do Futuro, Tolerância a Falhas.
            </p>
          </section>

          {/* Verificação */}
          <section className="bg-gray-800 p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-3 text-cyan-400 border-b border-gray-700 pb-2">1. Verificação Pública (Zero-Knowledge)</h2>
            <p className="text-sm mb-4 text-gray-400">
              <strong>Instruções:</strong> Qualquer um pode usar esta seção. Cole o endereço de um usuário e a string JSON <i>exata</i> da credencial que você quer verificar. O sistema consultará a blockchain (sem custo) e dirá apenas se a prova (hash) existe e está ativa (VERDADEIRO) ou não (FALSO), <strong>sem revelar nenhum dado pessoal</strong>.
            </p>
            {/* Exemplo Clicável */}
            <div className="text-xs mb-4 p-3 bg-gray-700 rounded border border-yellow-600">
              <span className="font-semibold text-yellow-400 block mb-1">Exemplo para Teste:</span>
              (Use após emitir a credencial na seção 2 para este endereço):
              <div className="flex items-center gap-2 mt-1">
                <span className="w-12 inline-block font-medium">Endereço:</span>
                <code className="bg-gray-600 px-1 rounded grow break-all">{EXAMPLE_USER_ADDRESS}</code>
                <button onClick={() => copyToClipboard(EXAMPLE_USER_ADDRESS, 'address')}
                        className={`text-xs ${copyStatus === 'address' ? 'bg-green-600' : 'bg-gray-500 hover:bg-gray-400'} text-white px-2 py-0.5 rounded transition-colors`}
                        title="Copiar Endereço">
                  {copyStatus === 'address' ? 'Copiado!' : 'Copiar'}
                </button>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="w-12 inline-block font-medium">JSON:</span>
                <code className="bg-gray-600 px-1 rounded grow break-all">{EXAMPLE_CREDENTIAL_JSON}</code>
                <button onClick={() => copyToClipboard(EXAMPLE_CREDENTIAL_JSON, 'json')}
                        className={`text-xs ${copyStatus === 'json' ? 'bg-green-600' : 'bg-gray-500 hover:bg-gray-400'} text-white px-2 py-0.5 rounded transition-colors`}
                        title="Copiar JSON">
                  {copyStatus === 'json' ? 'Copiado!' : 'Copiar'}
                </button>
              </div>
            </div>
            {/* Formulário de Verificação */}
            <div className="space-y-3">
              <div>
                <label htmlFor="verifUsuario" className="block text-xs font-medium mb-1">Endereço do Usuário a Verificar:</label>
                <input id="verifUsuario" type="text" value={verificarUsuarioAddr} onChange={(e) => setVerificarUsuarioAddr(e.target.value)} placeholder="Cole o endereço aqui (ex: 0x...)" className="w-full text-sm bg-gray-700 border border-gray-600 rounded p-2 focus:ring-cyan-500 focus:border-cyan-500" />
              </div>
              <div>
                <label htmlFor="verifDados" className="block text-xs font-medium mb-1">Dados Exatos da Credencial (JSON String):</label>
                <input id="verifDados" type="text" value={verificarDadosJson} onChange={(e) => setVerificarDadosJson(e.target.value)} placeholder='Cole o JSON aqui (ex: {"status":"ATIVO", ...})' className="w-full text-sm bg-gray-700 border border-gray-600 rounded p-2 focus:ring-cyan-500 focus:border-cyan-500" />
              </div>
              <button onClick={handleVerificarCredencial} disabled={isLoadingVerificar} className={`w-full py-2 px-4 rounded font-semibold transition-colors text-sm flex items-center justify-center gap-2 ${isLoadingVerificar ? 'bg-gray-600 cursor-not-allowed' : 'bg-cyan-600 hover:bg-cyan-700'}`}>
                {isLoadingVerificar && <SpinnerIcon />}
                {isLoadingVerificar ? 'Verificando On-Chain...' : 'Verificar Credencial'}
              </button>
              {resultadoVerificacao !== null && (
                <div className={`mt-3 p-3 rounded text-center font-bold text-lg ${resultadoVerificacao ? 'bg-green-800 border-green-600' : 'bg-red-800 border-red-600'} border`}>
                  {resultadoVerificacao ? 'VERDADEIRO ✅' : 'FALSO ❌'}
                  <p className="text-xs font-normal mt-1">{resultadoVerificacao ? 'Prova válida encontrada na Blockchain!' : 'Prova inválida, revogada ou inexistente.'}</p>
                  <p className="text-xs font-mono mt-1 break-all">Hash Verificado: {hashVerificado || 'N/A'}</p>
                </div>
              )}
            </div>
          </section>

          {/* Backup */}
          <section className="bg-gray-800 p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-3 text-purple-400 border-b border-gray-700 pb-2 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-purple-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              4. Backup Seguro (Exportação de Dados)
            </h2>
            <p className="text-sm mb-4 text-gray-400">
              <strong>Instruções:</strong> Conecte sua carteira. Clique no botão abaixo para gerar um arquivo JSON contendo <strong>todos os seus dados de credenciais armazenados nesta plataforma (de forma criptografada)</strong>. Guarde este arquivo em local seguro. Ele permite restaurar sua identidade em outra plataforma compatível, garantindo sua portabilidade e soberania.
            </p>
            <button
              onClick={handleExportarDados}
              disabled={isLoadingExport || !userAddress}
              className={`w-full py-2 px-4 rounded font-semibold transition-colors text-sm flex items-center justify-center gap-2 ${isLoadingExport || !userAddress ? 'bg-gray-600 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700'}`}
              title={!userAddress ? 'Conecte sua carteira MetaMask primeiro' : 'Exportar seus dados criptografados'}
            >
              {isLoadingExport && <SpinnerIcon />}
              {isLoadingExport ? 'Gerando Backup...' : 'Exportar Minha Carteira de Dados'}
            </button>
            {!userAddress && <p className="text-xs text-yellow-400 text-center mt-2">Conecte sua carteira para habilitar a exportação.</p>}
          </section>
        </div>

        {/* Coluna Direita */}
        <div className="space-y-8">
          {/* Emissão */}
          <section className="bg-gray-800 p-6 rounded-lg shadow-md border-l-4 border-orange-600">
            <h2 className="text-xl font-semibold mb-3 text-orange-400 border-b border-gray-700 pb-2 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-orange-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.562-.966.431-1.563A6 6 0 1 1 21.75 8.25Z" />
              </svg>
              2. Emissão de Credencial (Com Prova On-Chain)
            </h2>
            <p className="text-sm mb-4 text-gray-400">
              <strong>Instruções:</strong> Use esta seção para emitir novas credenciais para um endereço de usuário. A API usa a chave privada do Emissor configurada no backend para registrar o hash na blockchain (isso consome ETH de teste da Sepolia) e salvar os metadados/blob no banco de dados.
            </p>
            <div className="space-y-3">
              <div>
                <label htmlFor="emitUsuario" className="block text-xs font-medium mb-1">Endereço do Usuário (Para quem emitir):</label>
                <input id="emitUsuario" type="text" value={emitirUsuarioAddr} onChange={(e) => setEmitirUsuarioAddr(e.target.value)} placeholder="Cole o endereço do destinatário (ex: 0x...)" className="w-full text-sm bg-gray-700 border border-gray-600 rounded p-2 focus:ring-orange-500 focus:border-orange-500" />
              </div>
              <div>
                <label htmlFor="emitDados" className="block text-xs font-medium mb-1">Dados da Credencial (JSON String - O que será provado):</label>
                <input id="emitDados" type="text" value={emitirDadosJson} onChange={(e) => setEmitirDadosJson(e.target.value)} placeholder='{"status":"ATIVO", "curso":"PGCOMP"}' className="w-full text-sm bg-gray-700 border border-gray-600 rounded p-2 focus:ring-orange-500 focus:border-orange-500" />
              </div>
              <div>
                <label htmlFor="emitNome" className="block text-xs font-medium mb-1">Nome Amigável (Opcional - para UI):</label>
                <input id="emitNome" type="text" value={emitirNomeAmigavel} onChange={(e) => setEmitirNomeAmigavel(e.target.value)} placeholder="Ex: Atestado de Matrícula" className="w-full text-sm bg-gray-700 border border-gray-600 rounded p-2 focus:ring-orange-500 focus:border-orange-500" />
              </div>
              <div>
                <label htmlFor="emitDesc" className="block text-xs font-medium mb-1">Descrição (Opcional - para UI):</label>
                <input id="emitDesc" type="text" value={emitirDescricao} onChange={(e) => setEmitirDescricao(e.target.value)} placeholder="Ex: Válido para o semestre 2026.1" className="w-full text-sm bg-gray-700 border border-gray-600 rounded p-2 focus:ring-orange-500 focus:border-orange-500" />
              </div>
              <button onClick={handleEmitirCredencial} disabled={isLoadingEmitir} className={`w-full py-2 px-4 rounded font-semibold transition-colors text-sm flex items-center justify-center gap-2 ${isLoadingEmitir ? 'bg-gray-600 cursor-not-allowed' : 'bg-orange-600 hover:bg-orange-700'}`}>
                {isLoadingEmitir && <SpinnerIcon />}
                {isLoadingEmitir ? 'Emitindo (Blockchain + DB)...' : 'Emitir Nova Credencial'}
              </button>
            </div>
          </section>

          {/* Revogação */}
          <section className="bg-gray-800 p-6 rounded-lg shadow-md border-l-4 border-red-600">
            <h2 className="text-xl font-semibold mb-3 text-red-400 border-b border-gray-700 pb-2 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-red-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
              </svg>
              3. Revogar Minha Credencial (On-Chain)
            </h2>
            <p className="text-sm mb-4 text-gray-400">
              <strong>Instruções:</strong> Conecte a carteira MetaMask que possui a credencial. Insira a string JSON <i>exata</i> da credencial que você deseja revogar (invalidar) no "Cartório Digital". Esta ação chamará o Smart Contract diretamente e exigirá uma assinatura e o pagamento de gás (taxa) na rede Sepolia.
            </p>
            <div className="space-y-3">
              <div>
                <label htmlFor="revokeDados" className="block text-xs font-medium mb-1">Dados Exatos da Credencial a Revogar (JSON String):</label>
                <input
                  id="revokeDados"
                  type="text"
                  value={revogarDadosJson}
                  onChange={(e) => setRevogarDadosJson(e.target.value)}
                  placeholder="Cole o JSON da credencial a revogar"
                  className="w-full text-sm bg-gray-700 border border-gray-600 rounded p-2 focus:ring-red-500 focus:border-red-500"
                  disabled={!userAddress}
                />
              </div>
              <button
                onClick={handleRevogarCredencial}
                disabled={isLoadingRevoke || !userAddress}
                className={`w-full py-2 px-4 rounded font-semibold transition-colors text-sm flex items-center justify-center gap-2 ${isLoadingRevoke || !userAddress ? 'bg-gray-600 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'}`}
                title={!userAddress ? 'Conecte sua carteira MetaMask primeiro' : 'Revogar credencial na blockchain'}
              >
                {isLoadingRevoke && <SpinnerIcon />}
                {isLoadingRevoke ? 'Revogando On-Chain...' : 'Revogar Credencial'}
              </button>
              {!userAddress && <p className="text-xs text-yellow-400 text-center mt-2">Conecte sua carteira para habilitar a revogação.</p>}
            </div>
          </section>

          {/* Logs */}
          <section className="bg-gray-800 p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-3 text-gray-400 border-b border-gray-700 pb-2">Logs de Atividade</h2>
            <div
              ref={logContainerRef}
              className="bg-gray-900 p-3 rounded overflow-y-auto h-80 text-xs font-mono border border-gray-700 leading-relaxed whitespace-pre-wrap"
            >
              {logs.length > 0 ? logs.map((log, index) => (
                <p key={index} className={`mb-1 ${getLogColor(log.level)}`}>
                  <span className="mr-1">{getLogEmoji(log.level)}</span>
                  <span className="text-gray-500 mr-2">{log.timestamp}</span>
                  <span
                    dangerouslySetInnerHTML={{
                      __html: log.message.replace(
                        /(https:\/\/sepolia\.etherscan\.io\/tx\/[a-zA-Z0-9]+)/g,
                        '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-blue-400 underline hover:text-blue-300">$1</a>'
                      )
                    }}
                  />
                </p>
              )) : (
                <p className="text-gray-500">Nenhuma atividade registrada ainda... Conecte sua carteira e use os botões acima.</p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

// Spinner
const SpinnerIcon = () => (
  <svg className="animate-spin -ml-1 mr-1 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

export default LabDIDPage;
