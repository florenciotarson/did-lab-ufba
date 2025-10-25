// pages/api/verificar.js
import { ethers } from 'ethers';
import abi from '@/lib/IdentidadeDID_ABI.json';

function log(message) { console.log(`[API Verificar] ${new Date().toISOString()}: ${message}`); }

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido (apenas POST)' });
    }

    try {
        log("Recebida requisicao para verificar credencial.");
        const { usuarioAddress, dadosCredencialJsonString } = req.body;

        // --- Validações ---
        if (!usuarioAddress || !ethers.utils.isAddress(usuarioAddress)) {
            return res.status(400).json({ message: 'Endereco do usuario invalido.' });
        }
         if (!dadosCredencialJsonString || typeof dadosCredencialJsonString !== 'string') {
            return res.status(400).json({ message: 'Dados da credencial (JSON string) sao obrigatorios.' });
        }

        log(`Dados recebidos: Usuario=${usuarioAddress}, Credencial=${dadosCredencialJsonString}`);

        // --- Conexão Blockchain (Apenas Leitura - Provider) ---
        const provider = new ethers.providers.JsonRpcProvider(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL);
        const contrato = new ethers.Contract(process.env.NEXT_PUBLIC_CONTRATO_ENDERECO, abi, provider);
        log(`Conectado ao contrato: ${contrato.address}`);

        // --- Geração do Hash ---
        const hashVerificacao = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(dadosCredencialJsonString));
        log(`Hash Keccak256 gerado: ${hashVerificacao}`);

        // --- LEITURA DA BLOCKCHAIN (view - não custa gás) ---
        log("Verificando credencial on-chain...");
        const resultado = await contrato.verificarCredencial(usuarioAddress, hashVerificacao);
        log(`Resultado da verificacao on-chain: ${resultado}`);

        // --- Resposta ---
        res.status(200).json({
            verificado: resultado, // Retorna true ou false
            usuario: usuarioAddress,
            hashVerificacao: hashVerificacao
        });

    } catch (error) {
        log(`ERRO: ${error.message}`);
        console.error(error);
        res.status(500).json({ message: 'Erro interno no servidor ao verificar credencial.', details: error.message });
    }
    // Não precisa de $disconnect aqui pois usamos apenas o provider
}