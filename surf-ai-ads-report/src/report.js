/**
 * Extrai o numero de "installs" (ou o tipo de acao configurado) do
 * array `actions` que a Meta retorna dentro dos insights de anuncio.
 */
function extractActionCount(actions, actionType) {
  if (!actions) return 0;
  const match = actions.find((a) => a.action_type === actionType);
  return match ? Number(match.value) : 0;
}

/**
 * Resume os insights de anuncios pagos: ordena por CTR desc e calcula totais.
 */
export function summarizeAdInsights(rawInsights) {
  const rows = rawInsights.map((row) => ({
    campaign: row.campaign_name,
    adSet: row.adset_name,
    ad: row.ad_name,
    impressions: Number(row.impressions ?? 0),
    clicks: Number(row.clicks ?? 0),
    ctr: Number(row.ctr ?? 0),
    cpc: Number(row.cpc ?? 0),
    spend: Number(row.spend ?? 0),
    linkClicks: extractActionCount(row.actions, "link_click"),
  }));

  const totals = rows.reduce(
    (acc, r) => ({
      impressions: acc.impressions + r.impressions,
      clicks: acc.clicks + r.clicks,
      spend: acc.spend + r.spend,
    }),
    { impressions: 0, clicks: 0, spend: 0 }
  );

  const sortedByCtr = [...rows].sort((a, b) => b.ctr - a.ctr);

  return { rows: sortedByCtr, totals };
}

/**
 * Resume as metricas organicas de posts do Instagram, destacando o
 * melhor post por alcance.
 */
export function summarizeInstagramPosts(posts) {
  const rows = posts
    .filter((p) => !p.insightsError)
    .map((p) => ({
      id: p.id,
      caption: (p.caption ?? "").slice(0, 60),
      timestamp: p.timestamp,
      likes: p.like_count ?? 0,
      comments: p.comments_count ?? 0,
      reach: Number(p.reach ?? 0),
      impressions: Number(p.impressions ?? 0),
    }))
    .sort((a, b) => b.reach - a.reach);

  return rows;
}

/**
 * Formata o relatorio final como texto, pronto pra imprimir no console
 * ou salvar em arquivo .md.
 */
export function formatReport({ adAccountName, adSummary, pageName, igUsername, igSummary }) {
  const lines = [];
  lines.push(`# Relatorio Surf AI - ${new Date().toLocaleDateString("pt-BR")}`);
  lines.push("");

  lines.push(`## Anuncios pagos (${adAccountName})`);
  lines.push("");
  lines.push(`Total investido: R$ ${adSummary.totals.spend.toFixed(2)}`);
  lines.push(`Impressoes totais: ${adSummary.totals.impressions}`);
  lines.push(`Cliques totais: ${adSummary.totals.clicks}`);
  lines.push("");
  lines.push("| Anuncio | Campanha | CTR | CPC | Gasto | Cliques no link |");
  lines.push("|---|---|---|---|---|---|");
  for (const r of adSummary.rows) {
    lines.push(
      `| ${r.ad} | ${r.campaign} | ${r.ctr.toFixed(2)}% | R$ ${r.cpc.toFixed(2)} | R$ ${r.spend.toFixed(2)} | ${r.linkClicks} |`
    );
  }
  lines.push("");

  lines.push(`## Organico - Instagram (@${igUsername})`);
  lines.push("");
  lines.push("| Post | Alcance | Impressoes | Curtidas | Comentarios |");
  lines.push("|---|---|---|---|---|");
  for (const p of igSummary) {
    lines.push(`| ${p.caption || "(sem legenda)"} | ${p.reach} | ${p.impressions} | ${p.likes} | ${p.comments} |`);
  }
  lines.push("");

  return lines.join("\n");
}
