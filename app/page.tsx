// app/page.tsx 
// (Se o seu arquivo for .js, remova os tipos como ': string', ': React.FC', etc.)
'use client'; // Necessário no Next.js App Router para componentes com interatividade

import React, { useState } from 'react';
import { isAddress } from 'ethers';

// Componente principal da página
const LabDIDPage: React.FC = () => {
    // --- Estados do Formulário ---
    // Para a seção de Emissão
    const [emitirUsuarioAddr, setEmitirUsuarioAddr] = useState('');
    const [emitirDadosJson, setEmitirDadosJson] = useState('{"status":"KYC_APROVADO", "nivel":"bronze"}'); // Exemplo inicial
    const [emitirNomeAmigavel, setEmitirNomeAmigavel] = useState('Atestado KYC Bronze');
    const [emitirDescricao, setEmitirDescricao] = useState('Emitido pelo Gov.br em 25/10/2025');

    // Para a seção de Verificação
    const [verificarUsuarioAddr, setVerificarUsuarioAddr] = useState('');
    const [verificarDadosJson, setVerificarDadosJson] = useState('{"status":"KYC_APROVADO", "nivel":"bronze"}');

    // Para mostrar logs e resultados
    const [logs, setLogs] = useState<string[]>([]);
    const [isLoadingEmitir, setIsLoadingEmitir] = useState(false);
    const [isLoadingVerificar, setIsLoadingVerificar] = useState(false);
    const [resultadoVerificacao, setResultadoVerificacao] = useState<boolean | null>(null);

    // --- Funções Auxiliares ---
    const addLog = (message: string) => {
        console.log(message);
        setLogs(prev => [`${new Date().toLocaleTimeString()}: ${message}`, ...prev.slice(0, 19)]); // Mantém os últimos 20 logs
    };

    // Tenta parsear JSON de forma segura
    const safeJsonParse = (jsonString: string) => {
        try {
            JSON.parse(jsonString);
            return true;
        } catch (e) {
            return false;
        }
    };

    // --- Funções de Interação com API ---

    // Função para chamar a API /api/emitir
    const handleEmitirCredencial = async () => {
        if (!isAddress(emitirUsuarioAddr)) {
             addLog("Erro: Endereco do usuario para emissao invalido.");
             return;
        }
         if (!safeJsonParse(emitirDadosJson)) {
             addLog("Erro: 'Dados da Credencial (JSON)' invalidos. Verifique a sintaxe JSON.");
             return;
         }

        setIsLoadingEmitir(true);
        addLog("Iniciando emissao de credencial...");
        setResultadoVerificacao(null); // Limpa resultado anterior

        try {
            const response = await fetch('/api/emitir', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    usuarioAddress: emitirUsuarioAddr,
                    dadosCredencialJsonString: emitirDadosJson,
                    nomeAmigavel: emitirNomeAmigavel,
                    descricao: emitirDescricao,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || `Erro HTTP: ${response.status}`);
            }

            addLog(`SUCESSO: ${data.message}`);
            addLog(`   ID no DB: ${data.idDb}`);
            addLog(`   Hash (Prova): ${data.hashVerificacao}`);
            addLog(`   Tx On-Chain: ${data.txHashOnChain || '(ja existia on-chain)'}`);

        } catch (error: any) {
            addLog(`ERRO ao emitir: ${error.message}`);
        } finally {
            setIsLoadingEmitir(false);
        }
    };

    // Função para chamar a API /api/verificar
    const handleVerificarCredencial = async () => {
         if (isAddress(verificarUsuarioAddr)) {
             addLog("Erro: Endereco do usuario para verificacao invalido.");
             return;
        }
         if (!safeJsonParse(verificarDadosJson)) {
             addLog("Erro: 'Dados Exatos da Credencial (JSON)' invalidos. Verifique a sintaxe JSON.");
             return;
         }

        setIsLoadingVerificar(true);
        addLog("Iniciando verificacao de credencial...");
        setResultadoVerificacao(null);

        try {
            const response = await fetch('/api/verificar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    usuarioAddress: verificarUsuarioAddr,
                    dadosCredencialJsonString: verificarDadosJson,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || `Erro HTTP: ${response.status}`);
            }

            addLog(`Consulta on-chain realizada para o hash: ${data.hashVerificacao}`);
            setResultadoVerificacao(data.verificado); // Armazena true ou false
            addLog(`RESULTADO DA VERIFICACAO: ${data.verificado ? 'VERDADEIRO ✅' : 'FALSO ❌'}`);

        } catch (error: any) {
            addLog(`ERRO ao verificar: ${error.message}`);
        } finally {
            setIsLoadingVerificar(false);
        }
    };


    // --- Renderização da Página ---
    return (
        <div className="min-h-screen bg-gray-900 text-gray-200 p-8">
            <header className="text-center mb-12">
                <h1 className="text-4xl font-bold text-cyan-400 mb-2">Lab de Identidade Soberana (DID/SSI)</h1>
                <p className="text-lg text-gray-400">Prova de Conceito - Projeto Mestrado PGCOMP/UFBA</p>
                <p className="text-sm mt-1">Desenvolvido por: Tarson Florêncio</p>
                <a href="https://github.com/florenciotarson/did-lab-ufba" target="_blank" rel="noopener noreferrer" 
                   className="text-cyan-500 hover:text-cyan-300 underline mt-2 inline-block">
                    Ver Código no GitHub
                </a>
            </header>

            {/* Seção de Pitch / Explicação */}
            <section className="bg-gray-800 p-6 rounded-lg shadow-md mb-8 max-w-4xl mx-auto">
                <h2 className="text-2xl font-semibold mb-4 text-cyan-400 border-b border-gray-700 pb-2">Motivação e Contexto Acadêmico</h2>
                <p className="mb-3">
                    Este laboratório demonstra uma arquitetura de identidade digital focada em **privacidade**, **soberania do usuário** e **inclusão**, 
                    alinhada à LGPD e às pesquisas da RNP. Em contraste com modelos centralizados (como Okta/OAuth), 
                    a Identidade Descentralizada (DID) devolve o controle criptográfico ao cidadão.
                </p>
                <p className="mb-3">
                    Utilizando Smart Contracts (atuando como "Cartório" público na blockchain Sepolia) e armazenamento off-chain criptografado 
                    (simulado aqui, com dados gerenciados pelo backend), o sistema permite a **verificação Zero-Knowledge**: provar um fato 
                    (ex: "KYC Aprovado") sem revelar os dados subjacentes (ex: CPF).
                </p>
                 <p className="text-sm text-gray-400">
                     (Alinhamento PGCOMP/UFBA: Linha Sistemas Computacionais, Área RCSD. Tópicos: Blockchain, Web Descentralizada, Cibersegurança, Internet do Futuro, Tolerância a Falhas).
                 </p>
            </section>

            {/* Seção de Verificação (PÚBLICA) */}
            <section className="bg-gray-800 p-6 rounded-lg shadow-md mb-8 max-w-4xl mx-auto">
                <h2 className="text-2xl font-semibold mb-4 text-cyan-400 border-b border-gray-700 pb-2">1. Verificador (Demonstração Pública)</h2>
                <p className="mb-4 text-gray-400">
                    Qualquer pessoa pode usar esta seção para verificar se um usuário possui uma credencial específica registrada on-chain, 
                    sem ver os dados privados.
                </p>
                <div className="space-y-4">
                    <div>
                        <label htmlFor="verifUsuario" className="block text-sm font-medium mb-1">Endereço do Usuário (Ex: da sua conta MetaMask):</label>
                        <input 
                            id="verifUsuario" 
                            type="text" 
                            value={verificarUsuarioAddr} 
                            onChange={(e) => setVerificarUsuarioAddr(e.target.value)}
                            placeholder="0x..." 
                            className="w-full bg-gray-700 border border-gray-600 rounded p-2 focus:ring-cyan-500 focus:border-cyan-500" 
                        />
                    </div>
                    <div>
                        <label htmlFor="verifDados" className="block text-sm font-medium mb-1">Dados Exatos da Credencial (JSON String):</label>
                        <input 
                            id="verifDados" 
                            type="text" 
                            value={verificarDadosJson} 
                            onChange={(e) => setVerificarDadosJson(e.target.value)}
                            placeholder='{"status":"KYC_APROVADO", "nivel":"bronze"}' 
                            className="w-full bg-gray-700 border border-gray-600 rounded p-2 focus:ring-cyan-500 focus:border-cyan-500" 
                        />
                    </div>
                    <button 
                        onClick={handleVerificarCredencial} 
                        disabled={isLoadingVerificar}
                        className={`w-full py-2 px-4 rounded font-semibold transition-colors ${isLoadingVerificar ? 'bg-gray-600 cursor-not-allowed' : 'bg-cyan-600 hover:bg-cyan-700'}`}
                    >
                        {isLoadingVerificar ? 'Verificando On-Chain...' : 'Verificar Credencial'}
                    </button>
                    {/* Exibição do Resultado da Verificação */}
                    {resultadoVerificacao !== null && (
                        <div className={`mt-4 p-4 rounded text-center font-bold text-xl ${resultadoVerificacao ? 'bg-green-800 border-green-600' : 'bg-red-800 border-red-600'} border`}>
                            {resultadoVerificacao ? 'VERDADEIRO ✅ (Credencial Válida!)' : 'FALSO ❌ (Credencial Inválida ou Revogada)'}
                        </div>
                    )}
                </div>
            </section>

             {/* Seção de Emissão (ADMIN/TESTE) */}
             {/* Você pode comentar ou remover esta seção antes de mostrar aos professores */}
            <section className="bg-gray-800 p-6 rounded-lg shadow-md mb-8 max-w-4xl mx-auto">
                <h2 className="text-2xl font-semibold mb-4 text-orange-400 border-b border-gray-700 pb-2">2. Emissor (Função de Teste/Admin)</h2>
                <p className="mb-4 text-gray-400">
                     Use esta seção para emitir novas credenciais (requer que o backend esteja configurado com a chave privada correta do Emissor).
                </p>
                <div className="space-y-4">
                    <div>
                        <label htmlFor="emitUsuario" className="block text-sm font-medium mb-1">Endereço do Usuário (Para quem emitir):</label>
                        <input 
                            id="emitUsuario" 
                            type="text" 
                            value={emitirUsuarioAddr} 
                            onChange={(e) => setEmitirUsuarioAddr(e.target.value)}
                            placeholder="0x..." 
                            className="w-full bg-gray-700 border border-gray-600 rounded p-2 focus:ring-orange-500 focus:border-orange-500" 
                        />
                    </div>
                     <div>
                        <label htmlFor="emitDados" className="block text-sm font-medium mb-1">Dados da Credencial (JSON String - O que será provado):</label>
                        <input 
                            id="emitDados" 
                            type="text" 
                            value={emitirDadosJson} 
                            onChange={(e) => setEmitirDadosJson(e.target.value)}
                            className="w-full bg-gray-700 border border-gray-600 rounded p-2 focus:ring-orange-500 focus:border-orange-500" 
                        />
                    </div>
                    <div>
                        <label htmlFor="emitNome" className="block text-sm font-medium mb-1">Nome Amigável (Opcional - para UI):</label>
                        <input 
                            id="emitNome" 
                            type="text" 
                            value={emitirNomeAmigavel} 
                            onChange={(e) => setEmitirNomeAmigavel(e.target.value)}
                            className="w-full bg-gray-700 border border-gray-600 rounded p-2 focus:ring-orange-500 focus:border-orange-500" 
                        />
                    </div>
                     <div>
                        <label htmlFor="emitDesc" className="block text-sm font-medium mb-1">Descrição (Opcional - para UI):</label>
                        <input 
                            id="emitDesc" 
                            type="text" 
                            value={emitirDescricao} 
                            onChange={(e) => setEmitirDescricao(e.target.value)}
                            className="w-full bg-gray-700 border border-gray-600 rounded p-2 focus:ring-orange-500 focus:border-orange-500" 
                        />
                    </div>
                    <button 
                        onClick={handleEmitirCredencial} 
                        disabled={isLoadingEmitir}
                        className={`w-full py-2 px-4 rounded font-semibold transition-colors ${isLoadingEmitir ? 'bg-gray-600 cursor-not-allowed' : 'bg-orange-600 hover:bg-orange-700'}`}
                    >
                        {isLoadingEmitir ? 'Emitindo (Blockchain + DB)...' : 'Emitir Nova Credencial'}
                    </button>
                </div>
            </section>


            {/* Seção de Logs */}
            <section className="bg-gray-800 p-6 rounded-lg shadow-md max-w-4xl mx-auto">
                <h2 className="text-2xl font-semibold mb-4 text-gray-400 border-b border-gray-700 pb-2">Logs de Atividade</h2>
                <pre className="bg-gray-900 p-4 rounded overflow-x-auto h-64 text-sm font-mono border border-gray-700">
                    {logs.length > 0 ? logs.join('\n') : 'Nenhuma atividade ainda...'}
                </pre>
            </section>

        </div>
    );
};

// Script para importar Ethers.js (necessário para ethers.utils.isAddress)
// No Next.js 13+ (App Router), isso pode ser feito de forma mais elegante, mas para simplicidade:
if (typeof window !== 'undefined' && !(window as any).ethers) {
     const script = document.createElement('script');
     script.src = 'https://cdnjs.cloudflare.com/ajax/libs/ethers/5.7.2/ethers.umd.min.js';
     script.async = true;
     document.body.appendChild(script);
 }
 // Declaração global para TypeScript entender 'ethers'
 declare global {
    interface Window { ethers: any; }
}


export default LabDIDPage;