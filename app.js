const STORAGE_KEY="donghua-vf-library-v1";
const $=s=>document.querySelector(s);
const $$=s=>document.querySelectorAll(s);

const libraryGrid=$("#libraryGrid");
const emptyState=$("#emptyState");
const noResultsState=$("#noResultsState");
const addDialog=$("#addDialog");
const playerDialog=$("#playerDialog");
const addForm=$("#addForm");
const searchInput=$("#searchInput");
const filterSelect=$("#filterSelect");
const sortSelect=$("#sortSelect");
const clearSearchButton=$("#clearSearchButton");
const videoPlayer=$("#videoPlayer");
const playerTitle=$("#playerTitle");
const playerEpisode=$("#playerEpisode");
const playerError=$("#playerError");

let library=loadLibrary().map(item=>({
  ...item,
  favorite:Boolean(item.favorite),
  createdAt:item.createdAt||new Date().toISOString()
}));

function loadLibrary(){
  try{
    const data=JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(data)?data:[];
  }catch{
    return [];
  }
}

function saveLibrary(){
  localStorage.setItem(STORAGE_KEY,JSON.stringify(library));
}

function normalize(value=""){
  return value.toString().normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
}

function statusLabel(status){
  return {watching:"En cours",planned:"À voir",completed:"Terminé"}[status]??"À voir";
}

function safeUrl(value){
  try{
    const url=new URL(value);
    return ["http:","https:"].includes(url.protocol)?url.href:"";
  }catch{
    return "";
  }
}

function updateStats(){
  $("#totalCount").textContent=library.length;
  $("#watchingCount").textContent=library.filter(x=>x.status==="watching").length;
  $("#completedCount").textContent=library.filter(x=>x.status==="completed").length;
  $("#favoriteCount").textContent=library.filter(x=>x.favorite).length;
}

function getFilteredLibrary(){
  const query=normalize(searchInput.value);
  const filter=filterSelect.value;
  const sort=sortSelect.value;

  let items=library.filter(item=>{
    const haystack=normalize(`${item.title} episode ${item.episode} ${statusLabel(item.status)}`);
    const queryMatch=!query||haystack.includes(query);
    const filterMatch=filter==="all"||(filter==="favorites"?item.favorite:item.status===filter);
    return queryMatch&&filterMatch;
  });

  items=[...items].sort((a,b)=>{
    if(sort==="title") return a.title.localeCompare(b.title,"fr");
    if(sort==="episode") return Number(b.episode)-Number(a.episode);
    return new Date(b.createdAt)-new Date(a.createdAt);
  });

  return items;
}

function render(){
  const items=getFilteredLibrary();
  libraryGrid.replaceChildren();

  emptyState.hidden=library.length>0;
  noResultsState.hidden=library.length===0||items.length>0;
  clearSearchButton.style.display=searchInput.value.trim()?"block":"none";
  $("#resultCount").textContent=library.length?`${items.length} résultat${items.length>1?"s":""}`:"";

  items.forEach(item=>libraryGrid.append(createCard(item)));
  updateStats();
}

function createCard(item){
  const card=document.createElement("article");
  card.className="card";

  const cover=document.createElement("div");
  cover.className="cover";

  const coverUrl=safeUrl(item.cover);
  if(coverUrl){
    const img=document.createElement("img");
    img.src=coverUrl;
    img.alt=`Couverture de ${item.title}`;
    img.loading="lazy";
    img.onerror=()=>img.replaceWith(makePlaceholder());
    cover.append(img);
  }else{
    cover.append(makePlaceholder());
  }

  const favorite=document.createElement("button");
  favorite.className=`favorite${item.favorite?" active":""}`;
  favorite.textContent=item.favorite?"♥":"♡";
  favorite.setAttribute("aria-label",item.favorite?"Retirer des favoris":"Ajouter aux favoris");
  favorite.addEventListener("click",()=>toggleFavorite(item.id));

  const play=document.createElement("button");
  play.className="play";
  play.textContent="▶";
  play.setAttribute("aria-label",`Lire ${item.title}`);
  play.addEventListener("click",()=>openPlayer(item));

  cover.append(favorite,play);

  const body=document.createElement("div");
  body.className="card-body";

  const title=document.createElement("h3");
  title.textContent=item.title;

  const meta=document.createElement("div");
  meta.className="meta";
  meta.innerHTML=`<span>Épisode ${Number(item.episode)}</span><span class="pill">${statusLabel(item.status)}</span>`;

  const actions=document.createElement("div");
  actions.className="card-actions";

  const statusButton=document.createElement("button");
  statusButton.className="status-btn";
  statusButton.textContent="Changer statut";
  statusButton.addEventListener("click",()=>cycleStatus(item.id));

  const deleteButton=document.createElement("button");
  deleteButton.className="delete-btn";
  deleteButton.textContent="Supprimer";
  deleteButton.addEventListener("click",()=>removeItem(item.id));

  actions.append(statusButton,deleteButton);
  body.append(title,meta,actions);
  card.append(cover,body);

  return card;
}

