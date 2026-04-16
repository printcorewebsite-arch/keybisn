import fs from "node:fs/promises";
import path from "node:path";

const [, , typeArg, slugArg, titleArg] = process.argv;

const type = (typeArg || "").trim().toLowerCase();
const slug = (slugArg || "").trim().toLowerCase();
const title = (titleArg || "").trim();

if (!type || !slug || !title) {
  console.error("Usage: node scripts/scaffold-seo-page.mjs <guide|service> <slug> <title>");
  process.exit(1);
}

if (!["guide", "service"].includes(type)) {
  console.error("Type invalide. Utilisez: guide ou service");
  process.exit(1);
}

const projectRoot = process.cwd();
const templatesDir = path.join(projectRoot, "frontend", "templates", "marketing");
const pagesDir = path.join(projectRoot, "frontend", "pages");
const outputPath = path.join(pagesDir, `${slug}.html`);

const templateFile = type === "guide"
  ? path.join(templatesDir, "guide-page.template.html")
  : path.join(templatesDir, "service-page.template.html");

const source = await fs.readFile(templateFile, "utf8");

const replacements = type === "guide"
  ? {
      "{{GUIDE_TITLE}}": title,
      "{{GUIDE_DESCRIPTION}}": `${title} - guide pratique Keybis pour entrepreneurs.`,
      "{{GUIDE_KEYWORDS}}": `${slug.replaceAll("-", " ")}, guide keybis, formalités entreprise`,
      "{{GUIDE_PAGE_TYPE}}": `guide_${slug.replaceAll("-", "_")}`,
      "{{GUIDE_H1}}": title,
      "{{GUIDE_INTRO}}": "Guide structuré pour clarifier les étapes et passer rapidement à l'action.",
      "{{GUIDE_CTA_HREF}}": "/demande?service=creation",
      "{{GUIDE_CTA_TRACK}}": `${slug}_cta_primary`,
      "{{GUIDE_CTA_LABEL}}": "Démarrer ma formalité",
    }
  : {
      "{{PAGE_TITLE}}": title,
      "{{PAGE_DESCRIPTION}}": `${title} - accompagnement Keybis, parcours clair et prise en charge rapide.`,
      "{{PAGE_KEYWORDS}}": `${slug.replaceAll("-", " ")}, keybis, formalités entreprise`,
      "{{PAGE_TYPE}}": `service_${slug.replaceAll("-", "_")}`,
      "{{CTA_HREF}}": "/demande?service=creation",
      "{{CTA_TRACK_STICKY}}": `${slug}_cta_sticky`,
      "{{CTA_TRACK_HERO}}": `${slug}_cta_hero`,
      "{{CTA_TRACK_FINAL}}": `${slug}_cta_final`,
      "{{CTA_LABEL}}": "Démarrer ma formalité",
      "{{SECONDARY_HREF}}": "/guides",
      "{{SECONDARY_TRACK}}": `${slug}_secondary_guides`,
      "{{SECONDARY_LABEL}}": "Voir les guides",
      "{{FINAL_CTA_TITLE}}": "Prêt à passer à l'action ?",
      "{{FINAL_CTA_SUBTITLE}}": "Lancez une demande qualifiée en quelques minutes.",
      "{{FINAL_SECONDARY_HREF}}": "/guides",
      "{{FINAL_SECONDARY_TRACK}}": `${slug}_final_guides`,
      "{{FINAL_SECONDARY_LABEL}}": "Consulter les ressources",
    };

let output = source;
for (const [placeholder, value] of Object.entries(replacements)) {
  output = output.replaceAll(placeholder, value);
}

if (output.includes("{{")) {
  console.warn("Des placeholders restent à compléter dans le fichier généré.");
}

try {
  await fs.access(outputPath);
  console.error(`Le fichier existe déjà: ${outputPath}`);
  process.exit(1);
} catch {
  // le fichier n'existe pas, c'est OK
}

await fs.writeFile(outputPath, output, "utf8");

console.log(`Page créée: ${outputPath}`);
console.log("N'oubliez pas d'ajouter la route dans backend/server.js (PAGE_ROUTES).");
console.log("Pensez aussi à compléter backend/services/marketing-seo.js et marketing-shell.js.");
