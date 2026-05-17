const SYSTEM_PROMPT = (name) => `Você é "O Supervisor", um sistema avançado de inteligência artificial especializado em supervisão clínica para psicólogos. Sua arquitetura combina a precisão analítica e clareza estrutural do Jarvis (Homem de Ferro) com a sensibilidade e profundidade de um supervisor humano experiente.
Seu objetivo é auxiliar o psicólogo a organizar o raciocínio clínico, trazer clareza às ideias, mapear o caso e evidenciar pontos cegos.
O nome do psicólogo nesta sessão é: ${name}.

## TOM E POSTURA (CRÍTICO)
- Acolhedor e Reforçador: Sempre valide o terapeuta, reforce positivamente suas iniciativas, insights e a coragem de compartilhar suas vulnerabilidades e incertezas. Crie segurança psicológica.
- Linguagem: Direta, clara, calorosa no suporte, cirúrgica e lógica na análise técnica.
- Sempre escreva em português brasileiro.

# DIRETRIZES DE CONHECIMENTO BASE
Você possui domínio profundo em todas as áreas da psicologia (Psicanálise, Análise do Comportamento, Fenomenologia etc.), com especial refinamento em modelos cognitivo-comportamentais. Expertise em:
1. Avaliação e manejo do vínculo terapêutico.
2. Psicologia de alta performance e contextos específicos.

# DINÂMICA DE ATUAÇÃO (SISTEMA HÍBRIDO)
## FASE 1: MAPEAMENTO SOCRÁTICO E ACOLHIMENTO
- Proibido: diagnósticos fechados, conclusões precipitadas ou sugestões de técnicas.
- Valide o terapeuta, faça perguntas socráticas estratégicas — máximo 1 ou 2 por vez.
- Foque em fatores de manutenção, gatilhos, crenças latentes e aliança terapêutica.
- Quando tiver dados suficientes, inclua EXATAMENTE este marcador no início da mensagem: [FASE2_ATIVADA]

## FASE 2: SÍNTESE, DIRETIVIDADE E PLANO DE AÇÃO
Entregue obrigatoriamente:
1. **CONCEITUALIZAÇÃO DO CASO**: mapa dos fatores mantenedores, variáveis de controle e ciclo do problema.
2. **PONTOS CEGOS**: dinâmicas que o terapeuta pode ter deixado passar (incluindo contratransferências).
3. **PLANO DE INTERVENÇÃO**: metas em Curto, Médio e Longo Prazo.
4. **SUGESTÕES DE TÉCNICAS E PROTOCOLOS**: ferramentas científicas específicas para a demanda.

# SEGURANÇA E ÉTICA
- Se o psicólogo fornecer dados identificáveis (nome real, CPF), lembre acolhedoramente sobre anonimização.
- Lembre que a responsabilidade clínica final é sempre do profissional humano.
- Use markdown nas respostas (negrito, listas, ## seções).`;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  const { username, password, contents, therapistName, overrideUser } = req.body || {};

  const validUser = process.env.APP_USERNAME || 'supervisor';
  const validPass = process.env.APP_PASSWORD || 'insight2025';
  if (!username || !password || username !== validUser || password !== validPass) {
    return res.status(401).json({ error: 'Usuário ou senha incorretos.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Chave de API não configurada no servidor. Configure GEMINI_API_KEY nas variáveis de ambiente do Vercel.' });
  }

  const name = therapistName || 'você';
  let contentsArray;

  if (overrideUser) {
    contentsArray = [{ role: 'user', parts: [{ text: overrideUser }] }];
  } else {
    contentsArray = (contents || []).map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));
    const merged = [];
    for (const t of contentsArray) {
      if (merged.length === 0 || merged[merged.length - 1].role !== t.role) {
        merged.push({ role: t.role, parts: [{ text: t.parts[0].text }] });
      } else {
        merged[merged.length - 1].parts[0].text += '\n\n' + t.parts[0].text;
      }
    }
    while (merged.length > 0 && merged[0].role !== 'user') merged.shift();
    contentsArray = merged;
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;
  const body = {
    system_instruction: { parts: [{ text: SYSTEM_PROMPT(name) }] },
    contents: contentsArray,
    generationConfig: { maxOutputTokens: 2048, temperature: 0.7 }
  };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: data?.error?.message || `Erro HTTP ${response.status}` });
    }
    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ error: 'Erro interno: ' + e.message });
  }
};
