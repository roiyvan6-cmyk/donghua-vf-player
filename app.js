const STORAGE_KEY = "donghua-vf-library-v1";

const libraryGrid = document.querySelector("#libraryGrid");
const emptyState = document.querySelector("#emptyState");
const addDialog = document.querySelector("#addDialog");
const playerDialog = document.querySelector("#playerDialog");
const addForm = document.querySelector("#addForm");
const searchInput = document.querySelector("#searchInput");
const filterSelect = document.querySelector("#filterSelect");
const videoPlayer = document.querySelector("#videoPlayer");
const playerTitle = document.querySelector("#playerTitle");
const playerEpisode = document.querySelector("#playerEpisode");
const playerError = document.querySelector("#playerError");

let library = loadLibrary();

function loadLibrary() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function saveLibrary() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(library));
}

function statusLabel(status) {
  return {
    watching: "En cours",
    planned: "À voir",
    completed: "Terminé"
  }[status] ?? "À voir";
}

function safeImageUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function renderLibrary() {
  const query = searchInput.value.trim().toLowerCase();
  const filter = filterSelect.value;

  const filtered = library.filter(item => {
    const matchesQuery = item.title.toLowerCase().includes(query);
    const matchesFilter = filter === "all" || item.status === filter;
    return matchesQuery && matchesFilter;
  });

  libraryGrid.replaceChildren();
  emptyState.hidden = library.length > 0;

  filtered.forEach(item => {
    const card = document.createElement("article");
    card.className = "card";

    const cover = document.createElement("div");
    cover.className = "cover";

    const imageUrl = safeImageUrl(item.cover);
    if (imageUrl) {
      const image = document.createElement("img");
      image.src = imageUrl;
      image.alt = `Couverture de ${item.title}`;
      image.loading = "lazy";
      image.onerror = () => {
        image.replaceWith(makePlaceholder());
      };
      cover.append(image);
    } else {
      cover.append(makePlaceholder());
    }

    const playButton = document.createElement("button");
    playButton.className = "play-button";
    playButton.type = "button";
    playButton.setAttribute("aria-label", `Lire ${item.title}`);
    playButton.textContent = "▶";
    playButton.addEventListener("click", () => openPlayer(item));
    cover.append(playButton);

    const content = document.createElement("div");
    content.className = "card-content";

    const title = document.createElement("h3");
    title.textContent = item.title;

    const meta = document.createElement("div");
    meta.className = "card-meta";
    meta.innerHTML = `
      <span>Épisode ${Number(item.episode)}</span>
      <span class="status">${statusLabel(item.status)}</span>
    `;

    const actions = document.createElement("div");
    actions.className = "card-actions";

    const statusButton = document.createElement("button");
    statusButton.className = "secondary-button";
    statusButton.type = "button";
    statusButton.textContent = "Changer statut";
    statusButton.addEventListener("click", () => cycleStatus(item.id));

    const deleteButton = document.createElement("button");
    deleteButton.className = "danger-button";
    deleteButton.type = "button";
    deleteButton.textContent = "Supprimer";
    deleteButton.addEventListener("click", () => removeItem(item.id));

    actions.append(statusButton, deleteButton);
    content.append(title, meta, actions);
    card.append(cover, content);
    libraryGrid.append(card);
  });
}

function makePlaceholder() {
  const placeholder = document.createElement("div");
  placeholder.className = "cover-placeholder";
  placeholder.textContent = "🐲";
  return placeholder;
}

function openPlayer(item) {
  playerTitle.textContent = item.title;
  playerEpisode.textContent = `Épisode ${item.episode} · ${statusLabel(item.status)}`;
  playerError.hidden = true;
  videoPlayer.src = item.videoUrl;
  playerDialog.showModal();
  videoPlayer.play().catch(() => {});
}

function closePlayer() {
  videoPlayer.pause();
  videoPlayer.removeAttribute("src");
  videoPlayer.load();
  playerDialog.close();
}

function cycleStatus(id) {
  const order = ["planned", "watching", "completed"];
  library = library.map(item => {
    if (item.id !== id) return item;
    const nextIndex = (order.indexOf(item.status) + 1) % order.length;
    return { ...item, status: order[nextIndex] };
  });
  saveLibrary();
  renderLibrary();
}

function removeItem(id) {
  const item = library.find(entry => entry.id === id);
  if (!item || !confirm(`Supprimer « ${item.title} » ?`)) return;
  library = library.filter(entry => entry.id !== id);
  saveLibrary();
  renderLibrary();
}

function openAddDialog() {
  addDialog.showModal();
}

document.querySelector("#openAddButton").addEventListener("click", openAddDialog);
document.querySelector("#emptyAddButton").addEventListener("click", openAddDialog);
document.querySelector("#closeDialogButton").addEventListener("click", () => addDialog.close());
document.querySelector("#closePlayerButton").addEventListener("click", closePlayer);

searchInput.addEventListener("input", renderLibrary);
filterSelect.addEventListener("change", renderLibrary);

videoPlayer.addEventListener("error", () => {
  playerError.hidden = false;
});

addForm.addEventListener("submit", event => {
  event.preventDefault();

  const title = document.querySelector("#titleInput").value.trim();
  const episode = Number(document.querySelector("#episodeInput").value);
  const videoUrl = document.querySelector("#videoInput").value.trim();
  const cover = document.querySelector("#coverInput").value.trim();
  const status = document.querySelector("#statusInput").value;

  try {
    const parsed = new URL(videoUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error();
  } catch {
    alert("Entre un lien vidéo HTTP ou HTTPS valide.");
    return;
  }

  library.unshift({
    id: crypto.randomUUID(),
    title,
    episode,
    videoUrl,
    cover,
    status,
    createdAt: new Date().toISOString()
  });

  saveLibrary();
  addForm.reset();
  document.querySelector("#episodeInput").value = "1";
  addDialog.close();
  renderLibrary();
});

renderLibrary();
