// pages/api/emitir.js
import { ethers } from 'ethers';
import prisma from '@/lib/prisma'; // Importa nosso Prisma Client
import abi from '@/lib/IdentidadeDID_ABI.json'; // Importa o ABI do contrato

// Função Helper para log (opcional, mas útil)
function log(message) { console.log(`[API Emitir] ${new Date().toISOString()}: ${message}`); }

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido (apenas POST)' });
    }

    try {
        log("Recebida requisicao para emitir credencial.");
        const { usuarioAddress, dadosCredencialJsonString, nomeAmigavel = null, descricao = null } = req.body;

        // --- Validações Básicas ---
        if (!usuarioAddress || !ethers.utils.isAddress(usuarioAddress)) {
            return res.status(400).json({ message: 'Endereco do usuario invalido.' });
        }
        if (!dadosCredencialJsonString || typeof dadosCredencialJsonString !== 'string') {
            return res.status(400).json({ message: 'Dados da credencial (JSON string) sao obrigatorios.' });
        }

        log(`Dados recebidos: Usuario=${usuarioAddress}, Credencial=${dadosCredencialJsonString}`);

        // --- Conexão Blockchain (Provedor + Carteira do Emissor) ---
        const provider = new ethers.providers.JsonRpcProvider(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL);
        const walletEmissor = new ethers.Wallet(process.env.EMISSOR_PRIVATE_KEY, provider);
        const contrato = new ethers.Contract(process.env.NEXT_PUBLIC_CONTRATO_ENDERECO, abi, walletEmissor);
        const emissorAddress = await walletEmissor.getAddress();
        log(`Conectado como Emissor: ${emissorAddress}`);

        // --- Geração do Hash (Prova On-Chain) ---
        // Usamos keccak256 diretamente como o Solidity faz internamente
        const hashVerificacao = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(dadosCredencialJsonString));
        log(`Hash Keccak256 gerado: ${hashVerificacao}`);

        // --- Verificação Prévia (Evita Re-emissão e Gasto de Gás) ---
        const jaExisteOnChain = await contrato.verificarCredencial(usuarioAddress, hashVerificacao);
        if (jaExisteOnChain) {
            log("AVISO: Credencial ja existe on-chain para este usuario. Nao sera re-emitida.");
            // Você pode optar por retornar um erro ou sucesso aqui, dependendo da lógica desejada
            // return res.status(409).json({ message: 'Credencial ja existe on-chain.' }); 
        }
        const jaExisteNoDB = await prisma.credencial.findUnique({
            where: { hashVerificacao: hashVerificacao },
        });
         if (jaExisteNoDB) {
            log("AVISO: Hash ja existe no DB. Verificando consistencia...");
            if (jaExisteNoDB.usuarioAddress !== usuarioAddress || jaExisteNoDB.emissorAddress !== emissorAddress) {
                 log(`ERRO GRAVE: Hash ${hashVerificacao} ja existe no DB mas pertence a outro usuario/emissor!`);
                 return res.status(409).json({ message: 'Conflito de Hash no banco de dados.' });
            }
             // Se pertence ao mesmo usuário/emissor e já existe on-chain, talvez só precise atualizar o DB
             if (jaExisteOnChain) {
                 log("Credencial ja existe on-chain e no DB. Nada a fazer.");
                 return res.status(200).json({ message: 'Credencial ja existe.', hashVerificacao });
             }
        }


        // --- Criptografia (Simples - Apenas para Demo) ---
        // ATENÇÃO: Esta é uma criptografia MUITO SIMPLES apenas para a demo.
        // NUNCA use isso em produção. O ideal seria usar a chave pública do usuário.
        // Aqui, apenas codificamos para Base64 para simular o "blob".
        const blobCriptografado = Buffer.from(dadosCredencialJsonString).toString('base64');
        log(`Blob (Base64): ${blobCriptografado.substring(0, 30)}...`);


         // --- GRAVAÇÃO NA BLOCKCHAIN (Custa Gás de Teste) ---
         let txHash = null;
         if (!jaExisteOnChain) {
             log("Emitindo credencial on-chain...");
             const tx = await contrato.emitirCredencial(usuarioAddress, hashVerificacao);
             log(`Transacao enviada: ${tx.hash}. Aguardando confirmacao...`);
             await tx.wait(1); // Espera 1 confirmação
             txHash = tx.hash;
             log(`Transacao confirmada on-chain: ${txHash}`);
         }

        // --- GRAVAÇÃO NO BANCO DE DADOS (Neon/Prisma) ---
        log("Salvando dados no banco de dados...");
        const novaCredencial = await prisma.credencial.create({
            data: {
                usuarioAddress: usuarioAddress,
                emissorAddress: emissorAddress, // Gravamos quem emitiu
                hashVerificacao: hashVerificacao,
                nomeAmigavel: nomeAmigavel,
                descricao: descricao,
                blobCriptografado: blobCriptografado,
            },
        });
        log(`Credencial salva no DB com ID: ${novaCredencial.id}`);

        // --- Resposta de Sucesso ---
        res.status(201).json({
            message: 'Credencial emitida e salva com sucesso!',
            idDb: novaCredencial.id,
            hashVerificacao: hashVerificacao,
            txHashOnChain: txHash // Pode ser null se já existia on-chain
        });

    } catch (error) {
        log(`ERRO: ${error.message}`);
        console.error(error); // Log completo no console do Vercel
        // Tenta dar uma mensagem de erro mais específica para falhas de contrato
        let userFriendlyError = 'Erro interno no servidor ao processar a emissao.';
         if (error.code === 'CALL_EXCEPTION' || error.reason) {
             userFriendlyError = `Erro no contrato: ${error.reason || error.code}`;
         } else if (error.code === 'REPLACEMENT_UNDERPRICED') {
             userFriendlyError = 'Erro de transacao (nonce/gas). Tente novamente.';
         }
        res.status(500).json({ message: userFriendlyError, details: error.message });
    } finally {
         // Garante que a conexão Prisma seja fechada em ambientes serverless
         await prisma.$disconnect();
    }
}