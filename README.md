<div align="center">
  <img src="https://img.shields.io/badge/Status-Em_Produ%C3%A7%C3%A3o-10B981?style=for-the-badge" alt="Status" />
  <h1>⏱️ Ponto Seguro</h1>
  <p><b>Sistema de Controle de Jornada e Auditoria Jurídica (SaaS/PWA)</b></p>
</div>

<br>

## 📖 Sobre o Projeto

O **Ponto Seguro** é uma aplicação Full Stack desenvolvida para revolucionar o controle de ponto e a gestão de ponto de funcionários (especialmente em trabalho externo, como construtoras e frentes de obras).

Projetado como um **PWA (Progressive Web App)**, ele funciona como um aplicativo nativo no celular do colaborador, eliminando a necessidade de relógios de ponto físicos caros e trazendo segurança anti-fraude e validade jurídica para a empresa.

## 🚀 Principais Funcionalidades

### 📱 Aplicativo do Colaborador (PWA)
* **Cerca Eletrônica (Geofencing):** O sistema utiliza a fórmula matemática de Haversine para cruzar o GPS do celular com a coordenada da obra. O botão de "bater ponto" é bloqueado se o colaborador estiver a mais de 50 metros do local.
* **Verificação Biométrica:** Integração com a câmera do celular para capturar uma *selfie* no momento exato do registro.
* **Travas de Turno Inteligentes:** Bloqueio automático de entrada/saída baseado no horário comercial definido pela empresa, evitando registros indevidos.
* **Assinatura Eletrônica:** No fim do mês, o funcionário audita seu espelho de ponto e assina digitalmente pelo app.

### 💻 Dashboard Gerencial (Gestor / RH)
* **Gestão de Obras e Locais:** Cadastro de frentes de trabalho com busca de endereços (API Photon/Komoot) ou captura direta de coordenadas GPS.
* **Lançamento Manual Anti-Duplicidade:** Gestores podem ajustar batidas ou justificar faltas/atestados, com sistema que bloqueia a inserção de horas duplicadas ou somas irreais.
* **Laudo Técnico Jurídico:** Geração de PDFs de auditoria para fins de Ministério do Trabalho (Lei 14.063/2020), contendo Hash Criptográfico (SHA-256), IP da rede e coordenada de GPS do momento da assinatura do colaborador.
* **Cálculo de Desconto Automático:** O sistema calcula as jornadas dinamicamente, abatendo intervalos de almoço e exibindo de forma limpa para a contabilidade.
* **Exportação via WhatsApp:** Compartilhamento direto dos PDFs e extratos de horas com os funcionários em um clique.

---

## 🛠️ Tecnologias Utilizadas

Este projeto foi construído utilizando as seguintes ferramentas modernas do ecossistema de desenvolvimento:

* **[React](https://reactjs.org/) & [Vite](https://vitejs.dev/):** Biblioteca principal e *bundler* super rápido para a interface web.
* **[TypeScript](https://www.typescriptlang.org/):** Tipagem estática para garantir um código robusto, previsível e livre de bugs durante a manutenção.
* **[Tailwind CSS](https://tailwindcss.com/):** Estilização utilitária para criar um design responsivo, moderno e adaptável (Desktop e Mobile).
* **[Supabase](https://supabase.com/):** Backend as a Service (BaaS) atuando como o motor da aplicação:
  * **PostgreSQL:** Banco de dados relacional.
  * **Supabase Auth:** Autenticação de usuários segura e e-mails de recuperação de senha.
  * **Row Level Security (RLS):** Regras de segurança rigorosas aplicadas diretamente no banco, garantindo que funcionários vejam apenas seus dados.
  * **Supabase Storage:** Armazenamento seguro de *buckets* para as fotos biométricas.
* **[Lucide React](https://lucide.dev/):** Biblioteca de ícones elegantes.
* **Web APIs Nativas:** `navigator.geolocation` (para o tracking GPS) e Web Crypto API (`crypto.subtle.digest`) para a geração de chaves SHA-256 de auditoria.

---

## 👨‍💻 Autor

Projeto desenvolvido e arquitetado por **Carlos Silva**.
* [LinkedIn](https://www.linkedin.com/in/carlos-silva-xiru/)
* [GitHub](https://github.com/Carlos-xiruu)
