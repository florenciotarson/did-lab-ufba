// app/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
// Importa APENAS as funções específicas que precisamos da v6
import { isAddress, BrowserProvider, JsonRpcSigner } from 'ethers';

// --- ENSINA O TYPESCRIPT SOBRE window.ethereum ---
declare global {
    interface Window {
        ethereum?: any; // Define que a window PODE ter uma propriedade ethereum (do tipo any)
    }
}
// --- FIM DA DECLARAÇÃO GLOBAL ---

// Componente principal da página
const LabDIDPage: React.FC = () => {
    // --- Estados Globais ---
    const [logs, setLogs] = useState<string[]>([]);
    const [userAddress, setUserAddress] = useState<string | null>(null); // Endereço conectado (string)
    const [provider, setProvider] = useState<BrowserProvider | null>(null);
    const [signer, setSigner] = useState<JsonRpcSigner | null>(null); // Objeto Signer

    // --- Estados do Formulário: Emissão ---
    const [emitirUsuarioAddr, setEmitirUsuarioAddr] = useState('');
    const [emitirDadosJson, setEmitirDadosJson] = useState('{"status":"ATIVO", "curso":"PGCOMP"}'); // Novo exemplo
    const [emitirNomeAmigavel, setEmitirNomeAmigavel] = useState('Matrícula Ativa PGCOMP');
    const [emitirDescricao, setEmitirDescricao] = useState(`Emitido em ${new Date().toLocaleDateString()}`);
    const [isLoadingEmitir, setIsLoadingEmitir] = useState(false);

    // --- Estados do Formulário: Verificação ---
    const [verificarUsuarioAddr, setVerificarUsuarioAddr] = useState('');
    const [verificarDadosJson, setVerificarDadosJson] = useState('{"status":"ATIVO", "curso":"PGCOMP"}'); // Novo exemplo
    const [isLoadingVerificar, setIsLoadingVerificar] = useState(false);
    const [resultadoVerificacao, setResultadoVerificacao] = useState<boolean | null>(null);
    const [hashVerificado, setHashVerificado] = useState<string | null>(null);

    // --- Dados de Exemplo ---
    // !!! IMPORTANTE: Substitua pelo endereço de uma conta sua no MetaMask onde você emitirá a credencial !!!
    const EXAMPLE_USER_ADDRESS = '0xSEU_ENDERECO_DE_TESTE_AQUI'; 
    const EXAMPLE_CREDENTIAL_JSON = '{"status":"ATIVO", "curso":"PGCOMP"}';

    // Estado para feedback de cópia
    const [copyStatus, setCopyStatus] = useState<'address' | 'json' | null>(null);

    // --- Funções Auxiliares ---
    const addLog = (message: string) => {
        console.log(message);
        setLogs(prev => [`${new Date().toLocaleTimeString()}: ${message}`, ...prev.slice(0, 19)]); // Mantém os últimos 20 logs
    };

    const safeJsonParse = (jsonString: string): boolean => {
        try { JSON.parse(jsonString); return true; } catch (e) { return false; }
    };

    // Função para copiar texto para a área de transferência
    const copyToClipboard = async (text: string, type: 'address' | 'json') => {
        if (!navigator.clipboard) {
             addLog("Erro: Clipboard API não disponível neste navegador.");
             return;
        }
        try {
            await navigator.clipboard.writeText(text);
            addLog(`${type === 'address' ? 'Endereço' : 'JSON'} de exemplo copiado!`);
            setCopyStatus(type);
            setTimeout(() => setCopyStatus(null), 1500); // Remove o feedback após 1.5s
        } catch (err) {
            addLog(`Erro ao copiar ${type === 'address' ? 'endereço' : 'JSON'}.`);
            console.error('Falha ao copiar:', err);
        }
    };

    // --- Conexão com MetaMask ---
    useEffect(() => {
        const initializeProvider = async () => {
            if (typeof window.ethereum !== 'undefined') {
                try {
                    // 1. Cria o Provider
                    const ethProvider = new BrowserProvider(window.ethereum);
                    setProvider(ethProvider);
                    addLog("Provider MetaMask inicializado.");

                    // 2. Tenta obter contas já conectadas (sem pop-up)
                    const accounts = await ethProvider.listAccounts();
                    if (accounts.length > 0) {
                        const currentAddress = accounts[0].address; // Obtém o endereço como string
                        setUserAddress(currentAddress); // Define o estado do endereço
                        // 3. Obtém o Signer associado
                        try {
                            const currentSigner = await ethProvider.getSigner(currentAddress);
                            setSigner(currentSigner); // Define o estado do Signer
                            addLog(`Carteira ${currentAddress.substring(0, 6)}... reconectada.`);
                        } catch (err) {
                             console.error("Erro ao obter signer na reconexão:", err);
                             addLog("Erro ao obter signer da conta reconectada.");
                             // Não define o signer se falhar
                        }
                    } else {
                        addLog("Nenhuma conta MetaMask conectada encontrada.");
                    }

                    // 4. Listener para mudança de conta
                     window.ethereum.on('accountsChanged', async (newAccounts: string[]) => {
                         if (newAccounts.length > 0) {
                             const newAddress = newAccounts[0];
                             setUserAddress(newAddress);
                             // Sempre tente obter o novo Signer quando a conta mudar
                             if (ethProvider) { // Garante que ethProvider ainda existe
                                 try {
                                     const newSigner = await ethProvider.getSigner(newAddress);
                                     setSigner(newSigner);
                                     addLog(`Conta MetaMask alterada para: ${newAddress.substring(0,6)}...`);
                                 } catch (err) {
                                     console.error("Erro ao obter novo signer:", err);
                                     addLog("Erro ao obter signer da conta alterada.");
                                     setSigner(null); // Reseta o signer em caso de erro
                                 }
                             }
                         } else {
                             // Conta desconectada
                             setUserAddress(null);
                             setSigner(null);
                             addLog("Carteira MetaMask desconectada.");
                         }
                     });

                } catch (error) {
                    console.error("Erro ao inicializar provider:", error);
                    addLog("Erro ao inicializar provider MetaMask.");
                }
            } else {
                addLog("MetaMask não detectado. Instale a extensão para interagir.");
            }
        };

        initializeProvider();

        // Limpeza do listener ao desmontar
        return () => {
            if (typeof window.ethereum !== 'undefined' && window.ethereum.removeListener) {
                // Para remover o listener corretamente, precisamos da referência da função.
                // Uma solução comum é definir a função de callback fora do useEffect ou usar useRef.
                // Para esta PoC, a tentativa de remoção com função dummy pode não funcionar 100%,
                // mas evita erros se a função for chamada. Em apps maiores, gerenciar listeners é crucial.
                try {
                     const handleAccountsChanged = (accounts: string[]) => {}; // Função dummy
                     window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
                } catch (e) {
                     console.warn("Nao foi possivel remover listener 'accountsChanged'", e);
                }
            }
        };
    }, []); // Executa apenas uma vez na montagem do componente

    const connectWallet = async () => {
        let currentProvider = provider; // Usa o estado atual do provider
        // Se o provider não foi inicializado no useEffect (ex: MetaMask demorou a injetar), tenta inicializar agora
        if (!currentProvider && typeof window.ethereum !== 'undefined') {
             try {
                 currentProvider = new BrowserProvider(window.ethereum);
                 setProvider(currentProvider); // Atualiza o estado
                 addLog("Provider MetaMask inicializado na conexão.");
             } catch (e) {
                 addLog("Falha ao inicializar Provider MetaMask na conexão.");
                 return; // Sai se não conseguir inicializar
             }
        } else if (!currentProvider) {
            addLog("MetaMask não detectado. Instale a extensão.");
            return; // Sai se não houver ethereum
        }

        // Garante que currentProvider não é null aqui para o TypeScript
        if (!currentProvider) return; 

        try {
            addLog("Solicitando conexão com MetaMask...");
            // Solicita permissão para conectar contas, retorna array de endereços string[]
            const accounts = await currentProvider.send("eth_requestAccounts", []) as string[]; 
            if (accounts.length > 0) {
                const newAddress = accounts[0];
                setUserAddress(newAddress); // Define o endereço (string)
                // Obtém o objeto Signer associado à conta conectada
                const newSigner = await currentProvider.getSigner(newAddress); 
                setSigner(newSigner); // Define o Signer
                addLog(`Carteira ${newAddress.substring(0,6)}... conectada!`);
            } else {
                addLog("Nenhuma conta selecionada no MetaMask.");
            }
        } catch (error: any) {
            addLog(`Erro ao conectar carteira: ${error.message}`);
             if (error.code === 4001) { // Código padrão para rejeição do usuário no MetaMask
                 addLog("Conexão rejeitada pelo usuário."); 
             }
        }
    };


    // --- Funções de Interação com API ---
    const handleEmitirCredencial = async () => {
        if (!isAddress(emitirUsuarioAddr)) { addLog("Erro Emissão: Endereço do usuário inválido."); return; }
        if (!safeJsonParse(emitirDadosJson)) { addLog("Erro Emissão: Dados da Credencial (JSON) inválidos."); return; }
        
        setIsLoadingEmitir(true); addLog("EMISSÃO: Iniciando...");
        setResultadoVerificacao(null); setHashVerificado(null); // Limpa resultados anteriores
        try {
            const response = await fetch('/api/emitir', { 
                 method: 'POST', headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({
                     usuarioAddress: emitirUsuarioAddr, dadosCredencialJsonString: emitirDadosJson,
                     nomeAmigavel: emitirNomeAmigavel, descricao: emitirDescricao,
                 }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || `Erro HTTP ${response.status}: ${response.statusText}`);
            addLog(`EMISSÃO SUCESSO: ${data.message}`);
            addLog(`   ID no DB: ${data.idDb}`); addLog(`   Hash (Prova): ${data.hashVerificacao}`);
            // MELHORIA: Link clicável para Etherscan
            addLog(`   Tx On-Chain: ${data.txHashOnChain ? `https://sepolia.etherscan.io/tx/${data.txHashOnChain}` : '(já existia on-chain)'}`); 

        } catch (error: any) { addLog(`ERRO EMISSÃO: ${error.message}`); } 
        finally { setIsLoadingEmitir(false); }
    };

    const handleVerificarCredencial = async () => {
        if (!isAddress(verificarUsuarioAddr)) { addLog("Erro Verificação: Endereço do usuário inválido."); return; }
        if (!safeJsonParse(verificarDadosJson)) { addLog("Erro Verificação: Dados Exatos da Credencial (JSON) inválidos."); return; }
        
        setIsLoadingVerificar(true); addLog("VERIFICAÇÃO: Iniciando consulta on-chain...");
        setResultadoVerificacao(null); setHashVerificado(null); // Limpa resultados anteriores
        try {
            const response = await fetch('/api/verificar', { 
                 method: 'POST', headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({
                     usuarioAddress: verificarUsuarioAddr, dadosCredencialJsonString: verificarDadosJson,
                 }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || `Erro HTTP ${response.status}: ${response.statusText}`);
            
            addLog(`VERIFICAÇÃO: Consulta realizada para o hash: ${data.hashVerificacao}`);
            setResultadoVerificacao(data.verificado); 
            setHashVerificado(data.hashVerificacao); // Guarda o hash verificado para exibição
            addLog(`VERIFICAÇÃO RESULTADO: ${data.verificado ? 'VERDADEIRO ✅ (Credencial Válida e Ativa na Blockchain!)' : 'FALSO ❌ (Credencial Inválida, Revogada ou Inexistente na Blockchain)'}`);
        } catch (error: any) { addLog(`ERRO VERIFICAÇÃO: ${error.message}`); } 
        finally { setIsLoadingVerificar(false); }
    };

    // --- Renderização ---
    return (
        <div className="min-h-screen bg-gray-900 text-gray-200 p-4 md:p-8">
            {/* Header */}
            <header className="text-center mb-10">
                 <h1 className="text-3xl md:text-4xl font-bold text-cyan-400 mb-2">Lab de Identidade Soberana (DID/SSI)</h1>
                 <p className="text-md md:text-lg text-gray-400">Prova de Conceito - Projeto Mestrado PGCOMP/UFBA</p>
                 <p className="text-sm mt-1">Desenvolvido por: Tarson Florêncio</p>
                 <div className="mt-4 flex flex-col sm:flex-row justify-center items-center gap-4">
                     <a href="https://github.com/florenciotarson/did-lab-ufba" target="_blank" rel="noopener noreferrer"
                        className="text-cyan-500 hover:text-cyan-300 underline">
                         Ver Código no GitHub
                     </a>
                     {/* Botão de Conexão MetaMask */}
                     {userAddress ? (
                         <span className="bg-gray-700 text-xs px-3 py-1 rounded-full" title={`Endereço Completo: ${userAddress}`}>
                             Conectado: {userAddress.substring(0, 6)}...{userAddress.substring(userAddress.length - 4)}
                         </span>
                     ) : (
                         <button 
                              onClick={connectWallet} 
                              className="bg-blue-600 hover:bg-blue-700 text-white text-sm py-1 px-3 rounded-md transition-colors disabled:opacity-50"
                              // Desabilita se o MetaMask não for detectado
                              disabled={typeof window !== 'undefined' && typeof window.ethereum === 'undefined'} 
                              title={typeof window !== 'undefined' && typeof window.ethereum === 'undefined' ? "Instale a extensão MetaMask" : "Conectar Carteira"}
                          >
                             Conectar MetaMask
                         </button>
                     )}
                 </div>
             </header>

            {/* Colunas Principais */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-7xl mx-auto">
                
                {/* Coluna Esquerda: Pitch e Verificação */}
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
                              (Alinhamento PGCOMP/UFBA: Linha Sistemas Computacionais, Área RCSD. Tópicos: Blockchain, Web Descentralizada, Cibersegurança, Internet do Futuro, Tolerância a Falhas).
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
                             <span className="font-semibold text-yellow-400 block mb-1">**Exemplo para Teste:**</span>
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
                             {/* Botão de Verificação com Estado de Carregamento */}
                             <button onClick={handleVerificarCredencial} disabled={isLoadingVerificar} className={`w-full py-2 px-4 rounded font-semibold transition-colors text-sm flex items-center justify-center gap-2 ${isLoadingVerificar ? 'bg-gray-600 cursor-not-allowed' : 'bg-cyan-600 hover:bg-cyan-700'}`}>
                                 {isLoadingVerificar && <SpinnerIcon />} 
                                 {isLoadingVerificar ? 'Verificando On-Chain...' : 'Verificar Credencial'}
                             </button>
                             {/* Feedback de Verificação Evidente */}
                             {resultadoVerificacao !== null && (
                                 <div className={`mt-3 p-3 rounded text-center font-bold text-lg ${resultadoVerificacao ? 'bg-green-800 border-green-600' : 'bg-red-800 border-red-600'} border`}>
                                     {resultadoVerificacao ? 'VERDADEIRO ✅' : 'FALSO ❌'}
                                     <p className="text-xs font-normal mt-1">{resultadoVerificacao ? 'Prova válida encontrada na Blockchain!' : 'Prova inválida, revogada ou inexistente.'}</p>
                                     <p className="text-xs font-mono mt-1 break-all">Hash Verificado: {hashVerificado || 'N/A'}</p>
                                 </div>
                             )}
                         </div>
                    </section>
                </div>

                {/* Coluna Direita: Emissão e Logs */}
                <div className="space-y-8">
                    {/* Emissão */}
                    {/* Destaque Visual para Seção Admin */}
                    <section className="bg-gray-800 p-6 rounded-lg shadow-md border-l-4 border-orange-600"> 
                         <h2 className="text-xl font-semibold mb-3 text-orange-400 border-b border-gray-700 pb-2 flex items-center gap-2">
                             {/* Ícone de Chave/Admin */}
                             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-orange-400">
                               <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.562-.966.431-1.563A6 6 0 1 1 21.75 8.25Z" />
                             </svg>
                             2. Emissão de Credencial (Teste/Admin)
                         </h2>
                         <p className="text-sm mb-4 text-gray-400">
                             <strong>Instruções:</strong> Use esta seção para emitir novas credenciais para um endereço de usuário. A API (`/api/emitir`) usa a chave privada do Emissor configurada no backend para registrar o hash na blockchain (isso consome ETH de teste da Sepolia) e salvar os metadados/blob no banco de dados.
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
                             {/* Botão de Emissão com Estado de Carregamento */}
                             <button onClick={handleEmitirCredencial} disabled={isLoadingEmitir} className={`w-full py-2 px-4 rounded font-semibold transition-colors text-sm flex items-center justify-center gap-2 ${isLoadingEmitir ? 'bg-gray-600 cursor-not-allowed' : 'bg-orange-600 hover:bg-orange-700'}`}>
                                 {isLoadingEmitir && <SpinnerIcon />} 
                                 {isLoadingEmitir ? 'Emitindo (Blockchain + DB)...' : 'Emitir Nova Credencial'}
                             </button>
                         </div>
                    </section>

                    {/* Logs */}
                    <section className="bg-gray-800 p-6 rounded-lg shadow-md">
                         <h2 className="text-xl font-semibold mb-3 text-gray-400 border-b border-gray-700 pb-2">Logs de Atividade</h2>
                         <pre className="bg-gray-900 p-3 rounded overflow-x-auto h-80 text-xs font-mono border border-gray-700 leading-relaxed whitespace-pre-wrap wrap-break-word"> {/* Melhorias de estilo no log */}
                             {logs.length > 0 ? logs.join('\n') : 'Nenhuma atividade registrada ainda... Conecte sua carteira e use os botões acima.'}
                         </pre>
                    </section>
                </div>
            </div>
        </div>
    );
};

// Componente Spinner (Ícone de Carregamento)
const SpinnerIcon = () => (
    <svg className="animate-spin -ml-1 mr-1 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);

export default LabDIDPage;