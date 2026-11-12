import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const root = new URL("..", import.meta.url);
const content = JSON.parse(await readFile(new URL("content/requirements.json", root), "utf8"));
const allowed = new Set(["SRC-01", "SRC-02", "SRC-03", "SRC-04", "SRC-05", "SRC-06"]);
if (!content.schemaVersion || !content.state || !Array.isArray(content.requirements)) {
  throw new Error("requirements.json has an invalid top-level shape");
}
for (const requirement of content.requirements) {
  if (!requirement.id || !requirement.text || !requirement.state || !Array.isArray(requirement.citations) || requirement.citations.length === 0) {
    throw new Error(`Requirement ${requirement.id || "<missing id>"} is missing text, state, or citations`);
  }
  for (const citation of requirement.citations) {
    if (!allowed.has(citation.sourceId) || !citation.locator) throw new Error(`Invalid citation on ${requirement.id}`);
  }
}
const forbidden = /(UPLOAD_TOKEN\s*[:=]\s*[^`\s]+|Bearer\s+[A-Za-z0-9._-]{16,}|gh[pousr]_[A-Za-z0-9_]+|BEGIN (RSA|OPENSSH|EC) PRIVATE KEY)/;
const files = ["README.md", "site/index.html", "site/styles.css", "site/app.js", "content/requirements.json", "content/requirements.md"];
for (const file of files) {
  const text = await readFile(new URL(file, root), "utf8");
  if (forbidden.test(text)) throw new Error(`Possible secret found in ${file}`);
}
console.log(`Validated ${content.requirements.length} cited requirement(s); no obvious secrets found.`);
