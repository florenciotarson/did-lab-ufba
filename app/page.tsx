// app/page.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import canonicalize from 'canonicalize';
import {
  isAddress,
  BrowserProvider,
  JsonRpcSigner,
  Contract,
  keccak256,
  toUtf8Bytes,
} from 'ethers';
import abi from '@/lib/IdentidadeDID_ABI.json';
import { encryptJSON } from '@/lib/cryptoClient.js';

declare global { interface Window { ethereum?: any; } }

type LogLevel = 'info' | 'success' | 'error' | 'step';
interface LogEntry { timestamp: string; level: LogLevel; message: string; }

const EXAMPLE_USER_ADDRESS = '0xSEU_ENDERECO_DE_TESTE_AQUI';
const EXAMPLE_CREDENTIAL_JSON = '{"status":"ATIVO", "curso":"PGCOMP"}';

const Page: React.FC = () => {
  // ---- Estado base ----
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [userAddress, setUserAddress] = useState<string | null>(null);
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [signer, setSigner] = useState<JsonRpcSigner | null>(null);
  const providerRef = useRef<BrowserProvider | null>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // ---- Emissão ----
  const [emitirUsuarioAddr, setEmitirUsuarioAddr] = useState('');
  const [emitirDadosJson, setEmitirDadosJson] = useState(EXAMPLE_CREDENTIAL_JSON);
  const [emitirNomeAmigavel, setEmitirNomeAmigavel] = useState('Matrícula Ativa PGCOMP');
  const [emitirDescricao, setEmitirDescricao] = useState(`Emitido em ${new Date().toLocaleDateString()}`);
  const [emitirSenha, setEmitirSenha] = useState('');
  const [isLoadingEmitir, setIsLoadingEmitir] = useState(false);
  const [showEmitirHelp, setShowEmitirHelp] = useState(true);

  // ---- Verificação ----
  const [verificarUsuarioAddr, setVerificarUsuarioAddr] = useState('');
  const [verificarDadosJson, setVerificarDadosJson] = useState(EXAMPLE_CREDENTIAL_JSON);
  const [isLoadingVerificar, setIsLoadingVerificar] = useState(false);
  const [resultadoVerificacao, setResultadoVerificacao] = useState<boolean | null>(null);
  const [hashVerificado, setHashVerificado] = useState<string | null>(null);
  const [showVerificarHelp, setShowVerificarHelp] = useState(true);

  // ---- Revogação ----
  const [revogarDadosJson, setRevogarDadosJson] = useState(EXAMPLE_CREDENTIAL_JSON);
  const [isLoadingRevoke, setIsLoadingRevoke] = useState(false);
  const [showRevogarHelp, setShowRevogarHelp] = useState(true);

  // ---- Exportação ----
  const [isLoadingExport, setIsLoadingExport] = useState(false);
  const [showExportarHelp, setShowExportarHelp] = useState(true);

  // ---- UI: cópia ----
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  // ========== Helpers de UX ==========
  const addLog = (message: string, level: LogLevel = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    const newEntry: LogEntry = { timestamp, level, message };
    setLogs(prev => [newEntry, ...prev.slice(0, 199)]);
    setTimeout(() => { if (logContainerRef.current) logContainerRef.current.scrollTop = 0; }, 50);
    // eslint-disable-next-line no-console
    console.log(`[${level.toUpperCase()}] ${message}`);
  };

  const getLogColor = (level: LogLevel) =>
    level === 'success' ? 'text-green-400' :
    level === 'error' ? 'text-red-400' :
    level === 'step' ? 'text-yellow-400' : 'text-gray-400';

  const getLogEmoji = (level: LogLevel) =>
    level === 'success' ? '✅' : level === 'error' ? '❌' : level === 'step' ? '➡️' : '🔵';

  const safeJsonParse = (s: string) => { try { JSON.parse(s); return true; } catch { return false; } };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus(label);
      setTimeout(() => setCopyStatus(null), 1200);
      addLog(`${label} copiado para a área de transferência.`, 'success');
    } catch {
      addLog(`Falha ao copiar ${label}.`, 'error');
    }
  };

  // hash canônico (RFC 8785) com checagem
  const computeCanonicalHashLocal = (jsonStr: string) => {
    const obj = JSON.parse(jsonStr);
    const canon = canonicalize(obj);
    if (typeof canon !== 'string') throw new Error('Falha ao canonicalizar o JSON.');
    return keccak256(toUtf8Bytes(canon));
  };

  // pequena prévia do hash (para UX)
  const tryHash = (jsonStr: string): string | null => {
    try { if (!safeJsonParse(jsonStr)) return null; return computeCanonicalHashLocal(jsonStr); }
    catch { return null; }
  };

  // ========== Wallet ==========
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleAccountsChanged = async (accs: string[]) => {
      const ethProvider = providerRef.current;
      if (!ethProvider) return;
      if (accs.length > 0) {
        const addr = accs[0];
        setUserAddress(addr);
        try { const s = await ethProvider.getSigner(addr); setSigner(s); addLog(`Conta selecionada: ${addr.substring(0,6)}...`, 'info'); }
        catch { setSigner(null); addLog('Erro ao obter signer da conta selecionada.', 'error'); }
      } else { setUserAddress(null); setSigner(null); addLog('Carteira desconectada.', 'info'); }
    };

    const init = async () => {
      if (!window.ethereum) { addLog('MetaMask não detectado. Instale a extensão para usar revogação e exportação.', 'error'); return; }
      const ethProvider = new BrowserProvider(window.ethereum);
      providerRef.current = ethProvider;
      setProvider(ethProvider);
      const accs = await ethProvider.listAccounts();
      if (accs.length > 0) {
        const addr = accs[0].address;
        setUserAddress(addr);
        try { const s = await ethProvider.getSigner(addr); setSigner(s); addLog(`Carteira reconectada: ${addr.substring(0,6)}...`, 'success'); }
        catch { addLog('Falha ao recuperar signer da carteira atual.', 'error'); }
      }
      window.ethereum.on('accountsChanged', handleAccountsChanged);
    };
    init();

    return () => { if (window.ethereum?.removeListener) window.ethereum.removeListener('accountsChanged', handleAccountsChanged); };
  }, []);

  const connectWallet = async () => {
    const currentProvider = providerRef.current || (window.ethereum ? new BrowserProvider(window.ethereum) : null);
    if (!currentProvider) { addLog('MetaMask não detectado.', 'error'); return; }
    if (!providerRef.current) { providerRef.current = currentProvider; setProvider(currentProvider); }
    try {
      addLog('Solicitando conexão com MetaMask...', 'step');
      const accounts = await currentProvider.send('eth_requestAccounts', []) as string[];
      if (accounts.length > 0) {
        const addr = accounts[0];
        setUserAddress(addr);
        const s = await currentProvider.getSigner(addr);
        setSigner(s);
        addLog(`Carteira conectada: ${addr.substring(0,6)}...`, 'success');
      }
    } catch (e: any) {
      addLog(`Conexão cancelada: ${e.message}`, 'error');
    }
  };

  // ========== Ações ==========
  const handleEmitir = async () => {
    if (!isAddress(emitirUsuarioAddr)) { addLog('Endereço do destinatário inválido.', 'error'); return; }
    if (!safeJsonParse(emitirDadosJson)) { addLog('JSON inválido para emissão.', 'error'); return; }

    setIsLoadingEmitir(true); setResultadoVerificacao(null); setHashVerificado(null);
    addLog('EMISSÃO: iniciando...', 'step');

    try {
      const hashVerificacao = computeCanonicalHashLocal(emitirDadosJson);
      const seguro = emitirSenha.trim().length > 0;

      const body = seguro
        ? {
            usuarioAddress: emitirUsuarioAddr,
            hashVerificacao,
            blobCriptografado: await encryptJSON(emitirDadosJson, emitirSenha),
            nomeAmigavel: emitirNomeAmigavel,
            descricao: emitirDescricao,
          }
        : {
            usuarioAddress: emitirUsuarioAddr,
            dadosCredencialJsonString: emitirDadosJson,
            nomeAmigavel: emitirNomeAmigavel,
            descricao: emitirDescricao,
          };

      const res = await fetch('/api/emitir', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
      addLog(`EMISSÃO: ${data.message}`, 'success');
      addLog(`ID no DB: ${data.idDb}`, 'info');
      addLog(`Hash canônico: ${data.hashVerificacao}`, 'info');
      addLog(`Transação: ${data.txHashOnChain ? `https://sepolia.etherscan.io/tx/${data.txHashOnChain}` : '(já existia on-chain)'}`, 'info');
    } catch (e: any) {
      addLog(`Falha na emissão: ${e.message}`, 'error');
    } finally {
      setIsLoadingEmitir(false);
    }
  };

  const handleVerificar = async () => {
    if (!isAddress(verificarUsuarioAddr)) { addLog('Endereço do usuário inválido para verificação.', 'error'); return; }
    if (!safeJsonParse(verificarDadosJson)) { addLog('JSON inválido para verificação.', 'error'); return; }

    setIsLoadingVerificar(true); setResultadoVerificacao(null); setHashVerificado(null);
    addLog('VERIFICAÇÃO: calculando hash local e consultando blockchain...', 'step');

    try {
      const hashVerificacao = computeCanonicalHashLocal(verificarDadosJson);
      const res = await fetch('/api/verificar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usuarioAddress: verificarUsuarioAddr, hashVerificacao }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);

      setResultadoVerificacao(data.verificado);
      setHashVerificado(data.hashVerificacao);
      addLog(`VERIFICAÇÃO: ${data.verificado ? 'VERDADEIRO ✅' : 'FALSO ❌'}`, data.verificado ? 'success' : 'error');
    } catch (e: any) {
      addLog(`Falha na verificação: ${e.message}`, 'error');
    } finally {
      setIsLoadingVerificar(false);
    }
  };

  const handleRevogar = async () => {
    if (!signer || !userAddress) { addLog('Conecte sua carteira para revogar.', 'error'); connectWallet(); return; }
    if (!safeJsonParse(revogarDadosJson)) { addLog('JSON inválido para revogação.', 'error'); return; }
    const contractAddress = process.env.NEXT_PUBLIC_CONTRATO_ENDERECO;
    if (!contractAddress || !isAddress(contractAddress)) { addLog('Contrato não configurado corretamente (.env).', 'error'); return; }

    setIsLoadingRevoke(true);
    addLog('REVOGAÇÃO: gerando hash e enviando transação...', 'step');
    try {
      const canon = canonicalize(JSON.parse(revogarDadosJson));
      if (typeof canon !== 'string') throw new Error('Falha ao canonicalizar JSON.');
      const hash = keccak256(toUtf8Bytes(canon));
      const contrato = new Contract(contractAddress, abi, signer);
      const tx = await contrato.revogarCredencial(hash);
      addLog(`TX enviada: ${tx.hash} — aguardando 1 bloco...`, 'info');
      const rc = await tx.wait(1);
      if (rc?.status === 1) {
        addLog('REVOGAÇÃO concluída com sucesso!', 'success');
        addLog(`Etherscan: https://sepolia.etherscan.io/tx/${tx.hash}`, 'info');
      } else throw new Error(`Transação falhou (status ${rc?.status})`);
    } catch (e: any) {
      addLog(`Falha na revogação: ${e.reason || e.message}`, 'error');
    } finally {
      setIsLoadingRevoke(false);
    }
  };

  const handleExportar = async () => {
    if (!userAddress) { addLog('Conecte sua carteira para exportar.', 'error'); connectWallet(); return; }
    setIsLoadingExport(true);
    addLog('EXPORTAÇÃO: preparando seu arquivo de backup...', 'step');
    try {
      const res = await fetch(`/api/exportar?userAddress=${userAddress}`);
      if (!res.ok) {
        let m = `HTTP ${res.status}`; try { const d = await res.json(); m = d.message || m; } catch {}
        throw new Error(m);
      }
      const disp = res.headers.get('content-disposition');
      let filename = `did_lab_backup_${userAddress.substring(0,6)}_${Date.now()}.json`;
      if (disp && disp.includes('attachment')) {
        const m = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(disp);
        if (m?.[1]) filename = m[1].replace(/['"]/g, '');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = filename; a.style.display = 'none';
      document.body.appendChild(a); a.click(); URL.revokeObjectURL(url); a.remove();
      addLog(`Backup gerado: ${filename}`, 'success');
    } catch (e: any) {
      addLog(`Falha na exportação: ${e.message}`, 'error');
    } finally {
      setIsLoadingExport(false);
    }
  };

  // ========== UI ==========
  const hint = (txt: string) => <span className="text-xs text-gray-400">{txt}</span>;
  const HashPreview = ({ jsonStr, label }: { jsonStr: string; label: string }) => {
    const h = tryHash(jsonStr);
    if (!h) return hint('Hash aparecerá aqui quando o JSON for válido.');
    return (
      <div className="flex items-center gap-2 mt-1 text-xs">
        <span className="text-gray-400">Hash canônico:</span>
        <code className="bg-gray-700 px-2 py-0.5 rounded break-all">{h}</code>
        <button
          onClick={() => copyToClipboard(h, `${label} (hash)`)}
          className={`text-xs ${copyStatus === `${label} (hash)` ? 'bg-green-600' : 'bg-gray-600 hover:bg-gray-500'} text-white px-2 py-0.5 rounded`}
          title="Copiar hash"
        >
          {copyStatus === `${label} (hash)` ? 'Copiado!' : 'Copiar'}
        </button>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 p-4 md:p-8">
      {/* Header */}
      <header className="max-w-7xl mx-auto mb-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-cyan-400">Identidade Soberana (DID/SSI)</h1>
            <p className="text-gray-400">Prova de Conceito — PGCOMP/UFBA • Desenvolvido por: Tarson Marcelo Florêncio </p>
          </div>
          <div className="flex items-center gap-3">
            {userAddress ? (
              <span className="bg-gray-800 border border-gray-700 text-xs px-3 py-1 rounded-full" title={userAddress}>
                Conectado: {userAddress.substring(0,6)}...{userAddress.substring(userAddress.length-4)}
              </span>
            ) : (
              <button
                onClick={connectWallet}
                className="bg-blue-600 hover:bg-blue-700 text-white text-sm py-2 px-3 rounded-md"
                title="Conectar MetaMask"
              >
                Conectar MetaMask
              </button>
            )}
            <a
              href="https://github.com/florenciotarson/did-lab-ufba"
              target="_blank" rel="noopener noreferrer"
              className="text-cyan-400 hover:text-cyan-300 underline text-sm"
            >
              Código no GitHub
            </a>
          </div>
        </div>

        {/* O Projeto (texto institucional, sem redundância com o "Como funciona") */}
        <div className="mt-4 bg-gray-800 border border-gray-700 rounded p-4 text-sm">
          <h3 className="text-lg font-semibold text-cyan-400 border-b border-gray-700 pb-2">O Projeto</h3>

          <p className="mt-3 text-gray-300">
            Este lab demonstra uma arquitetura de identidade digital centrada em
            <strong> privacidade</strong>, <strong>soberania do usuário</strong> e <strong>inclusão</strong>,
            alinhada à <strong>LGPD</strong> e às pesquisas da <strong>RNP</strong>. Em contraste com
            modelos centralizados (Okta/OAuth), a <strong>Identidade Descentralizada (DID)</strong> 
            devolve o controle criptográfico ao cidadão.
          </p>

          <p className="mt-2 text-gray-300">
            A prova é ancorada por <strong>Smart Contracts</strong> — atuando como um “cartório”
            público na blockchain <strong>Sepolia</strong> — e por <strong>armazenamento off-chain
            cifrado</strong> gerenciado pelo backend. O sistema permite a <strong>verificação
            Zero-Knowledge</strong>: provar um fato (ex.: “Matrícula Ativa”) sem revelar os dados
            subjacentes (ex.: CPF, nº de matrícula).
          </p>

          <p className="mt-2 text-xs text-gray-400">
            PGCOMP/UFBA — Linha: Sistemas Computacionais • Área: RCSD.
            Tópicos: Blockchain, Web Descentralizada, Cibersegurança, Internet do Futuro, Tolerância a Falhas.
          </p>
        </div>

        {/* Resumo didático */}
        <div className="mt-4 bg-gray-800 border border-gray-700 rounded p-4 text-sm">
          <p className="mb-2">
            <strong>Como funciona:</strong> a credencial é um JSON. Calculamos um <em>hash canônico</em> desse JSON e
            registramos apenas o hash na blockchain (<em>cartório</em>). O JSON (seu dado pessoal) fica cifrado
            <em> no cliente</em> e armazenado off-chain. Na verificação, você envia só o hash — e recebe <code>true/false</code>.
          </p>
          <ul className="list-disc pl-5 text-gray-300">
            <li><strong>Privacidade:</strong> seus dados nunca são gravados na blockchain.</li>
            <li><strong>Soberania:</strong> você pode <em>revogar</em> qualquer credencial com sua carteira.</li>
            <li><strong>Portabilidade:</strong> faça <em>backup</em> de tudo em um arquivo (cifrado).</li>
          </ul>
        </div>
      </header>

      {/* Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-7xl mx-auto">

        {/* 1. Verificação */}
        <section className="bg-gray-800 p-6 rounded-lg shadow-md border-l-4 border-cyan-600">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-cyan-400">1. Verificação Pública</h2>
            <button
              onClick={() => setShowVerificarHelp(s => !s)}
              className="text-xs underline text-gray-300 hover:text-white"
            >
              {showVerificarHelp ? 'Ocultar instruções' : 'Mostrar instruções'}
            </button>
          </div>
          {showVerificarHelp && (
            <ol className="mt-3 text-sm text-gray-300 space-y-2">
              <li><strong>1)</strong> Cole o <em>endereço do titular</em> da credencial.</li>
              <li><strong>2)</strong> Cole a <em>string JSON exata</em> (precisa bater 100%).</li>
              <li><strong>3)</strong> Clique <em>Verificar</em>. A UI calcula o hash e a blockchain responde <code>true/false</code>.</li>
              <li className="text-yellow-300"><strong>Dica:</strong> use os exemplos abaixo ou gere sua própria credencial na seção 2.</li>
            </ol>
          )}

          {/* Exemplos */}
          <div className="mt-4 text-xs p-3 bg-gray-700 rounded border border-yellow-600">
            <div className="flex items-center gap-2">
              <span className="w-16 inline-block">Endereço:</span>
              <code className="bg-gray-600 px-2 rounded grow break-all">{EXAMPLE_USER_ADDRESS}</code>
              <button
                onClick={() => copyToClipboard(EXAMPLE_USER_ADDRESS, 'Endereço de exemplo')}
                className={`text-xs ${copyStatus ? 'bg-green-600' : 'bg-gray-600 hover:bg-gray-500'} text-white px-2 py-0.5 rounded`}
              >
                {copyStatus ? 'Copiado!' : 'Copiar'}
              </button>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className="w-16 inline-block">JSON:</span>
              <code className="bg-gray-600 px-2 rounded grow break-all">{EXAMPLE_CREDENTIAL_JSON}</code>
              <button
                onClick={() => copyToClipboard(EXAMPLE_CREDENTIAL_JSON, 'JSON de exemplo')}
                className="text-xs bg-gray-600 hover:bg-gray-500 text-white px-2 py-0.5 rounded"
              >
                Copiar
              </button>
            </div>
          </div>

          {/* Form Verificação */}
          <div className="mt-4 space-y-3">
            <div>
              <label htmlFor="verifAddr" className="block text-xs mb-1">Endereço do Usuário</label>
              <input
                id="verifAddr" type="text" value={verificarUsuarioAddr}
                onChange={(e) => setVerificarUsuarioAddr(e.target.value)}
                placeholder="0x..."
                className="w-full text-sm bg-gray-700 border border-gray-600 rounded p-2 focus:ring-cyan-500 focus:border-cyan-500"
                aria-describedby="verifAddrHelp"
              />
              <div id="verifAddrHelp" className="text-xs text-gray-400 mt-1">O endereço do titular da credencial.</div>
            </div>
            <div>
              <label htmlFor="verifJson" className="block text-xs mb-1">Dados da Credencial (JSON — exato)</label>
              <input
                id="verifJson" type="text" value={verificarDadosJson}
                onChange={(e) => setVerificarDadosJson(e.target.value)}
                placeholder='{"status":"ATIVO","curso":"PGCOMP"}'
                className="w-full text-sm bg-gray-700 border border-gray-600 rounded p-2 focus:ring-cyan-500 focus:border-cyan-500"
              />
              <HashPreview jsonStr={verificarDadosJson} label="Verificação" />
            </div>
            <button
              onClick={handleVerificar}
              disabled={isLoadingVerificar}
              className={`w-full py-2 px-4 rounded font-semibold transition-colors text-sm ${isLoadingVerificar ? 'bg-gray-600' : 'bg-cyan-600 hover:bg-cyan-700'}`}
            >
              {isLoadingVerificar ? 'Verificando...' : 'Verificar Credencial'}
            </button>

            {resultadoVerificacao !== null && (
              <div className={`mt-3 p-3 rounded text-center font-bold text-lg ${resultadoVerificacao ? 'bg-green-800 border-green-600' : 'bg-red-800 border-red-600'} border`}>
                {resultadoVerificacao ? 'VERDADEIRO ✅' : 'FALSO ❌'}
                <p className="text-xs font-normal mt-1">{resultadoVerificacao ? 'Prova válida encontrada na blockchain.' : 'Prova inválida, revogada ou inexistente.'}</p>
                {hashVerificado && <p className="text-[11px] font-mono mt-1 break-all">Hash verificado: {hashVerificado}</p>}
              </div>
            )}
          </div>
        </section>

        {/* 2. Emissão */}
        <section className="bg-gray-800 p-6 rounded-lg shadow-md border-l-4 border-orange-600">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-orange-400">2. Emissão de Credencial</h2>
            <button
              onClick={() => setShowEmitirHelp(s => !s)}
              className="text-xs underline text-gray-300 hover:text-white"
            >
              {showEmitirHelp ? 'Ocultar instruções' : 'Mostrar instruções'}
            </button>
          </div>
          {showEmitirHelp && (
            <ol className="mt-3 text-sm text-gray-300 space-y-2">
              <li><strong>1)</strong> Cole o <em>endereço do destinatário</em>.</li>
              <li><strong>2)</strong> Informe o <em>JSON da credencial</em> (será usado para o hash canônico).</li>
              <li><strong>3)</strong> (Recomendado) Defina uma <em>senha</em> — os dados serão <strong>cifrados no navegador</strong> (AES-GCM + PBKDF2) e o servidor recebe apenas o <em>ciphertext</em>.</li>
              <li><strong>4)</strong> Clique em <em>Emitir</em>. O backend registra o <em>hash</em> na blockchain (Sepolia) e salva o ciphertext + metadados.</li>
              <li className="text-yellow-300"><strong>Dica:</strong> sem senha, o JSON vai em claro para o backend (modo LEGADO, apenas para PoC).</li>
            </ol>
          )}

          <div className="mt-4 space-y-3">
            <div>
              <label htmlFor="emitAddr" className="block text-xs mb-1">Endereço do Usuário (destinatário)</label>
              <input
                id="emitAddr" type="text" value={emitirUsuarioAddr}
                onChange={(e) => setEmitirUsuarioAddr(e.target.value)}
                placeholder="0x..."
                className="w-full text-sm bg-gray-700 border border-gray-600 rounded p-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
            <div>
              <label htmlFor="emitJson" className="block text-xs mb-1">Dados da Credencial (JSON)</label>
              <input
                id="emitJson" type="text" value={emitirDadosJson}
                onChange={(e) => setEmitirDadosJson(e.target.value)}
                placeholder='{"status":"ATIVO","curso":"PGCOMP"}'
                className="w-full text-sm bg-gray-700 border border-gray-600 rounded p-2 focus:ring-orange-500 focus:border-orange-500"
              />
              <HashPreview jsonStr={emitirDadosJson} label="Emissão" />
            </div>
            <div>
              <label htmlFor="emitSenha" className="block text-xs mb-1">Senha (opcional, recomendado)</label>
              <input
                id="emitSenha" type="password" value={emitirSenha}
                onChange={(e) => setEmitirSenha(e.target.value)}
                placeholder="Defina uma senha para cifrar os dados no cliente"
                className="w-full text-sm bg-gray-700 border border-gray-600 rounded p-2 focus:ring-orange-500 focus:border-orange-500"
              />
              <p className="text-[11px] text-gray-400 mt-1">Com senha: armazenamos apenas o ciphertext. Sem senha: PoC/legado.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs mb-1">Nome Amigável (UI)</label>
                <input
                  type="text" value={emitirNomeAmigavel}
                  onChange={(e) => setEmitirNomeAmigavel(e.target.value)}
                  placeholder="Ex: Atestado de Matrícula"
                  className="w-full text-sm bg-gray-700 border border-gray-600 rounded p-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-xs mb-1">Descrição (UI)</label>
                <input
                  type="text" value={emitirDescricao}
                  onChange={(e) => setEmitirDescricao(e.target.value)}
                  placeholder="Ex: Válido para o semestre 2026.1"
                  className="w-full text-sm bg-gray-700 border border-gray-600 rounded p-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
            </div>
            <button
              onClick={handleEmitir}
              disabled={isLoadingEmitir}
              className={`w-full py-2 px-4 rounded font-semibold transition-colors text-sm ${isLoadingEmitir ? 'bg-gray-600' : 'bg-orange-600 hover:bg-orange-700'}`}
            >
              {isLoadingEmitir ? 'Emitindo (Blockchain + DB)...' : 'Emitir Nova Credencial'}
            </button>
          </div>
        </section>

        {/* 3. Revogação */}
        <section className="bg-gray-800 p-6 rounded-lg shadow-md border-l-4 border-red-600">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-red-400">3. Revogar Minha Credencial</h2>
            <button
              onClick={() => setShowRevogarHelp(s => !s)}
              className="text-xs underline text-gray-300 hover:text-white"
            >
              {showRevogarHelp ? 'Ocultar instruções' : 'Mostrar instruções'}
            </button>
          </div>
          {showRevogarHelp && (
            <ol className="mt-3 text-sm text-gray-300 space-y-2">
              <li><strong>1)</strong> <em>Conecte</em> a carteira que recebeu a credencial.</li>
              <li><strong>2)</strong> Cole a <em>string JSON exata</em> da credencial.</li>
              <li><strong>3)</strong> Clique em <em>Revogar</em>. Uma transação será enviada — é preciso pagar gás (Sepolia).</li>
              <li><strong>4)</strong> Após 1 bloco, você verá o link da transação no Etherscan.</li>
            </ol>
          )}

          <div className="mt-4 space-y-3">
            <div>
              <label htmlFor="revJson" className="block text-xs mb-1">Dados da Credencial (JSON — exato)</label>
              <input
                id="revJson" type="text" value={revogarDadosJson}
                onChange={(e) => setRevogarDadosJson(e.target.value)}
                placeholder='{"status":"ATIVO","curso":"PGCOMP"}'
                className="w-full text-sm bg-gray-700 border border-gray-600 rounded p-2 focus:ring-red-500 focus:border-red-500"
                disabled={!userAddress}
              />
              <HashPreview jsonStr={revogarDadosJson} label="Revogação" />
            </div>
            <button
              onClick={handleRevogar}
              disabled={isLoadingRevoke || !userAddress}
              className={`w-full py-2 px-4 rounded font-semibold transition-colors text-sm ${isLoadingRevoke || !userAddress ? 'bg-gray-600' : 'bg-red-600 hover:bg-red-700'}`}
              title={!userAddress ? 'Conecte sua carteira primeiro' : 'Enviar transação de revogação'}
            >
              {isLoadingRevoke ? 'Revogando On-Chain...' : 'Revogar Credencial'}
            </button>
            {!userAddress && <p className="text-xs text-yellow-300 text-center">Conecte sua carteira para habilitar a revogação.</p>}
          </div>
        </section>

        {/* 4. Backup */}
        <section className="bg-gray-800 p-6 rounded-lg shadow-md border-l-4 border-purple-600">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-purple-400">4. Backup Seguro (Exportação)</h2>
            <button
              onClick={() => setShowExportarHelp(s => !s)}
              className="text-xs underline text-gray-300 hover:text-white"
            >
              {showExportarHelp ? 'Ocultar instruções' : 'Mostrar instruções'}
            </button>
          </div>
          {showExportarHelp && (
            <ol className="mt-3 text-sm text-gray-300 space-y-2">
              <li><strong>1)</strong> <em>Conecte</em> a carteira do titular.</li>
              <li><strong>2)</strong> Clique em <em>Exportar</em>. Baixaremos um arquivo com todos os seus <strong>ciphertexts</strong> e metadados.</li>
              <li><strong>3)</strong> Guarde esse arquivo em local seguro. Ele só é útil junto da <strong>senha</strong> usada na emissão.</li>
              <li className="text-yellow-300"><strong>Dica:</strong> futuramente, a mesma UI terá “Importar backup”.</li>
            </ol>
          )}

          <button
            onClick={handleExportar}
            disabled={isLoadingExport || !userAddress}
            className={`w-full mt-4 py-2 px-4 rounded font-semibold transition-colors text-sm ${isLoadingExport || !userAddress ? 'bg-gray-600' : 'bg-purple-600 hover:bg-purple-700'}`}
          >
            {isLoadingExport ? 'Gerando Backup...' : 'Exportar Minha Carteira de Dados'}
          </button>
          {!userAddress && <p className="text-xs text-yellow-300 text-center mt-2">Conecte sua carteira para habilitar a exportação.</p>}
        </section>

        {/* Logs */}
        <section className="bg-gray-800 p-6 rounded-lg shadow-md lg:col-span-2">
          <h2 className="text-xl font-semibold mb-3 text-gray-300 border-b border-gray-700 pb-2">Logs de Atividade</h2>
          <div
            ref={logContainerRef}
            className="bg-gray-900 p-3 rounded overflow-y-auto h-96 text-xs font-mono border border-gray-700 leading-relaxed whitespace-pre-wrap"
          >
            {logs.length > 0 ? logs.map((log, i) => (
              <p key={i} className={`mb-1 ${getLogColor(log.level)}`}>
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
            )) : <p className="text-gray-500">Dica: emita uma credencial (Seção 2) e verifique (Seção 1) para ver os logs aqui.</p>}
          </div>
        </section>
      </div>
    </div>
  );
};

export default Page;
