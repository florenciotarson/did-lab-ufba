# Lab de Identidade Soberana (DID/SSI) - PoC PGCOMP/UFBA 🇧🇷

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Status: PoC](https://img.shields.io/badge/status-Prova%20de%20Conceito-brightgreen)](https://github.com/florenciotarson/did-lab-ufba)
[![Blockchain: Sepolia](https://img.shields.io/badge/Blockchain-Sepolia%20Testnet-purple)](https://sepolia.etherscan.io/)

**Prova de Conceito (PoC) de Identidade Descentralizada (DID/SSI) desenvolvida como parte do processo seletivo para o Mestrado Acadêmico do Programa de Pós-Graduação em Ciência da Computação (PGCOMP) da Universidade Federal da Bahia (UFBA), regido pelo Edital 10/2025.**

**Lab Online:** [**https://did.oxecollective.com**](https://did.oxecollective.com)

---

## 1. Motivação e Contexto

O paradigma dominante de identidade digital, baseado em provedores centralizados (IdPs) via protocolos como OAuth e SAML, apresenta desafios intrínsecos que motivam esta pesquisa:

* **Centralização de Risco:** Plataformas como Okta, Auth0, Google ou Microsoft tornam-se pontos únicos de falha e alvos primários para vazamentos de dados em larga escala. Minha experiência profissional em IAM evidencia a constante preocupação com a segurança e a disponibilidade desses sistemas centralizados.
* **Perda de Soberania:** O usuário não possui controle criptográfico real sobre sua identidade ou seus dados. A "identidade" pertence, na prática, ao provedor.
* **Compartilhamento Excessivo:** Para verificar um único atributo (ex: maioridade), o usuário é frequentemente obrigado a revelar um conjunto muito maior de informações pessoais (RG, CNH completos).
* **Falta de Interoperabilidade e Lock-in:** A dependência de plataformas proprietárias dificulta a portabilidade da identidade entre diferentes serviços e ecossistemas.

Este projeto explora a **Identidade Soberana (Self-Sovereign Identity - SSI)**, utilizando **Identificadores Descentralizados (DIDs)** e **Credenciais Verificáveis (VCs - simuladas aqui)**, como uma alternativa focada em:

*  **Soberania do Usuário:** Devolver o controle criptográfico da identidade e dos dados ao indivíduo.
*  **Privacidade Aprimorada (Zero-Knowledge):** Permitir a comprovação de fatos (via *Verifiable Presentations*) sem revelar os dados brutos subjacentes, utilizando hashes como provas verificáveis on-chain.
*  **Segurança e Resiliência:** Eliminar pontos únicos de falha através de um registro descentralizado (blockchain).
*  **Inclusão Digital:** Basear-se em padrões abertos (W3C DID) e infraestrutura potencialmente gratuita ou de baixo custo para o usuário final.
* 🇧🇷 **Alinhamento Estratégico:** Convergir com os requisitos da LGPD e com as iniciativas de soberania digital exploradas pela **Rede Nacional de Ensino e Pesquisa (RNP)** no Brasil.

## 2. Conceito Central: Arquitetura Híbrida ("Cartório" vs. "Cofre")

Para equilibrar transparência, segurança e privacidade, esta PoC adota uma arquitetura híbrida que separa a **prova pública** do **dado privado**:

* **Blockchain (Ethereum Sepolia Testnet - O "Cartório" Imutável):**
    * Armazena o Smart Contract `IdentidadeDID.sol`, que funciona como um registro público e descentralizado.
    * **NÃO armazena dados pessoais**, nem mesmo criptografados.
    * Registra apenas **hashes criptográficos (`bytes32`)** das credenciais emitidas, associados ao DID (endereço Ethereum) do usuário e do emissor.
    * Fornece funções públicas e gratuitas (`view`) para verificar a validade (`true`/`false`) de um hash específico, garantindo a integridade e a disponibilidade da *prova*.

* **Banco de Dados Off-Chain (Neon Serverless Postgres via Vercel - O "Cofre" Privado):**
    * Armazena as informações que **NÃO** devem ir para a blockchain pública.
    * **`blobCriptografado`:** O conteúdo original da credencial (ex: JSON com dados pessoais), que **DEVE** ser criptografado no lado do cliente (frontend/aplicativo do usuário) usando a chave privada do usuário antes de ser enviado para o banco (nesta PoC, simulado com Base64 por simplicidade). A plataforma *não tem acesso* aos dados decifrados.
    * **Metadados:** Informações contextuais para a aplicação (nome amigável da credencial, descrição, data de emissão, referência ao emissor).
    * **Soberania:** A criptografia ponta-a-ponta (a ser implementada corretamente) garante que apenas o usuário possa decifrar seus dados. A funcionalidade de exportação (`backup.json`) permite ao usuário levar seus dados criptografados para qualquer outra plataforma compatível, quebrando o *lock-in*.

## 3. Funcionalidades Implementadas (PoC)

*  **Emissão de Credenciais:** API segura (`/api/emitir`) que recebe dados, gera hash, registra o hash on-chain (via Smart Contract, pagando gás com a chave do Emissor) e salva o blob (simuladamente) criptografado + metadados no Postgres.
*  **Verificação Zero-Knowledge (Simplificada):** API pública (`/api/verificar`) e interface frontend que permitem a qualquer pessoa verificar se um hash específico é válido para um usuário, consultando a função `view` do Smart Contract e recebendo apenas `true` ou `false`.
*  **Revogação pelo Usuário:** Função `revogarCredencial` no Smart Contract, permitindo ao usuário (interagindo diretamente com o contrato via MetaMask ou similar) invalidar suas próprias credenciais on-chain.
*  **Soberania (Prova Conceitual):** A arquitetura com banco de dados off-chain permite a implementação futura da exportação/importação de dados (`backup.json`), garantindo a portabilidade e o controle do usuário.

## 4. Stack Tecnológica (Foco em Serverless e 0800)

* **Blockchain:** Solidity `^0.8.20`, Ethereum Sepolia Testnet, MetaMask (interação do usuário).
* **Interação Web3:** Ethers.js (v6).
* **Backend:** Vercel Serverless Functions (API Routes do Next.js em Node.js).
* **Frontend:** Vercel Hosting (Next.js 14+ com App Router, React, Tailwind CSS).
* **Banco de Dados:** Neon Serverless Postgres (via Vercel Integration).
* **ORM:** Prisma.
* **Infraestrutura Auxiliar:** Alchemy (Nó RPC Sepolia Gratuito), Cloudflare (DNS Gratuito).

## Como Rodar Localmente (Guia Detalhado)

Este guia detalha os passos necessários para configurar e executar a Prova de Conceito (PoC) da Identidade Soberana (DID/SSI) em seu ambiente de desenvolvimento local.

**Pré-requisitos:**

* **Node.js e npm:** Certifique-se de ter o Node.js (versão LTS recomendada) e o npm instalados. Verifique com `node -v` e `npm -v` no seu terminal.
* **Git:** Necessário para clonar o repositório. Verifique com `git --version`.
* **MetaMask:** Extensão de navegador instalada ([metamask.io](https://metamask.io/)) para interagir com a blockchain.
* **Contas (Opcional, mas Recomendado):**
    * Conta Vercel ([vercel.com](https://vercel.com/)) - Para puxar as variáveis de ambiente do banco de dados Neon.
    * Conta Alchemy ([alchemy.com](https://www.alchemy.com/)) - Para obter um endpoint RPC gratuito para a rede Sepolia.

**Passos:**

1.  **Clonar o Repositório:**
    * Abra seu terminal ou use o terminal integrado do VS Code.
    * Navegue até o diretório onde você deseja salvar o projeto.
    * Execute o comando `git clone` seguido da URL do repositório no GitHub. Depois, entre na pasta criada:
        ```bash
        git clone [https://github.com/florenciotarson/did-lab-ufba.git](https://github.com/florenciotarson/did-lab-ufba.git)
        cd did-lab-ufba
        ```
    * **Explicação:** Baixa todo o código-fonte do projeto do GitHub para sua máquina local e entra no diretório do projeto.

2.  **Instalar Dependências:**
    * Dentro da pasta `did-lab-ufba`, execute o comando `npm install` para baixar todas as bibliotecas listadas no arquivo `package.json`.
    * Instale também a biblioteca `ethers`, essencial para interagir com a blockchain Ethereum:
        ```bash
        npm install
        npm install ethers
        ```
    * **Explicação:** `npm install` lê o `package.json` e baixa as dependências do projeto (React, Next.js, Prisma Client, etc.) para a pasta `node_modules`. `npm install ethers` adiciona especificamente a biblioteca Ethers.js.

3.  **Implantar o Smart Contract (`IdentidadeDID.sol`):**
    * **Onde:** Use o [Remix IDE](https://remix.ethereum.org/) no seu navegador.
    * **Ação:**
        * Crie um novo arquivo `IdentidadeDID.sol` no Remix.
        * Copie e cole o código Solidity fornecido neste projeto (do diretório `/contracts` ou da seção anterior deste README).
        * Compile o contrato (aba "Solidity Compiler", use versão `^0.8.20`). Verifique o tique verde ✅.
        * Vá para a aba "Deploy & Run Transactions".
        * **Environment:** Selecione "Injected Provider - MetaMask". Conecte sua carteira MetaMask.
        * **Rede:** Certifique-se de que o MetaMask está conectado à rede de testes **Sepolia**.
        * **Conta:** Use sua conta principal (Admin) do MetaMask, que deve ter ETH de teste da Sepolia (obtido via Faucet).
        * **Deploy:** Clique no botão "Deploy". Confirme a transação no MetaMask.
    * **Resultado Crucial:** Após o deploy, copie o **Endereço do Contrato** implantado (ex: `0x...`) e o **ABI** (na aba Compiler, botão "ABI").
    * **Explicação:** Este passo publica o "Cartório" (`IdentidadeDID.sol`) na blockchain pública de testes. O Endereço identifica onde o contrato está, e o ABI é o "manual" que o JavaScript usará para chamar as funções do contrato.

4.  **Configurar Variáveis de Ambiente Locais (`.env.development.local`):**
    * **Crie o Arquivo:** Na raiz do projeto `did-lab-ufba` (no VS Code), crie um arquivo chamado **`.env.development.local`**.
    * **Variáveis do Banco (Neon via Vercel):**
        * Instale a Vercel CLI (se ainda não tiver): `npm install -g vercel`.
        * Faça login: `vercel login`.
        * Link o projeto: `vercel link` (conecte à sua conta e ao projeto `did-lab-ufba` no Vercel).
        * Puxe as variáveis do Neon:
            ```bash
            vercel env pull .env.development.local
            ```
        * **Explicação:** Este comando busca as credenciais seguras do banco de dados Neon (que você configurou no Vercel) e as salva automaticamente no seu arquivo `.env.development.local`.
    * **Variáveis da Blockchain (Adicionar Manualmente):**
        * Abra o arquivo `.env.development.local`. As variáveis `POSTGRES_...` já devem estar lá.
        * **Adicione** as seguintes linhas no final, preenchendo com seus valores:
            ```ini
            # Endpoint RPC da Alchemy para a rede Sepolia (Permite LER da blockchain)
            NEXT_PUBLIC_SEPOLIA_RPC_URL="SUA_URL_HTTPS_DA_ALCHEMY_SEPOLIA"

            # Chave Privada da conta MetaMask 'LAB_EMISSOR' (Permite ESCREVER na blockchain via backend)
            # Crie uma conta separada no MetaMask, envie ETH de teste, e exporte a chave privada dela.
            EMISSOR_PRIVATE_KEY="SUA_CHAVE_PRIVADA_DA_CONTA_EMISSOR"

            # Endereço do Smart Contract implantado na Sepolia (Resultado do Passo 3)
            NEXT_PUBLIC_CONTRATO_ENDERECO="ENDERECO_DO_SEU_CONTRATO_IMPLANTADO"
            ```
    * **Salve o arquivo.**
    * **Explicação:** `.env.development.local` guarda segredos que sua aplicação local precisa para rodar (senhas de banco, chaves de API, chaves privadas). `NEXT_PUBLIC_` significa que a variável também estará acessível no código do navegador (frontend), enquanto as outras (como `EMISSOR_PRIVATE_KEY`) ficam *apenas* no servidor (backend) por segurança.

5.  **Configurar o Banco de Dados (Prisma Migrate - Primeira Vez):**
    * **Verifique o Schema:** Abra `prisma/schema.prisma` e confira se a estrutura da tabela `Credencial` está correta.
    * **Verifique a Conexão:** Abra `.env.development.local` e garanta que a linha `DATABASE_URL=${POSTGRES_PRISMA_URL}` (ou a URL direta) está correta.
    * **Execute a Migração:** No terminal integrado do VS Code, rode o comando abaixo. Use o prefixo `dotenv` se o Prisma não estiver lendo o `.env` automaticamente:
        ```bash
        # Tente primeiro sem o prefixo:
        # npx prisma migrate dev --name init

        # Se der erro de DATABASE_URL não encontrada, use o prefixo:
        npx dotenv -e .env.development.local -- npx prisma migrate dev --name init
        ```
    * **Explicação:** `prisma migrate dev` lê seu `schema.prisma`, conecta-se ao banco Neon usando a `DATABASE_URL` e cria/atualiza as tabelas no banco de dados real para corresponder ao schema definido. `--name init` dá um nome à sua primeira migração. O prefixo `dotenv` força o carregamento das variáveis do arquivo `.env` antes de executar o Prisma.

6.  **Executar o Projeto:**
    * No terminal integrado do VS Code, inicie o servidor de desenvolvimento do Next.js:
        ```bash
        npm run dev
        ```
    * **Acesse:** Abra seu navegador e vá para [http://localhost:3000](http://localhost:3000).
    * **Explicação:** `npm run dev` inicia o servidor Next.js em modo de desenvolvimento. Ele compila o código, disponibiliza o frontend e as APIs, e recarrega automaticamente quando você faz alterações nos arquivos.

Agora você deve ter o Lab DID rodando na sua máquina local, pronto para testes e desenvolvimento!
## Autor

* **Tarson Marcelo Florêncio Santos**
* [LinkedIn](https://www.linkedin.com/in/tarsonmarceloflorencio) | [GitHub](https://github.com/florenciotarson)
