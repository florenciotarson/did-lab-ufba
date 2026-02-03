---

# Lab de Identidade Soberana (DID/SSI) — PoC PGCOMP/UFBA 🇧🇷

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
![Status](https://img.shields.io/badge/status-PoC-informational)
![Blockchain](https://img.shields.io/badge/Blockchain-Sepolia-5c6bc0)
![Stack](https://img.shields.io/badge/Stack-Next.js%20%7C%20Tailwind%20v4%20%7C%20Prisma%20%7C%20Ethers%20v5%2Fv6-0aa)

**Lab Online:** [https://did.oxecollective.com](https://did.oxecollective.com)

**Resumo:** Prova de Conceito (PoC) de **Identidade Descentralizada (DID/SSI)** para o **PGCOMP/UFBA**, linha **Sistemas Computacionais (RCSD)**.
Foco: **Soberania do usuário**, **Privacidade (Zero-Knowledge)**, **Tolerância a Falhas** e **Web Descentralizada**.

---

## O que há de novo


*  **Criptografia real no cliente** (AES-GCM + PBKDF2 via WebCrypto) — o backend nunca vê o JSON em claro.
*  **Verificação “privada”**: o verificador envia só o `hashVerificacao` (não precisa enviar o JSON).
*  **Compatibilidade legado** preservada (ainda aceita enviar o JSON).
*  **Padrões W3C**: endpoints para **Verifiable Credentials (VC-JWT)** com `did:ethr` (`/api/vc/emitir`, `/api/vc/verificar`).
*  **Higiene**: hash canônico (RFC 8785), logs sem PII, headers anti-cache, idempotência e normalização de endereço.

---

## Sumário

- [O que há de novo](#o-que-há-de-novo)
- [Sumário](#sumário)
- [Motivação](#motivação)
- [Arquitetura Híbrida](#arquitetura-híbrida)
- [Funcionalidades](#funcionalidades)
- [Stack Tecnológica](#stack-tecnológica)
- [Como Rodar Localmente](#como-rodar-localmente)
  - [1) Pré-requisitos](#1-pré-requisitos)
  - [2) Clonar \& instalar](#2-clonar--instalar)
  - [3) Implantar o contrato (Remix + MetaMask · Sepolia)](#3-implantar-o-contrato-remix--metamask--sepolia)
  - [4) Variáveis de Ambiente](#4-variáveis-de-ambiente)
  - [5) Banco (Prisma)](#5-banco-prisma)
  - [6) Executar](#6-executar)
- [Variáveis de Ambiente](#variáveis-de-ambiente)
- [Banco de Dados \& Prisma](#banco-de-dados--prisma)
- [APIs (Backend Serverless)](#apis-backend-serverless)
  - [POST `/api/emitir`](#post-apiemitir)
  - [POST `/api/verificar`](#post-apiverificar)
  - [GET `/api/exportar?userAddress=0xSEU_ENDERECO`](#get-apiexportaruseraddress0xseu_endereco)
- [Padrões W3C — VC-JWT](#padrões-w3c--vc-jwt)
- [Contrato Inteligente](#contrato-inteligente)
- [Roteiro de Demonstração (8–10 min)](#roteiro-de-demonstração-810-min)
- [Privacidade \& Segurança](#privacidade--segurança)
- [Roadmap](#roadmap)
- [Licença \& Autor](#licença--autor)

---

## Motivação

Sistemas IAM centralizados (OAuth/SAML/Okta/Auth0) exibem limitações:

* **Risco Centralizado:** ponto único de falha e alvo de vazamentos.
* **Perda de Soberania:** identidade não controlada criptograficamente pelo usuário.
* **Exposição Excessiva:** revela-se mais dados do que o necessário para provar um fato.
* **Lock-in:** baixa portabilidade entre plataformas proprietárias.

**SSI/DID** endereça esses pontos com:

* **Soberania do Usuário:** controle do DID (endereço Ethereum).
* **Privacidade (Zero-Knowledge):** provar fatos sem expor o JSON.
* **Resiliência:** registro descentralizado (blockchain).
* **🇧🇷 Alinhamento:** LGPD e iniciativas de soberania digital da RNP.

---

## Arquitetura Híbrida

> Separação de **Prova Pública** (on-chain) e **Dado Privado** (off-chain).

| Componente                        | Função                | Dados                                                                                   |
| --------------------------------- | --------------------- | --------------------------------------------------------------------------------------- |
| **Blockchain (Ethereum Sepolia)** | **Cartório Imutável** | **Somente hashes (`bytes32`)** e status. Sem PII. Funções `view` retornam `true/false`. |
| **Neon Serverless Postgres (DB)** | **Cofre Privado**     | `blobCriptografado` (JSON da credencial **cifrado no cliente**) + metadados.            |

**Ideia-chave:** a prova de integridade/validade da credencial é pública; os dados pessoais **nunca** vão para a blockchain.

---

## Funcionalidades

*  **Emissão** (`/api/emitir`): gera **hash canônico** e registra on-chain com a conta **Emissora**; armazena metadados + blob **cifrado** no Postgres.
*  **Verificação Pública (ZK-style)** (`/api/verificar` + UI): retorna **VERDADEIRO/FALSO** consultando o contrato via `view`.
*  **Revogação pelo Usuário**: o titular assina e chama `revogarCredencial` no contrato.
*  **Backup/Exportação** (`/api/exportar`): exporta **todos os blobs cifrados** do usuário para `backup.json`.
*  **W3C VC-JWT (opcional)**: emitir/verificar **Verifiable Credentials** interoperáveis.

---

## Stack Tecnológica

| Camada         | Tecnologia/Serviço                                                                  |
| -------------- | ----------------------------------------------------------------------------------- |
| Front/Back     | **Next.js (App Router)**, React, Vercel Functions                                   |
| Estilo         | **Tailwind CSS v4** (preflight)                                                     |
| Web3           | **Ethers v6 (front)** + **Ethers v5 (serverless)**                                  |
| Blockchain     | **Solidity** na **Sepolia Testnet**                                                 |
| Banco de Dados | **Neon Serverless Postgres** + **Prisma ORM**                                       |
| Auxiliar       | **Alchemy/Infura** (RPC Sepolia), **Cloudflare** (DNS), **canonicalize** (RFC 8785) |

**Tema Tailwind — `app/globals.css`:**

```css
@import "tailwindcss/preflight";
:root { --background:#0a0a0a; --foreground:#ededed; }
body { background:var(--background); color:var(--foreground); font-family: Arial, Helvetica, sans-serif; }
```

---

## Como Rodar Localmente

### 1) Pré-requisitos

* Node.js (LTS) e npm
* Git
* MetaMask (navegador)
* (Opcional) Vercel CLI e conta Alchemy/Infura (RPC Sepolia)

### 2) Clonar & instalar

```bash
git clone https://github.com/florenciotarson/did-lab-ufba.git
cd did-lab-ufba
npm install
```

> Dependências adicionais usadas na PoC:
>
> ```bash
> npm i canonicalize
> # (opcional W3C VC)
> npm i did-jwt-vc did-resolver ethr-did-resolver ethr-did
> ```

### 3) Implantar o contrato (Remix + MetaMask · Sepolia)

1. Compile `IdentidadeDID.sol` (≥ 0.8.20) e faça deploy em **Sepolia** (Injected Provider).
2. Anote o **endereço do contrato** e a **ABI**.

### 4) Variáveis de Ambiente

Crie `.env.development.local` e preencha (ver seção abaixo).
Se quiser puxar do Vercel:

```bash
npm i -g vercel
vercel login
vercel link
vercel env pull .env.development.local
```

### 5) Banco (Prisma)

```bash
npx dotenv -e .env.development.local -- npx prisma migrate dev --name init
# ou:
# npx prisma migrate dev --name init
```

### 6) Executar

```bash
npm run dev
# abra http://localhost:3000
```

---

## Variáveis de Ambiente

**Nunca** exponha chaves privadas no frontend. Somente variáveis `NEXT_PUBLIC_` são visíveis no navegador.

```dotenv
# ---- RPC de leitura (use Sepolia!) ----
NEXT_PUBLIC_SEPOLIA_RPC_URL="https://eth-sepolia.g.alchemy.com/v2/SEU_KEY"

# ---- Backend: conta emissora (chave privada) ----
EMISSOR_PRIVATE_KEY="0xSUA_CHAVE_PRIVADA"

# ---- Endereço do contrato (Sepolia) ----
NEXT_PUBLIC_CONTRATO_ENDERECO="0xSEU_CONTRATO"

# ---- Banco de Dados (via Vercel/Neon) ----
# Normalmente vem do 'vercel env pull'
DATABASE_URL="postgresql://..."

# ---- W3C VC (opcional) ----
NEXT_PUBLIC_DID_NETWORK="sepolia"

# ---- Proteção leve de API (opcional) ----
# API_EMISSAO_KEY="chave-simples"
# API_EXPORT_KEY="chave-simples"
# NEXT_PUBLIC_API_EMISSAO_KEY="chave-simples"
# NEXT_PUBLIC_API_EXPORT_KEY="chave-simples"
```

---

## Banco de Dados & Prisma

* **Tabela principal:** `Credencial`
* **Campos:** `id`, `usuarioAddress` *(normalizado minúsculas)*, `hashVerificacao`, `blobCriptografado`, `nomeAmigavel`, `descricao`, `emissorAddress`, `createdAt`, `updatedAt`, `revogadaEm?`.
* **Migrações:** `prisma/migrations/*`
* **Schema:** `prisma/schema.prisma`

Comandos úteis:

```bash
npx prisma studio
npx prisma generate
npx prisma migrate dev
```

---

## APIs (Backend Serverless)

### POST `/api/emitir`

**Modo SEGURO (recomendado)** — cliente cifra no navegador e envia só ciphertext + hash:

```json
{
  "usuarioAddress": "0xDESTINATARIO",
  "hashVerificacao": "0xHASH_CANONICO",
  "blobCriptografado": {
    "version": "1.0",
    "alg": "AES-GCM",
    "kdf": "PBKDF2-SHA256",
    "iterations": 150000,
    "iv": "base64",
    "salt": "base64",
    "ciphertext": "base64"
  },
  "nomeAmigavel": "Matrícula Ativa PGCOMP",
  "descricao": "Emitido em 2025-10-26"
}
```

**Modo LEGADO (compatibilidade)** — envia o JSON; o backend calcula o hash e armazena base64 (somente para PoC):

```json
{
  "usuarioAddress": "0xDESTINATARIO",
  "dadosCredencialJsonString": "{\"status\":\"ATIVO\",\"curso\":\"PGCOMP\"}"
}
```

**Resposta (201/200):**

```json
{
  "message": "Credencial emitida e salva com sucesso!",
  "idDb": "uuid",
  "hashVerificacao": "0xHASH",
  "txHashOnChain": "0xTXHASH (ou null se já existia)"
}
```

---

### POST `/api/verificar`

**Modo PRIVADO (recomendado)** — envia somente o hash:

```json
{ "usuarioAddress": "0xUSUARIO", "hashVerificacao": "0xHASH_CANONICO" }
```

**Modo LEGADO (compatibilidade)** — envia o JSON, o backend calcula o hash:

```json
{ "usuarioAddress": "0xUSUARIO", "dadosCredencialJsonString": "{\"status\":\"ATIVO\",\"curso\":\"PGCOMP\"}" }
```

**Resposta (200):**

```json
{ "verificado": true, "hashVerificacao": "0xHASH", "source": "hash|json" }
```

---

### GET `/api/exportar?userAddress=0xSEU_ENDERECO`

Retorna `backup.json` com **todos os blobs criptografados** e metadados (headers `Content-Disposition` e `no-store`).

---

## Padrões W3C — VC-JWT

Endpoints opcionais para **Verifiable Credentials**:

* `POST /api/vc/emitir`
  **Body**:

  ```json
  { "subjectAddress":"0xUSUARIO", "claims": { "status":"ATIVO","curso":"PGCOMP" }, "expirationSeconds": 7776000 }
  ```

  **Resposta**: `{ "format":"vc-jwt", "issuer":"did:ethr:sepolia:0x...", "jwt":"<...>" }`

* `POST /api/vc/verificar`
  **Body**: `{ "jwt":"<VC-JWT>" }`
  **Resposta**: `{ "verified": true, "issuer": "...", "subject": "...", "types": [...], "payload": {...} }`

> Dica: você pode **incluir o VC-JWT dentro do objeto cifrado** (`blobCriptografado`), preservando portabilidade e interoperabilidade W3C.

---

## Contrato Inteligente

* **Rede:** Ethereum **Sepolia**
* **Funções principais:**

  * `emitirCredencial(address _usuario, bytes32 _hashCredencial)`
  * `verificarCredencial(address _usuario, bytes32 _hashCredencial) public view returns (bool)`
  * `revogarCredencial(bytes32 _hashCredencial)` *(o `msg.sender` é o titular)*

> On-chain **não guarda PII**. Apenas **hashes** e **status**. O JSON original fica off-chain, **criptografado no cliente**.

---

## Roteiro de Demonstração (8–10 min)

**Fase 1 — Contexto (2 min)**
IAM tradicional × SSI/DID, LGPD, Tolerância a Falhas.

**Fase 2 — Prova sem revelar dados (4 min)**
Emissão → Verificação Pública (UI envia só o **hash**). Mostrar **VERDADEIRO**.

**Fase 3 — Soberania (2 min)**
**Revogação** on-chain com MetaMask. **Exportar** carteira de dados (`backup.json`).

**Fase 4 — Conclusão (1 min)**
Próximos passos: **W3C completo + ZK** e **IoT/Edge**.

---

## Privacidade & Segurança

* **Nunca** armazene PII on-chain.
* **Cifre no cliente** com WebCrypto (AES-GCM + PBKDF2/Argon2id).
* Hash **canônico** do JSON (RFC 8785) antes do `keccak256`.
* `EMISSOR_PRIVATE_KEY` **só** no backend.
* Headers `Cache-Control: no-store` nas respostas sensíveis; **logs sem PII**.
* Rate-limits e storage seguro de segredos (Vercel).

---

## Roadmap

* **ECIES/KEM** para compartilhamento seguro de chaves de sessão.
* **W3C completo**: DIDs, VCs e VPR (Presentation Requests).
* **Importação** de `backup.json` em outra instância (UI).
* **Testes** unit/e2e (Vitest/Playwright).
* **NatSpec** + verificação do contrato no Etherscan.
* **ZK** (Circom/Noir): provar predicados (ex.: *maior de 18*) sobre o JSON sem revelá-lo.

---

## Licença & Autor

* **Licença:** MIT
* **Autor:** Tarson Marcelo Florêncio Santos
* **GitHub:** [https://github.com/florenciotarson](https://github.com/florenciotarson)
* **LinkedIn:** [https://www.linkedin.com/in/tarsonmarceloflorencio/](https://www.linkedin.com/in/tarsonmarceloflorencio/)

---
