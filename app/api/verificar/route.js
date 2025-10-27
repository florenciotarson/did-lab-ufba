// app/api/verificar/route.js
import { NextResponse } from 'next/server';
import canonicalize from 'canonicalize';
import { ethers } from 'ethers';
import abi from '@/lib/IdentidadeDID_ABI.json';

// ---------- helpers ----------
function log(m) {
  console.log(`[API Verificar] ${new Date().toISOString()}: ${m}`);
}
function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Variável de ambiente ausente: ${name}`);
  return v;
}
// hash canônico (estável à ordem de chaves/espaçamento)
function hashFromJsonString(jsonStr) {
  const obj = JSON.parse(jsonStr);                 // valida JSON
  const canon = canonicalize(obj);                 // RFC 8785
  return ethers.utils.keccak256(ethers.utils.toUtf8Bytes(canon));
}
function isValidHash(hex) {
  return typeof hex === 'string' && /^0x[0-9a-fA-F]{64}$/.test(hex);
}
async function getContratoLeitura() {
  const RPC = requireEnv('NEXT_PUBLIC_SEPOLIA_RPC_URL');
  const END = requireEnv('NEXT_PUBLIC_CONTRATO_ENDERECO');
  const provider = new ethers.providers.JsonRpcProvider(RPC);
  const contrato = new ethers.Contract(END, abi, provider);
  return { contrato };
}

// ---------- handler ----------
export async function POST(req) {
  try {
    // content-type
    const ct = req.headers.get('content-type') || '';
    if (!ct.includes('application/json')) {
      return NextResponse.json({ message: 'Content-Type deve ser application/json' }, { status: 415 });
    }

    const body = await req.json();
    const {
      usuarioAddress,
      dadosCredencialJsonString, // modo LEGADO (servidor calcula o hash)
      hashVerificacao: hashCliente // modo PRIVADO (cliente envia o hash)
    } = body || {};

    // validações base
    if (!usuarioAddress || !ethers.utils.isAddress(usuarioAddress)) {
      return NextResponse.json({ message: 'Endereco do usuario invalido.' }, { status: 400 });
    }
    if (!dadosCredencialJsonString && !hashCliente) {
      return NextResponse.json(
        { message: 'Forneça dadosCredencialJsonString (legado) OU hashVerificacao (privado).' },
        { status: 400 }
      );
    }

    // determina o hash a consultar
    let hashVerificacao;
    let source = null;

    if (typeof dadosCredencialJsonString === 'string') {
      try {
        hashVerificacao = hashFromJsonString(dadosCredencialJsonString);
        source = 'json';
      } catch {
        return NextResponse.json({ message: 'dadosCredencialJsonString não é um JSON válido.' }, { status: 400 });
      }
      // se o cliente também mandou um hash, opcionalmente checamos coerência
      if (hashCliente && isValidHash(hashCliente) && hashCliente.toLowerCase() !== hashVerificacao.toLowerCase()) {
        return NextResponse.json(
          { message: 'Hash informado não confere com o JSON fornecido.' },
          { status: 400 }
        );
      }
    } else {
      // modo PRIVADO (sem JSON)
      if (!isValidHash(hashCliente)) {
        return NextResponse.json({ message: 'hashVerificacao inválido (esperado 0x + 64 hex).' }, { status: 400 });
      }
      hashVerificacao = hashCliente;
      source = 'hash';
    }

    log(`Usuario=${usuarioAddress}, Hash=${hashVerificacao}, Source=${source}`);

    // blockchain (somente leitura)
    const { contrato } = await getContratoLeitura();
    const verificado = await contrato.verificarCredencial(usuarioAddress, hashVerificacao);
    log(`Resultado on-chain: ${verificado}`);

    return NextResponse.json(
      { verificado, usuario: usuarioAddress, hashVerificacao, source },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    log(`ERRO: ${error.message}`);
    let msg = 'Erro interno no servidor ao verificar credencial.';
    if (error.code === 'CALL_EXCEPTION' || error.reason) {
      msg = `Erro no contrato: ${error.reason || error.code}`;
    }
    return NextResponse.json({ message: msg, details: error.message }, { status: 500 });
  }
}
