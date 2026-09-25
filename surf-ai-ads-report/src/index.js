import "dotenv/config";
import { writeFile } from "node:fs/promises";
import {
  getAdAccounts,
  getManagedPages,
  getAdInsights,
  getInstagramPostInsights,
} from "./metaClient.js";
import { summarizeAdInsights, summarizeInstagramPosts, formatReport } from "./report.js";

async function main() {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) {
    console.error("META_ACCESS_TOKEN nao encontrado. Confira seu arquivo .env.");
    process.exit(1);
  }

  console.log("Descobrindo contas de anuncio e paginas vinculadas ao token...");
  const [adAccounts, pages] = await Promise.all([
    getAdAccounts(token),
    getManagedPages(token),
  ]);

  if (adAccounts.length === 0) {
    console.error(
      "Nenhuma conta de anuncios encontrada para este token. " +
        "Confirme se voce ja tem uma Ad Account criada no Business Manager."
    );
    process.exit(1);
  }
  if (pages.length === 0) {
    console.error(
      "Nenhuma Pagina encontrada para este token. " +
        "Confirme se a Pagina esta vinculada ao seu portfolio empresarial."
    );
    process.exit(1);
  }

  // Assume a primeira conta/pagina encontrada. Se voce tiver mais de uma
  // no futuro, isso vira um parametro de linha de comando.
  const adAccount = adAccounts[0];
  const page = pages[0];

  console.log(`Conta de anuncios: ${adAccount.name} (${adAccount.id})`);
  console.log(`Pagina: ${page.name} (${page.id})`);

  const adInsights = await getAdInsights(adAccount.id, token, "last_30d");
  const adSummary = summarizeAdInsights(adInsights);

  let igSummary = [];
  let igUsername = "sem-instagram-vinculado";
  if (page.instagram_business_account) {
    igUsername = page.instagram_business_account.username;
    console.log(`Instagram vinculado: @${igUsername}`);
    const igPosts = await getInstagramPostInsights(
      page.instagram_business_account.id,
      page.access_token
    );
    igSummary = summarizeInstagramPosts(igPosts);
  } else {
    console.warn(
      "Nenhuma conta do Instagram vinculada a esta Pagina. " +
        "Pulei a secao organica do Instagram no relatorio."
    );
  }

  const reportText = formatReport({
    adAccountName: adAccount.name,
    adSummary,
    pageName: page.name,
    igUsername,
    igSummary,
  });

  const outputPath = `report-${new Date().toISOString().slice(0, 10)}.md`;
  await writeFile(outputPath, reportText, "utf-8");

  console.log("\n" + reportText);
  console.log(`\nRelatorio salvo em ${outputPath}`);
}

main().catch((err) => {
  console.error("Erro ao gerar relatorio:", err.message);
  if (err.code) {
    console.error(`  Codigo Meta: ${err.code}${err.subcode ? ` / ${err.subcode}` : ""}`);
    console.error(`  Endpoint: ${err.endpoint}`);
  }
  process.exit(1);
});
