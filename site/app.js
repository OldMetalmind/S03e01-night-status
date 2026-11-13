const SOURCE_PACK = [
  ["SRC-01", "Memo", "Official tagged requirements processed"],
  ["SRC-02", "Screenshot", "Official tagged requirements processed"],
  ["SRC-03", "Recording", "Official tagged requirements processed"],
  ["SRC-04", "PDF", "Official tagged requirements processed"],
  ["SRC-05", "Whiteboard photo", "Official tagged requirements processed"],
  ["SRC-06", "Live tram 3 board", "Candidate phrase requirement"]
];

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[char]));

function renderSources() {
  document.querySelector("#sources").innerHTML = SOURCE_PACK.map(([id, label, status]) => `
    <div class="source-card">
      <strong>${id}</strong>
      <span>${escapeHtml(label)} · ${escapeHtml(status)}</span>
    </div>
  `).join("");
}

function renderRequirements(data) {
  const requirements = document.querySelector("#requirements");
  if (!data.requirements?.length) {
    requirements.innerHTML = "<p>No requirements have been accepted yet.</p>";
    return;
  }
  requirements.innerHTML = data.requirements.map((requirement) => {
    const citations = (requirement.citations || []).map((citation) =>
      `<span>${escapeHtml(citation.sourceId)} · ${escapeHtml(citation.locator)}</span>`).join("<br>");
    return `<article class="requirement">
      <div class="requirement__top">
        <span class="requirement__id">${escapeHtml(requirement.id)}</span>
        <span class="requirement__state">${escapeHtml(requirement.state)}</span>
      </div>
      <p class="requirement__text">${escapeHtml(requirement.text)}</p>
      <p class="citation"><strong>Source:</strong><br>${citations}</p>
    </article>`;
  }).join("");
}

async function load() {
  renderSources();
  try {
    const response = await fetch("content/requirements.json", { cache: "no-store" });
    if (!response.ok) throw new Error("requirements unavailable");
    const data = await response.json();
    const accepted = data.state === "accepted";
    document.querySelector("#overall-state").textContent = accepted ? "Accepted requirements" : "Awaiting course acceptance";
    document.querySelector("#overall-state").className = `pill ${accepted ? "pill--accepted" : "pill--pending"}`;
    document.querySelector("#last-updated").textContent = data.lastUpdated || "—";
    const candidateCount = data.requirements?.filter((requirement) => requirement.state === "candidate").length || 0;
    document.querySelector("#source-count").textContent = `${candidateCount} candidate${candidateCount === 1 ? "" : "s"}`;
    renderRequirements(data);
  } catch (error) {
    document.querySelector("#requirements").innerHTML = "<p>Requirements are temporarily unavailable.</p>";
  }
}

load();
