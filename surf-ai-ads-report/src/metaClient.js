const GRAPH_API_VERSION = "v26.0";
const BASE_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

/**
 * Erro especifico para falhas na Graph API, preservando o codigo
 * e a mensagem original retornada pela Meta (util pra diagnosticar
 * permissao faltando vs token expirado vs recurso inexistente).
 */
export class GraphApiError extends Error {
  constructor(message, code, subcode, endpoint) {
    super(message);
    this.name = "GraphApiError";
    this.code = code;
    this.subcode = subcode;
    this.endpoint = endpoint;
  }
}

/**
 * Faz uma chamada GET generica na Graph API.
 * @param {string} path - ex: "me/adaccounts"
 * @param {Record<string, string>} params - query params (sem o access_token)
 * @param {string} accessToken
 */
async function graphGet(path, params, accessToken) {
  const url = new URL(`${BASE_URL}/${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  url.searchParams.set("access_token", accessToken);

  const response = await fetch(url.toString());
  const body = await response.json();

  if (!response.ok || body.error) {
    const err = body.error ?? {};
    throw new GraphApiError(
      err.message ?? `HTTP ${response.status}`,
      err.code,
      err.error_subcode,
      path
    );
  }

  return body;
}

/**
 * Lista as contas de anuncio que o usuario do token administra.
 */
export async function getAdAccounts(accessToken) {
  const data = await graphGet(
    "me/adaccounts",
    { fields: "id,name,account_status,currency" },
    accessToken
  );
  return data.data;
}

/**
 * Lista as Paginas do Facebook administradas pelo usuario,
 * incluindo o token de pagina (necessario pra insights) e a
 * conta do Instagram vinculada, se houver.
 */
export async function getManagedPages(accessToken) {
  const data = await graphGet(
    "me/accounts",
    { fields: "id,name,access_token,instagram_business_account{id,username}" },
    accessToken
  );
  return data.data;
}

/**
 * Insights de anuncios (pagos) para uma conta de anuncios, no nivel de anuncio individual.
 * date_preset controla a janela: last_7d, last_30d, last_90d, etc.
 */
export async function getAdInsights(adAccountId, accessToken, datePreset = "last_30d") {
  const data = await graphGet(
    `${adAccountId}/insights`,
    {
      level: "ad",
      date_preset: datePreset,
      fields: "campaign_name,adset_name,ad_name,impressions,clicks,ctr,cpc,spend,actions",
    },
    accessToken
  );
  return data.data;
}

/**
 * Insights organicos de nivel de Pagina (alcance, engajamento).
 * Requer o Page Access Token, nao o token de usuario.
 */
export async function getPageInsights(pageId, pageAccessToken, since, until) {
  const data = await graphGet(
    `${pageId}/insights`,
    {
      metric: "page_impressions,page_engaged_users,page_post_engagements",
      period: "day",
      since,
      until,
    },
    pageAccessToken
  );
  return data.data;
}

/**
 * Posts recentes do Instagram com metricas organicas por post
 * (alcance, impressoes, curtidas, comentarios).
 */
export async function getInstagramPostInsights(igAccountId, pageAccessToken, limit = 25) {
  const media = await graphGet(
    `${igAccountId}/media`,
    { fields: "id,caption,timestamp,media_type,like_count,comments_count", limit: String(limit) },
    pageAccessToken
  );

  const withInsights = [];
  for (const post of media.data) {
    try {
      const metricSet =
        post.media_type === "CAROUSEL_ALBUM" || post.media_type === "IMAGE"
          ? "reach,impressions,saved"
          : "reach,impressions,saved,plays";
      const insights = await graphGet(
        `${post.id}/insights`,
        { metric: metricSet },
        pageAccessToken
      );
      const metrics = Object.fromEntries(
        insights.data.map((m) => [m.name, m.values?.[0]?.value])
      );
      withInsights.push({ ...post, ...metrics });
    } catch (err) {
      // Posts muito antigos ou sem permissao de insight individual
      // nao devem derrubar o relatorio inteiro - registra e segue.
      withInsights.push({ ...post, insightsError: err.message });
    }
  }
  return withInsights;
}
