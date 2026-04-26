# news

*Available in: [English](README.md) | [日本語](README.ja.md) | [Filipino](README.fil.md)*

Noticias de predicciones futuras + dashboard.

- [News Explorer (GitHub Pages)](https://baba-yu.github.io/news/) — dashboard de predicciones futuras
- `report/` — informes diarios de noticias
- `future-prediction/` — verificación diaria de la columna Future de las noticias de ayer contra las de hoy

---

## 2026-04-26

### Noticias

- **Claude Code v2.1.120 retirado el 25 de abril por fallo de inicio en `--resume` / `--continue`; auto-update vuelve a v2.1.119 obligatoriamente** — Error `g9H is not a function`, binario empaquetado de Antigravity con código de salida 1. **8 regresiones simultáneas** entre el 24 y 25 de abril (auto-update roto, cambio silencioso de modelo, duplicación UI, congelación de `/mcp` en WSL2, `CLAUDE.md` ignorado, sandbox.excludedCommands, cuelgue de worktree macOS, dos crashes de `--resume`); la comunidad converge en `claude install 2.1.117` como bajada manual.
- **OpenClaw v2026.4.24 (lanzado el 25 de abril) — Llamadas de voz en tiempo real para todo agente + paquete Google Meet + DeepSeek V4 Flash/Pro de serie** — Sesiones realtime Chrome/Twilio, participación de Google Meet, DeepSeek V4 Flash como default de onboarding, automatización de navegador con coordinate clicks / multi-ventana / per-profile headless override, arreglos masivos en Telegram / Slack / MCP / sesiones / TTS.
- **El lanzamiento de DeepSeek V4 pasa a "stack completo" entre 24-25 de abril — SGLang + Miles Día-0 inferencia + entrenamiento RL + API V4-Pro al 75% off (hasta el 5 de mayo)** — LMSYS / Radixark dotan a SGLang de soporte completo para atención sparse híbrida con **ShadowRadix prefix cache / HiSparse / MTP / Flash Compressor / Lightning TopK**, y Miles entrega Día-0 verified RL con **R3 + indexer replay's Step-0 train-inference diff 0.02-0.03 / Tilelang FP8/BF16 / Hopper/Blackwell/Grace Blackwell parallelism**. **API V4-Pro al 75% off se vuelve ~28x más barata que Claude Opus 4.7**.
- **Bloomberg (26 de abril): la verdadera razón del retraso del lanzamiento de DeepSeek V4 es "un giro estratégico hacia la integración con Huawei Ascend"** — Reportado por el medio afín a CCTV "Yuyuantantian." El lanzamiento V4 originalmente para febrero-marzo se retrasó porque **"DeepSeek pasó meses optimizando el stack de software para chips Huawei Ascend."**
- **CISA añade 4 al KEV el 24 de abril + plazo federal de remediación 8 de mayo** — CVE-2024-7399 (Samsung MagicINFO 9 Path Traversal, CVSS 8.8), CVE-2024-57726 (SimpleHelp Missing Authorization, CVSS 9.9), CVE-2024-57728 (SimpleHelp Path Traversal, CVSS 7.2), CVE-2025-29635 (D-Link DIR-823X Command Injection) — todas "actively exploited in the wild."
- **Anthropic MCP Design Vulnerability (divulgación de OX Security) — riesgo de RCE en 200,000 servidores, defecto a nivel de diseño** — Defecto en la interfaz STDIO del SDK MCP que permite "config → ejecución de comando." Implementaciones Python / TypeScript / Java / Rust afectadas, 150M descargas con repercusión. **Anthropic descarta CVE como "expected behavior";** los investigadores emiten 10+ CVEs individuales.
- **Ataque Comment and Control (Claude Code / Gemini CLI / GitHub Copilot Agent)** — Payloads de comentario HTML oculto en títulos de PR / comentarios de Issue secuestran simultáneamente todas las partes de los tres proveedores y roban secretos de CI. Bounty Anthropic CVSS 9.4 ($100) / Google ($1,337) / GitHub ($500). **Los 3 proveedores parchearon en silencio sin asignar CVE.**
- **LMDeploy CVE-2026-33626 (CVSS 7.5, SSRF) ataque real detectado a 12h31m de la divulgación** — La SSRF en `load_image()` permite escanear AWS IMDS / Redis / MySQL. La brecha "publicación → exploit" se reduce a **la zona de las 12 horas**.
- **Brecha de cadena de suministro Vercel / Context.ai** — Lumma Stealer → empleado de Context.ai → empleado de Vercel OAuth Allow All → toma de Google Workspace → enumeración de variables de entorno → venta por $2M. Primer caso a gran escala de brecha de cadena de suministro OAuth en herramienta AI.
- **Hannover Messe 2026 cierra con Physical AI como primer tema central (20-24 de abril)** — Más de 100 socios incluyendo Siemens / Foxconn / FANUC / KUKA / Universal Robots, con AEON / HMND 01 / Apptronik Apollo / Agility Digit / Figure 02 expuestos en paralelo. Manila Times declara **mercado de $4 billones / fase de adopción masiva**.
- **Tesla Earth Day (25 de abril) + giveaway limitado de Optimus Plant Cube + venta de Earth Day Tee** — En tiendas Tesla en EE. UU., participantes en demos FSD reciben un **Plant Cube** plantado por Optimus, con la **Optimus Earth Day Tee ($40)** a la venta en la tienda online.
- **Big Tech Super Week por delante (al cierre del fin de semana del 26 de abril) — MSFT / GOOGL / META / AMZN el 29 de abril, AAPL el 30 de abril** — Microsoft espera Azure +28% YoY, Alphabet capex FY26 $175-185B, Meta capex FY26 $115-135B / FY27 $142B consenso.
- **Microsoft IKE Service Extensions CVE-2026-33824 (CVSS 9.8, RCE)** — Defecto double free de IKEv2 (CWE-415); un atacante remoto no autenticado puede RCE vía UDP 500/4500. Parcheado el 4/14, pero los intentos de explotación contra entornos sin parche siguen creciendo.
- **llama.cpp build b8936 (26 de abril 03:28 UTC) — optimización AVX2 Q6_K** — `ggml-cpu: optimize avx2 q6_k (#22345)` aterriza en main; binarios completos multi-plataforma publicados.
- **Simon Willison `GPT-5.5 prompting guide` + `WHY ARE YOU LIKE THIS` + cita de Romain Huet (25 de abril)** — Tras la guía oficial de prompting de OpenAI, la fase de validación comunitaria de GPT-5.5 arranca.

[news-20260426.md](report/es/news-20260426.md)

### Validación

- 18 predicciones validadas durante la última semana. Validación continua **Relevance 5** en 8 ejes: **superficie de ataque MCP / confianza OAuth / SaaS-ización Physical AI / estándar de pesos abiertos 1M-context / división propietaria × abierto / inyección indirecta de prompts como categoría primaria de CVE / Agent Control Plane / fuga de Secret CI**.
- **Vulnerabilidades estructurales de la capa de integración MCP / AI expuestas simultáneamente**: Anthropic MCP Design Vulnerability + Comment and Control attack + LMDeploy SSRF, tres en sucesión. Future #3 de hoy declara explícitamente **"OWASP LLM Top 10 v2026 eleva Supply Chain Compromise via AI Integration al #1."**
- **Confianza OAuth + Agent Control Plane**: brecha Vercel / Context.ai reconstruida (Lumma Stealer → OAuth Allow All → venta de $2M) + cuenta regresiva al GA del 30 de abril de Okta for AI Agents + cierre de Google Cloud Next '26 con Gemini Enterprise Agent Platform en el centro (260 anuncios) + staged rollout AWS Bedrock AgentCore CLI / Skills.
- **Physical AI SaaS / RaaS + operación 8h = requisito de procurement**: Hannover Messe 2026 Physical AI como primer tema central, Manila Times mercado $4 billones / fase de adopción masiva, Tesla Optimus Plant Cube giveaway alcanza fase de "entrega física al usuario," Agile ONE en sistema vivo de línea de producción de zapatos.
- **División propietaria × abierto + alianza exclusiva hyperscaler**: Bloomberg 26 de abril hace **"retraso DeepSeek V4 = giro estratégico hacia integración con Huawei Ascend"** oficialmente visible; emerge **escenario de 4 polos** EE. UU. 3 vs China Huawei Ascend; API DeepSeek V4-Pro 75% off la deja 28x más barata que Claude Opus 4.7.
- **1M context como default**: DeepSeek V4-Pro / V4-Flash con Hybrid Attention + 1M context; SGLang + Miles' Día-0 verified RL realiza "inferencia + entrenamiento RL de un modelo de frontera con 1M context corriendo el día del lanzamiento."
- **Relevance 1-3**: Headless Everything (4/20-3, Relevance 2 — OpenClaw per-profile headless override un paso adelante, pero voz / Meet en sentido opuesto); aprendizaje 1-bit nativo (4/19-1, Relevance 2 — solo intro continuo de Bonsai-8B); división de SKU (4/22-1, Relevance 2 — escaso en chips in-house de hyperscalers); inversión local > cloud (4/20-1, Relevance 3 — DeepSeek V4-Pro 75% off contra-presión).
- Predicción 1 del usuario (LLM local malicioso → malware): Anthropic MCP Design Vulnerability (defecto de diseño, denegación de CVE) + Comment and Control (3 vendors parche silencioso + sin CVE deshabilita monitoreo de comportamiento) + cadena Vercel / Context.ai + LMDeploy SSRF expuestos simultáneamente. Subraya fuertemente la predicción del usuario sobre **"diseño zero-trust + path AI-only-inaccessible,"** con Okta for AI Agents Apr 30 GA + Microsoft ZT4AI consolidando la respuesta del mercado.
- Predicción 2 del usuario (división cloud vs local, aumentos SaaS): **estado mixto de dirección opuesta y alineación** — DeepSeek V4-Pro API 75% off (28x más barata) crashea el lado cloud; OpenClaw hace V4 Flash el default de onboarding. Por otro lado, capex Big Tech sticky (MSFT FY26 $146B / GOOGL $175-185B / META $115-135B) + división geopolítica China LLM × Huawei Ascend preserva la estructura a largo plazo.
- Predicción 3 del usuario (mejora de predicción RL/LLM): sin caso directo hoy. SGLang + Miles' Day-0 verified RL avanza la democratización de la infraestructura de entrenamiento RL.

[future-prediction-20260426.md](future-prediction/es/future-prediction-20260426.md)

---

## 2026-04-25

### Noticias

- **NVIDIA recupera capitalización de $5.12T al cierre del 24 de abril** — La superación de Intel después del cierre del 23 de abril enciende el sector de chips. NVIDIA cierra en récord $208.27 (+4.3%); la distancia con Alphabet supera $1T. AMD añade **+13.90% ($347.77)** el mismo día (print 5 de mayo).
- **Tesla convierte el 25 de abril en marketing del Día de la Tierra, regala "Plant Cubes" plantadas por Optimus V3** — En tiendas oficiales en EE. UU., los participantes de demos FSD (Supervised) reciben un Plant Cube plantado por Optimus. El print del 23 de abril reafirmó **debut de V3 a mediados de 2026 / producción en masa julio-agosto**, con capex 2026 oficialmente guiada por encima de $25B.
- **Google Cloud × Thinking Machines Lab: acuerdo GB300 multi-billón de dólares (anunciado 22 de abril)** — TML de Mira Murati adopta VMs A4X Max de Google Cloud impulsadas por NVIDIA **GB300**; velocidad de entrenamiento / serving **2x** generación previa.
- **BMW Group inicia pruebas serias de humanoide AEON en Plant Leipzig desde abril 2026 + abre Centro de Competencia Physical AI** — Sobre el récord de Spartanburg de Figure 02 (**30,000 vehículos X3 en 10 meses / 90,000 piezas / 1.2M pasos / 1,250 horas**), BMW abre el primer hub Physical AI europeo en Leipzig.
- **Hannover Messe 2026 (20-24 de abril) cierra con Physical AI como primer tema central** — 130,000 visitantes / 4,000 expositores / 1,600 ponentes; AEON / HMND 01 / Apptronik Apollo / Agility Digit expuestos en paralelo.
- **OpenAI GPT-5.5 / GPT-5.5 Pro API público 24 de abril** — input $5.00 / output $30.00 per M tokens (**aumento 2x** vs GPT-5.4); Pro a $30 / $180. Codex reduce tokens de salida ~40% para compensar el costo por tarea.
- **DeepSeek V4 Pro benchmarks detallados** — IMOAnswerBench **89.8** (sobre Claude Opus 4.7 75.3 / Gemini 3.1-Pro 81.0, cerca de GPT-5.4 91.4); agentic sobre Sonnet 4.5, clase Opus 4.5. Precio: **$1.74 input / $3.48 output per M tokens (1/7 de Opus 4.7)**, Apache 2.0, integración estrecha con Huawei Ascend.
- **Claude Code v2.1.117 (25 de abril)** — `/resume` auto-resume sesiones grandes / colgadas antes del reload para prevenir desbordamiento de contexto.
- **OpenClaw v2026.4.23 (24 de abril)** — Image gen + edición de imagen de referencia vía Codex OAuth en Providers/OpenAI; también vía API `image_generate` en Providers/OpenRouter.
- **AWS Bedrock AgentCore Browser añade interacción a nivel de OS (22 de abril)** — Carga de archivos / manejo de diálogos OS / cambio entre múltiples ventanas.
- **Salesforce Q4: Agentforce ARR $800M / 29,000 deals (+50% QoQ)** — FY2026 revenue $41.5B, Q4 EPS $3.81 / revenue $11.20B (+12.1% YoY).
- **Nginx UI CVE-2026-33032 (MCPwn, CVSS 9.8) activamente explotada en el mundo real** — Endpoint `/mcp_message` con allowlist IP por defecto vacía bypassa el middleware de auth; 12 llamadas a herramientas MCP no autenticadas expuestas; 2 HTTP requests para tomar Nginx por completo.
- **Saltcorn CVE-2026-41478 (CVSS 9.9) divulgado (24 de abril)** — SQL injection en Mobile-Sync.
- **Amazon × Anthropic adicional $25B + 5GW capacidad Trainium2/3 (detalle finalizado 20 de abril)** — $5B inmediato + $20B vinculado a hitos.
- **AI Tinkerers SF + AI Dev 26 x SF + Sage Future en sucesión (28-30 de abril)**.

[news-20260425.md](report/en/news-20260425.md)

### Validación

- 17 predicciones validadas durante la última semana. Validación continua **Relevance 5** en 6 ejes: **Agent Control Plane / confianza OAuth / SaaS-ización Physical AI / estándar de pesos abiertos 1M-context / alianza exclusiva hyperscaler × laboratorio de frontera / división propietaria × abierto**.
- Más detalle en [future-prediction-20260425.md](future-prediction/en/future-prediction-20260425.md). Para resúmenes diarios completos en español, próximamente.

---

## 2026-04-24

Lanzamiento de DeepSeek V4 Preview (V4-Pro 1.6T MoE / V4-Flash 284B), lanzamiento de OpenAI GPT-5.5, blowout de Intel Q1 2026 +20%, post-mortem de calidad Claude Code de Anthropic + reset de límites de uso, Siemens × Humanoid HMND 01 Alpha 8 horas de operación autónoma en planta Erlangen, formación del eje de proveedores de soluciones Agentic AI Security (Okta for AI Agents / Keycard / Cisco / Microsoft + Exabeam / Zenity / Arize / Braintrust / etc.), Tencent Hunyuan Hy3 Preview de código abierto, ServiceNow -18% post-print.

[news-20260424.md](report/en/news-20260424.md)

---