function makePlaceholder(){
  const div=document.createElement("div");
  div.className="placeholder";
  div.textContent="🐲";
  return div;
}

function toggleFavorite(id){
  library=library.map(item=>item.id===id?{...item,favorite:!item.favorite}:item);
  saveLibrary();
  render();
}

function cycleStatus(id){
  const order=["planned","watching","completed"];
  library=library.map(item=>{
    if(item.id!==id) return item;
    const next=(order.indexOf(item.status)+1)%order.length;
    return {...item,status:order[next]};
  });
  saveLibrary();
  render();
}

function removeItem(id){
  const item=library.find(x=>x.id===id);
  if(!item||!confirm(`Supprimer « ${item.title} » ?`)) return;
  library=library.filter(x=>x.id!==id);
  saveLibrary();
  render();
}

function openPlayer(item){
  playerTitle.textContent=item.title;
  playerEpisode.textContent=`Épisode ${item.episode} · ${statusLabel(item.status)}`;
  playerError.hidden=true;
  videoPlayer.src=item.videoUrl;
  playerDialog.showModal();
  videoPlayer.play().catch(()=>{});
}

function closePlayer(){
  videoPlayer.pause();
  videoPlayer.removeAttribute("src");
  videoPlayer.load();
  playerDialog.close();
}

function openAddDialog(){
  addDialog.showModal();
}

["#openAddButton","#heroAddButton","#emptyAddButton"].forEach(id=>{
  $(id).addEventListener("click",openAddDialog);
});

$("#heroFavoritesButton").addEventListener("click",()=>{
  filterSelect.value="favorites";
  updateNav("favorites");
  render();
  document.querySelector(".catalog").scrollIntoView({behavior:"smooth"});
});

$("#closeDialogButton").addEventListener("click",()=>addDialog.close());
$("#closePlayerButton").addEventListener("click",closePlayer);

searchInput.addEventListener("input",render);
filterSelect.addEventListener("change",()=>{
  updateNav(filterSelect.value);
  render();
});
sortSelect.addEventListener("change",render);

clearSearchButton.addEventListener("click",()=>{
  searchInput.value="";
  searchInput.focus();
  render();
});

$$(".nav-link").forEach(button=>{
  button.addEventListener("click",()=>{
    filterSelect.value=button.dataset.filter;
    updateNav(button.dataset.filter);
    render();
    document.querySelector(".catalog").scrollIntoView({behavior:"smooth"});
  });
});

function updateNav(filter){
  $$(".nav-link").forEach(button=>{
    button.classList.toggle("active",button.dataset.filter===filter);
  });
}

videoPlayer.addEventListener("error",()=>{
  playerError.hidden=false;
});

addForm.addEventListener("submit",event=>{
  event.preventDefault();

  const title=$("#titleInput").value.trim();
  const episode=Number($("#episodeInput").value);
  const status=$("#statusInput").value;
  const videoUrl=$("#videoInput").value.trim();
  const cover=$("#coverInput").value.trim();
  const favorite=$("#favoriteInput").checked;

  try{
    const parsed=new URL(videoUrl);
    if(!["http:","https:"].includes(parsed.protocol)) throw new Error();
  }catch{
    alert("Entre un lien vidéo HTTP ou HTTPS valide.");
    return;
  }

  library.unshift({
    id:crypto.randomUUID(),
    title,
    episode,
    status,
    videoUrl,
    cover,
    favorite,
    createdAt:new Date().toISOString()
  });

  saveLibrary();
  addForm.reset();
  $("#episodeInput").value="1";
  addDialog.close();
  render();
});

render();