# Lab de Identidade Soberana (DID/SSI) — PoC PGCOMP/UFBA 🇧🇷

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
![Status](https://img.shields.io/badge/status-PoC-informational)
![Blockchain](https://img.shields.io/badge/Blockchain-Sepolia-5c6bc0)
![Stack](https://img.shields.io/badge/Stack-Next.js%20%7C%20Tailwind%20v4%20%7C%20Prisma%20%7C%20Ethers%20v6-0aa)

**Lab Online:** <https://did.oxecollective.com>  

**Resumo:** Prova de Conceito (PoC) de **Identidade Descentralizada (DID/SSI)** para o **PGCOMP/UFBA (Edital 10/2025)**, linha **Sistemas Computacionais (RCSD)**.  
Foco: **Soberania do usuário**, **Privacidade (Zero-Knowledge)**, **Tolerância a Falhas** e **Web Descentralizada**.

---

## Sumário

- [Motivação](#motivação)
- [Arquitetura Híbrida](#arquitetura-híbrida)
- [Funcionalidades](#funcionalidades)
- [Stack Tecnológica](#stack-tecnológica)
- [Como Rodar Localmente](#como-rodar-localmente)
- [Variáveis de Ambiente](#variáveis-de-ambiente)
- [Banco de Dados & Prisma](#banco-de-dados--prisma)
- [APIs (Backend Serverless)](#apis-backend-serverless)
- [Contrato Inteligente](#contrato-inteligente)
- [Roteiro de Demonstração (8–10 min)](#roteiro-de-demonstração-8–10-min)
- [Privacidade & Segurança](#privacidade--segurança)
- [Roadmap](#roadmap)
- [Licença & Autor](#licença--autor)

---

## Motivação

Sistemas IAM centralizados (OAuth/SAML/Okta/Auth0) exibem limitações:

- **Risco Centralizado:** ponto único de falha e alvo de vazamentos.
- **Perda de Soberania:** identidade não controlada criptograficamente pelo usuário.
- **Exposição Excessiva:** revela-se mais dados do que o necessário para provar um fato.
- **Lock-in:** baixa portabilidade entre plataformas proprietárias.

**SSI/DID** endereça esses pontos com:

- **Soberania do Usuário:** controle do DID (endereço Ethereum).
- **Privacidade (Zero-Knowledge):** provar fatos sem expor o JSON.
- **Resiliência:** registro descentralizado (blockchain).  
- **🇧🇷 Alinhamento:** LGPD e iniciativas de soberania digital da RNP.

---

## Arquitetura Híbrida

> Separação de **Prova Pública** (on-chain) e **Dado Privado** (off-chain).

| Componente                            | Função                     | Dados                                                                 |
|--------------------------------------|----------------------------|------------------------------------------------------------------------|
| **Blockchain (Ethereum Sepolia)**    | **Cartório Imutável**      | **Somente hashes (bytes32)** e status. Sem PII. Funções `view` `true/false`. |
| **Neon Serverless Postgres (DB)**     | **Cofre Privado**          | `blobCriptografado` (JSON da credencial, **idealmente cifrado no cliente**) + metadados (nome, descrição, emissor, datas). |

**Ideia-chave:** a prova de integridade/validade da credencial é pública; os dados pessoais nunca vão para a blockchain.

---

## Funcionalidades

- ✅ **Emissão** (`/api/emitir`): gera **hash**, registra on-chain com chave do **Emissor** e salva metadados + blob no Postgres.
- 🔍 **Verificação Zero-Knowledge** (`/api/verificar` + UI): retorna **VERDADEIRO/FALSO** consultando função `view` do contrato.
- ❌ **Revogação pelo Usuário**: o titular assina e chama `revogarCredencial` no contrato.
- 💾 **Backup/Exportação** (`/api/exportar`): exporta **todos os blobs cifrados** do usuário para `backup.json`.

---

## Stack Tecnológica

| Camada            | Tecnologia/Serviço                                                                 |
|-------------------|-------------------------------------------------------------------------------------|
| Front/Back        | **Next.js (App Router)**, React, Vercel Functions                                  |
| Estilo            | **Tailwind CSS v4** (preflight)                                                     |
| Web3              | **Ethers v6**                                                                       |
| Blockchain        | **Solidity** na **Sepolia Testnet**                                                 |
| Banco de Dados    | **Neon Serverless Postgres** + **Prisma ORM**                                       |
| Infra Auxiliar    | **Alchemy** (RPC Sepolia), **Cloudflare** (DNS)                                     |

**Nota Tailwind v4 — `app/globals.css`:**

```css
/* Tailwind v4 base (preflight) */
@import "tailwindcss/preflight";

/* Tema (exemplo) */
:root {
  --background: #0a0a0a;
  --foreground: #ededed;
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: Arial, Helvetica, sans-serif;
}
````

## Como Rodar Localmente

### 1\) Pré-requisitos

  * Node.js (LTS) e npm
  * Git
  * MetaMask (navegador)
  * (Opcional) Vercel (puxar vars do Neon) e Alchemy (RPC Sepolia)

### 2\) Clonar & instalar

```bash
git clone [https://github.com/florenciotarson/did-lab-ufba.git](https://github.com/florenciotarson/did-lab-ufba.git)
cd did-lab-ufba

npm install
npm install ethers
```

### 3\) Implantar o contrato (Remix + MetaMask · Sepolia)

1.  Criar `IdentidadeDID.sol`, compilar ($\ge$0.8.20), Deploy com “Injected Provider”.
2.  Guardar endereço do contrato e ABI.

### 4\) Criar variáveis de Ambiente

Crie `.env.development.local` na raiz e preencha (ver seção abaixo).
(Opcional) Puxar vars do projeto Vercel (inclui Neon):

```bash
npm i -g vercel
vercel login
vercel link
vercel env pull .env.development.local
```

### 5\) Banco (Prisma)

```bash
# Se necessário, forçar leitura do .env
npx dotenv -e .env.development.local -- npx prisma migrate dev --name init
# ou simplesmente:
# npx prisma migrate dev --name init
```

### 6\) Executar

```bash
npm run dev
# abra http://localhost:3000
```

-----

## Variáveis de Ambiente

NUNCA exponha chaves privadas no frontend. Somente variáveis `NEXT_PUBLIC_` são acessíveis no navegador.

```dotenv
# RPC de leitura (Alchemy ou outro provedor)
NEXT_PUBLIC_SEPOLIA_RPC_URL="SUA_URL_HTTPS_DA_ALCHEMY_SEPOLIA"

# Backend: chave da conta emissora (usada nas functions /api/emitir)
EMISSOR_PRIVATE_KEY="SUA_CHAVE_PRIVADA_DA_CONTA_EMISSOR"

# Endereço do contrato em Sepolia
NEXT_PUBLIC_CONTRATO_ENDERECO="0xSEU_CONTRATO"

# ---- Banco de Dados (via Vercel/Neon) ----
# Normalmente vem do 'vercel env pull' (garanta que DATABASE_URL exista)
# DATABASE_URL="postgresql://..."
```

-----

## Banco de Dados & Prisma

  * **Tabela principal (exemplo):** `Credencial`
  * **Campos:** `id`, `usuarioAddress`, `hash`, `blobCriptografado`, `nomeAmigavel`, `descricao`, `emissor`, `createdAt`, `revogadaEm` (opcional).
  * **Migrações:** `prisma/migrations/*`
  * **Schema:** `prisma/schema.prisma`

Comandos úteis:

```bash
npx prisma studio       # UI do Prisma
npx prisma generate     # gerar client
npx prisma migrate dev  # aplicar migrações
```

-----

## APIs (Backend Serverless)

Rotas Next.js (Vercel Functions), formato simplificado para a PoC.

### POST `/api/emitir`

**Body:**

```json
{
  "usuarioAddress": "0xDESTINATARIO",
  "dadosCredencialJsonString": "{\"status\":\"ATIVO\",\"curso\":\"PGCOMP\"}",
  "nomeAmigavel": "Matrícula Ativa PGCOMP",
  "descricao": "Emitido em 2025-10-25"
}
```

**Sucesso (200):**

```json
{
  "message": "Credencial emitida",
  "idDb": "uuid",
  "hashVerificacao": "0xHASH",
  "txHashOnChain": "0xTXHASH"
}
```

### POST `/api/verificar`

**Body:**

```json
{
  "usuarioAddress": "0xUSUARIO",
  "dadosCredencialJsonString": "{\"status\":\"ATIVO\",\"curso\":\"PGCOMP\"}"
}
```

**Sucesso (200):**

```json
{
  "verificado": true,
  "hashVerificacao": "0xHASH"
}
```

### GET `/api/exportar?userAddress=0xSEU_ENDERECO`

**Retorno:** arquivo `backup.json` contendo todos os blobs criptografados e metadados do usuário.

-----

## Contrato Inteligente

  * **Rede:** Ethereum Sepolia
  * **Arquivo:** `IdentidadeDID.sol`

Principais funções (exemplo):

  * `registrar(bytes32 hash)` — (chamada pelo emissor via backend)
  * `verificar(bytes32 hash) public view returns (bool)` — consulta pública/gratuita
  * `revogarCredencial(bytes32 hash)` — o usuário (dono) assina e revoga on-chain

> On-chain não guarda PII. Apenas hashes e status. O JSON original fica off-chain, idealmente criptografado no cliente.

-----

## Roteiro de Demonstração (8–10 min)

### Fase 1 — Contextualização (2 min)

| Tópico | Ação | Foco |
| :--- | :--- | :--- |
| Introdução (IAM) | “Minha experiência expõe fragilidades do IAM centralizado…” | Trajetória |
| Problema | “Ponto único de falha; perda de soberania; LGPD.” | Tolerância a Falhas |
| Solução (DID) | “PoC valida Identidade Descentralizada.” | RCSD/Internet do Futuro |

### Fase 2 — Zero-Knowledge (4 min)

  * Arquitetura: “Cartório (prova) vs. Cofre (dado)”.
  * Emissão prévia: endereço de teste + JSON de Matrícula Ativa.
  * Verificação (UI): colar endereço + JSON $\to$ Verificar.
  * Análise: mostrar **VERDADEIRO ✅** — prova sem expor dados.

### Fase 3 — Soberania (2 min)

  * Revogação: usuário assina `revogarCredencial`.
  * Portabilidade: Exportar Minha Carteira de Dados $\to$ `backup.json`.

### Fase 4 — Conclusão (1 min)

  * “Validamos uma DID 0800. Próximos passos do mestrado: criptografia ponta-a-ponta real e escala/IoT.”

-----

## Privacidade & Segurança

  * Nunca armazene PII on-chain.
  * Criptografe no cliente (chave do usuário) antes de enviar para o backend/DB.
  * A PoC simula a criptografia do blob; evolua para crypto real (WebCrypto/ECIES, etc.).
  * `EMISSOR_PRIVATE_KEY` apenas no backend; nunca em `NEXT_PUBLIC_`.
  * Revise CORS, rate-limits, logs e storage seguro de segredos (Vercel).

-----

## Roadmap

  * Criptografia cliente $\to$ servidor com WebCrypto (AES-GCM + ECIES/KEM).
  * VCs/VPR (W3C) e assinaturas compatíveis.
  * Importação de `backup.json` em outra instância.
  * Testes unitários/e2e (Playwright/Vitest).
  * Documentação de contrato (NatSpec) e verificação no Etherscan.

-----

## Licença & Autor

  * **Licença:** MIT
  * **Autor:** Tarson Marcelo Florêncio Santos
  * **GitHub:** [https://github.com/florenciotarson](https://github.com/florenciotarson)
  * **LinkedIn:** [https://www.linkedin.com/in/tarsonmarceloflorencio/](https://www.linkedin.com/in/tarsonmarceloflorencio/)

<!-- end list -->

```

Você pode copiar todo o bloco de código acima e salvar como o arquivo `README.md`.
```
