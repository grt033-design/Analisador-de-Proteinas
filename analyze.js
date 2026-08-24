// Proxy server-side para a API da Anthropic.
// Mantém a chave de API fora do navegador - o front-end nunca a vê.
// Configure a variável de ambiente ANTHROPIC_API_KEY no painel do Netlify
// (Site settings -> Environment variables) antes de publicar.

// Só aceita chamadas vindas do próprio site (produção ou deploy preview do Netlify).
// Não é uma barreira à prova de tudo - quem forjar o header Origin ainda passa -
// mas evita que a URL da função seja usada por acaso ou por scraping casual.
function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (origin === 'https://quantasproteinas.netlify.app') return true;
  return /^https:\/\/[a-z0-9-]+--quantasproteinas\.netlify\.app$/.test(origin);
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Método não permitido.' }) };
  }

  const origin = event.headers.origin || event.headers.Origin;
  if (!isAllowedOrigin(origin)) {
    return { statusCode: 403, body: JSON.stringify({ error: 'Origem não autorizada.' }) };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'ANTHROPIC_API_KEY não configurada nas variáveis de ambiente do Netlify.' })
    };
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: event.body
    });

    const bodyText = await response.text();
    return {
      statusCode: response.status,
      headers: { 'Content-Type': 'application/json' },
      body: bodyText
    };
  } catch (err) {
    return {
      statusCode: 502,
      body: JSON.stringify({ error: 'Falha ao contactar a API de análise.' })
    };
  }
};
