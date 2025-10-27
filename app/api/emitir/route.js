// app/api/emitir/route.js
import { NextResponse } from 'next/server';
import canonicalize from 'canonicalize';
import { ethers } from 'ethers';
import prisma from '@/lib/prisma';
import abi from '@/lib/IdentidadeDID_ABI.json';

// ===== Helpers =====
function log(msg) { console.log(`[API Emitir] ${new Date().toISOString()}: ${msg}`); }
function requireEnv(name) {
  const val = process.env[name];
  if (!val) throw new Error(`Variável de ambiente ausente: ${name}`);
  return val;
}
// API key opcional
function checkApiKey(req) {
  const required = process.env.API_EMISSAO_KEY;
  if (!required) return;
  const got = req.headers.get('x-api-key');
  if (got !== required) { const err = new Error('Unauthorized'); err.statusCode = 401; throw err; }
}
// Hash canônico (RFC 8785)
function hashFromJsonString(jsonStr) {
  const obj = JSON.parse(jsonStr);
  const canon = canonicalize(obj);
  return ethers.utils.keccak256(ethers.utils.toUtf8Bytes(canon));
}
async function getContratoAssinado() {
  const RPC = requireEnv('NEXT_PUBLIC_SEPOLIA_RPC_URL');
  const PRIV = requireEnv('EMISSOR_PRIVATE_KEY');
  const END = requireEnv('NEXT_PUBLIC_CONTRATO_ENDERECO');
  const provider = new ethers.providers.JsonRpcProvider(RPC);
  const walletEmissor = new ethers.Wallet(PRIV, provider);
  const contrato = new ethers.Contract(END, abi, walletEmissor);
  const emissor = await walletEmissor.getAddress();
  return { contrato, emissor };
}

// ===== Handler =====
export async function POST(req) {
  try {
    checkApiKey(req);

    // Content-Type
    const ct = req.headers.get('content-type') || '';
    if (!ct.includes('application/json')) {
      return NextResponse.json({ message: 'Content-Type deve ser application/json' }, { status: 415 });
    }

    const body = await req.json();

    // --- Campos suportados ---
    const {
      usuarioAddress,
      // NOVO modo seguro (recomendado)
      hashVerificacao: hashCliente,
      blobCriptografado,
      // Modo antigo (compat)
      dadosCredencialJsonString,
      // Metadados
      nomeAmigavel = null,
      descricao = null,
    } = body || {};

    // Validações base
    if (!usuarioAddress || !ethers.utils.isAddress(usuarioAddress)) {
      return NextResponse.json({ message: 'Endereco do usuario invalido.' }, { status: 400 });
    }

    // Limite simples de payload (opcional)
    const rawLen =
      (typeof dadosCredencialJsonString === 'string' ? dadosCredencialJsonString.length : 0) +
      (typeof blobCriptografado === 'string'
        ? blobCriptografado.length
        : (blobCriptografado ? JSON.stringify(blobCriptografado).length : 0));
    if (rawLen > 50_000) { // ~50KB
      return NextResponse.json({ message: 'Payload muito grande.' }, { status: 413 });
    }

    // Determinar hash + blob a salvar
    let hashVerificacao;
    let blobParaSalvar;

    if (hashCliente && blobCriptografado) {
      // === MODO SEGURO: cliente já cifrou e calculou o hash ===
      hashVerificacao = hashCliente;
      blobParaSalvar = typeof blobCriptografado === 'string'
        ? blobCriptografado
        : JSON.stringify(blobCriptografado);

    } else if (typeof dadosCredencialJsonString === 'string') {
      // === MODO ANTIGO (compat): servidor calcula hash e guarda base64 ===
      try {
        hashVerificacao = hashFromJsonString(dadosCredencialJsonString); // canônico
      } catch {
        return NextResponse.json({ message: 'dadosCredencialJsonString não é um JSON válido.' }, { status: 400 });
      }
      // Base64 apenas para a PoC (não é criptografia real)
      blobParaSalvar = Buffer.from(dadosCredencialJsonString).toString('base64');

    } else {
      return NextResponse.json(
        { message: 'Forneça (hashVerificacao + blobCriptografado) OU dadosCredencialJsonString.' },
        { status: 400 }
      );
    }

    log(`Usuario=${usuarioAddress}, Hash=${hashVerificacao}`);

    // Blockchain
    const { contrato, emissor } = await getContratoAssinado();
    const jaExisteOnChain = await contrato.verificarCredencial(usuarioAddress, hashVerificacao);

    // DB (idempotência)
    const jaExisteNoDB = await prisma.credencial.findFirst({ where: { hashVerificacao } });

    // Emite on-chain se ainda não existir
    let txHashOnChain = null;
    if (!jaExisteOnChain) {
      const tx = await contrato.emitirCredencial(usuarioAddress, hashVerificacao);
      await tx.wait(1);
      txHashOnChain = tx.hash;
    }

    // Persiste/atualiza
    const dataDB = {
      usuarioAddress,
      emissorAddress: emissor,
      hashVerificacao,
      nomeAmigavel,
      descricao,
      blobCriptografado: blobParaSalvar,
    };

    const registro = jaExisteNoDB
      ? await prisma.credencial.update({ where: { id: jaExisteNoDB.id }, data: dataDB })
      : await prisma.credencial.create({ data: dataDB });

    const statusCode = jaExisteNoDB && jaExisteOnChain ? 200 : 201;

    return NextResponse.json(
      { message: 'Credencial emitida e salva com sucesso!', idDb: registro.id, hashVerificacao, txHashOnChain },
      { status: statusCode }
    );

  } catch (error) {
    log(`ERRO: ${error.message}`);
    let msg = 'Erro interno no servidor ao processar a emissao.';
    let status = error.statusCode || 500;
    if (error.code === 'CALL_EXCEPTION' || error.reason) {
      msg = `Erro no contrato: ${error.reason || error.code}`;
    } else if (error.code === 'REPLACEMENT_UNDERPRICED') {
      msg = 'Erro de transacao (nonce/gas). Tente novamente.';
    }
    return NextResponse.json({ message: msg, details: error.message }, { status });
  }
}
