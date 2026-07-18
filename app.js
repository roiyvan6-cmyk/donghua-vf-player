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
const sourceFilterSelect=$("#sourceFilterSelect");
const sortSelect=$("#sortSelect");
const clearSearchButton=$("#clearSearchButton");
const videoPlayer=$("#videoPlayer");
const youtubeContainer=$("#youtubePlayerContainer");
const playerTitle=$("#playerTitle");
const playerEpisode=$("#playerEpisode");
const playerError=$("#playerError");
const progressLabel=$("#progressLabel");
const markWatchedButton=$("#markWatchedButton");

let activeItemId=null;
let localObjectUrls=new Map();

let library=loadLibrary().map(item=>({
  ...item,
  sourceType:item.sourceType||"direct",
  favorite:Boolean(item.favorite),
  progress:Number(item.progress||0),
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

function sourceLabel(type){
  return {youtube:"YouTube",direct:"Lien direct",embed:"Autre plateforme",local:"Fichier iPhone"}[type]??"Vidéo";
}

function safeHttpUrl(value){
  try{
    const url=new URL(value);
    return ["http:","https:"].includes(url.protocol)?url.href:"";
  }catch{
    return "";
  }
}

function parseYouTube(url){
  try{
    const parsed=new URL(url);
    const host=parsed.hostname.replace("www.","");
    let videoId="";
    let playlistId=parsed.searchParams.get("list")||"";

    if(host==="youtu.be"){
      videoId=parsed.pathname.split("/").filter(Boolean)[0]||"";
    }else if(host.includes("youtube.com")){
      if(parsed.pathname==="/watch") videoId=parsed.searchParams.get("v")||"";
      if(parsed.pathname.startsWith("/shorts/")) videoId=parsed.pathname.split("/")[2]||"";
      if(parsed.pathname.startsWith("/embed/")) videoId=parsed.pathname.split("/")[2]||"";
    }

    if(playlistId){
      return {
        kind:"playlist",
        id:playlistId,
        embed:`https://www.youtube-nocookie.com/embed/videoseries?list=${encodeURIComponent(playlistId)}&rel=0&hl=fr&cc_lang_pref=fr&cc_load_policy=1`
      };
    }

    if(videoId){
      return {
        kind:"video",
        id:videoId,
        embed:`https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?rel=0&enablejsapi=1&hl=fr&cc_lang_pref=fr&cc_load_policy=1`
      };
    }

    return null;
  }catch{
    return null;
  }
}

function updateStats(){
  $("#totalCount").textContent=library.length;
  $("#watchingCount").textContent=library.filter(x=>x.status==="watching").length;
  $("#completedCount").textContent=library.filter(x=>x.status==="completed").length;
  $("#favoriteCount").textContent=library.filter(x=>x.favorite).length;
}

function filteredLibrary(){
  const query=normalize(searchInput.value);
  const filter=filterSelect.value;
  const sourceFilter=sourceFilterSelect.value;
  const sort=sortSelect.value;

  let items=library.filter(item=>{
    const haystack=normalize(`${item.title} episode ${item.episode} ${statusLabel(item.status)} ${sourceLabel(item.sourceType)}`);
    const queryMatch=!query||haystack.includes(query);
    const filterMatch=filter==="all"||(filter==="favorites"?item.favorite:item.status===filter);
    const sourceMatch=sourceFilter==="all"||item.sourceType===sourceFilter;
    return queryMatch&&filterMatch&&sourceMatch;
  });

  items=[...items].sort((a,b)=>{
    if(sort==="title") return a.title.localeCompare(b.title,"fr");
    if(sort==="episode"){
      const firstNumber=value=>{
        const match=String(value??"").match(/\d+(?:[.,]\d+)?/);
        return match?Number(match[0].replace(",",".")):0;
      };
      return firstNumber(b.episode)-firstNumber(a.episode);
    }
    return new Date(b.createdAt)-new Date(a.createdAt);
  });

  return items;
}

function render(){
  const items=filteredLibrary();
  libraryGrid.replaceChildren();

  emptyState.hidden=library.length>0;
  noResultsState.hidden=library.length===0||items.length>0;
  clearSearchButton.style.display=searchInput.value.trim()?"block":"none";
  $("#resultCount").textContent=library.length?`${items.length} résultat${items.length>1?"s":""}`:"";

  items.forEach(item=>libraryGrid.append(createCard(item)));
  updateStats();
  renderContinue();
}

function renderContinue(){
  const items=library.filter(x=>x.progress>0&&x.progress<100).sort((a,b)=>b.progress-a.progress).slice(0,8);
  const section=$("#continueSection");
  const grid=$("#continueGrid");
  grid.replaceChildren();
  section.hidden=items.length===0;

  items.forEach(item=>{
    const card=document.createElement("article");
    card.className="continue-card";
    card.innerHTML=`
      <span class="eyebrow">${sourceLabel(item.sourceType).toUpperCase()}</span>
      <h3>${escapeHtml(item.title)}</h3>
      <div class="progress-track"><div class="progress-fill" style="width:${Math.min(100,item.progress)}%"></div></div>
      <p>${Math.round(item.progress)} % regardé</p>
    `;
    const button=document.createElement("button");
    button.className="primary";
    button.textContent="Continuer";
    button.addEventListener("click",()=>openPlayer(item));
    card.append(button);
    grid.append(card);
  });
}

function createCard(item){
  const card=document.createElement("article");
  card.className="card";

  const cover=document.createElement("div");
  cover.className="cover";

  const coverUrl=safeHttpUrl(item.cover);
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

  const sourceBadge=document.createElement("span");
  sourceBadge.className="source-badge";
  sourceBadge.textContent=sourceLabel(item.sourceType);

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

  cover.append(sourceBadge,favorite,play);

  const body=document.createElement("div");
  body.className="card-body";

  const title=document.createElement("h3");
  title.textContent=item.title;

  const meta=document.createElement("div");
  meta.className="meta";
  meta.innerHTML=`<span>${escapeHtml(String(item.episode))}</span><span class="pill">${statusLabel(item.status)}</span>`;

  const progress=document.createElement("div");
  progress.className="progress-track";
  progress.innerHTML=`<div class="progress-fill" style="width:${Math.min(100,item.progress)}%"></div>`;

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
  body.append(title,meta,progress,actions);
  card.append(cover,body);

  return card;
}

function makePlaceholder(){
  const div=document.createElement("div");
  div.className="placeholder";
  div.textContent="🌙";
  return div;
}

function escapeHtml(text){
  const div=document.createElement("div");
  div.textContent=text;
  return div.innerHTML;
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
  activeItemId=item.id;
  playerTitle.textContent=item.title;
  playerEpisode.textContent=`${item.episode} · ${statusLabel(item.status)} · ${sourceLabel(item.sourceType)}`;
  progressLabel.textContent=`Progression : ${Math.round(item.progress||0)} %`;
  playerError.hidden=true;

  youtubeContainer.hidden=true;
  youtubeContainer.replaceChildren();
  videoPlayer.hidden=true;
  videoPlayer.pause();
  videoPlayer.removeAttribute("src");

  if(item.sourceType==="youtube"||item.sourceType==="embed"){
    const embedUrl=item.sourceType==="youtube" ? (parseYouTube(item.sourceUrl)?.embed||"") : safeHttpUrl(item.sourceUrl);
    if(!embedUrl){
      playerError.hidden=false;
    }else{
      const iframe=document.createElement("iframe");
      iframe.src=embedUrl;
      iframe.title=item.title;
      iframe.allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen";
      iframe.referrerPolicy="strict-origin-when-cross-origin";
      iframe.allowFullscreen=true;
      youtubeContainer.append(iframe);
      youtubeContainer.hidden=false;
    }
  }else{
    let src=item.sourceUrl;
    if(item.sourceType==="local"){
      src=localObjectUrls.get(item.id)||"";
    }
    if(!src){
      playerError.hidden=false;
    }else{
      videoPlayer.src=src;
      videoPlayer.querySelectorAll("track").forEach(track=>track.remove());
      if(item.subtitleData){
        const track=document.createElement("track");
        track.kind="subtitles";
        track.label="Français";
        track.srclang="fr";
        track.src=item.subtitleData;
        track.default=true;
        videoPlayer.append(track);
      }
      videoPlayer.hidden=false;
      videoPlayer.load();
      videoPlayer.currentTime=0;
      videoPlayer.play().catch(()=>{});
    }
  }

  playerDialog.showModal();
}

function closePlayer(){
  if(!videoPlayer.hidden&&videoPlayer.duration){
    updateProgressFromVideo();
  }
  videoPlayer.pause();
  videoPlayer.removeAttribute("src");
  videoPlayer.load();
  youtubeContainer.replaceChildren();
  playerDialog.close();
  activeItemId=null;
}

function updateProgressFromVideo(){
  if(!activeItemId||!videoPlayer.duration) return;
  const progress=Math.min(100,(videoPlayer.currentTime/videoPlayer.duration)*100);
  library=library.map(item=>item.id===activeItemId?{...item,progress}:item);
  saveLibrary();
  progressLabel.textContent=`Progression : ${Math.round(progress)} %`;
}

function openAddDialog(){
  addDialog.showModal();
}

function switchSource(type){
  $("#sourceTypeInput").value=type;
  $$(".source-tab").forEach(button=>button.classList.toggle("active",button.dataset.source===type));
  $("#youtubeFields").hidden=type!=="youtube";
  $("#directFields").hidden=type!=="direct";
  $("#embedFields").hidden=type!=="embed";
  $("#localFields").hidden=type!=="local";
  $("#subtitleFields").hidden=!["direct","local"].includes(type);
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

$$(".source-tab").forEach(button=>{
  button.addEventListener("click",()=>switchSource(button.dataset.source));
});

searchInput.addEventListener("input",render);
filterSelect.addEventListener("change",()=>{
  updateNav(filterSelect.value);
  render();
});
sourceFilterSelect.addEventListener("change",render);
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

videoPlayer.addEventListener("timeupdate",()=>{
  if(!videoPlayer.duration) return;
  const progress=(videoPlayer.currentTime/videoPlayer.duration)*100;
  progressLabel.textContent=`Progression : ${Math.round(progress)} %`;
});

videoPlayer.addEventListener("pause",updateProgressFromVideo);
videoPlayer.addEventListener("ended",()=>{
  if(!activeItemId) return;
  library=library.map(item=>item.id===activeItemId?{...item,progress:100,status:"completed"}:item);
  saveLibrary();
  render();
});

videoPlayer.addEventListener("error",()=>{
  playerError.hidden=false;
});

markWatchedButton.addEventListener("click",()=>{
  if(!activeItemId) return;
  library=library.map(item=>item.id===activeItemId?{...item,progress:100,status:"completed"}:item);
  saveLibrary();
  progressLabel.textContent="Progression : 100 %";
  render();
});


let uploadedCoverData="";

function readFileAsText(file){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(String(reader.result||""));
    reader.onerror=()=>reject(new Error("Lecture impossible"));
    reader.readAsText(file);
  });
}

function imageFileToCompressedDataUrl(file){
  return new Promise((resolve,reject)=>{
    if(!file.type.startsWith("image/")){
      reject(new Error("Le fichier choisi n’est pas une image."));
      return;
    }
    const reader=new FileReader();
    reader.onload=()=>{
      const img=new Image();
      img.onload=()=>{
        const maxWidth=900;
        const scale=Math.min(1,maxWidth/img.width);
        const canvas=document.createElement("canvas");
        canvas.width=Math.max(1,Math.round(img.width*scale));
        canvas.height=Math.max(1,Math.round(img.height*scale));
        const ctx=canvas.getContext("2d");
        ctx.drawImage(img,0,0,canvas.width,canvas.height);
        resolve(canvas.toDataURL("image/jpeg",.82));
      };
      img.onerror=()=>reject(new Error("Cette image ne peut pas être ouverte."));
      img.src=String(reader.result);
    };
    reader.onerror=()=>reject(new Error("Lecture de l’image impossible."));
    reader.readAsDataURL(file);
  });
}

$("#coverFileInput").addEventListener("change",async event=>{
  const file=event.target.files[0];
  if(!file) return;
  try{
    uploadedCoverData=await imageFileToCompressedDataUrl(file);
    $("#coverPreviewImage").src=uploadedCoverData;
    $("#coverPreview").hidden=false;
  }catch(error){
    alert(error.message);
    event.target.value="";
  }
});

$("#removeCoverButton").addEventListener("click",()=>{
  uploadedCoverData="";
  $("#coverFileInput").value="";
  $("#coverPreviewImage").removeAttribute("src");
  $("#coverPreview").hidden=true;
});

addForm.addEventListener("submit",async event=>{
  event.preventDefault();

  const title=$("#titleInput").value.trim();
  const episode=$("#episodeInput").value.trim();
  const status=$("#statusInput").value;
  const cover=uploadedCoverData||$("#coverInput").value.trim();
  const favorite=$("#favoriteInput").checked;
  const sourceType=$("#sourceTypeInput").value;

  let sourceUrl="";
  let localFile=null;

  if(sourceType==="youtube"){
    sourceUrl=$("#youtubeInput").value.trim();
    if(!parseYouTube(sourceUrl)){
      alert("Entre un lien YouTube ou une playlist valide.");
      return;
    }
  }

  if(sourceType==="direct"){
    sourceUrl=$("#directInput").value.trim();
    if(!safeHttpUrl(sourceUrl)){
      alert("Entre un lien vidéo HTTP ou HTTPS valide.");
      return;
    }
  }

  if(sourceType==="embed"){
    sourceUrl=$("#embedInput").value.trim();
    if(!safeHttpUrl(sourceUrl)){
      alert("Entre une URL d’intégration HTTP ou HTTPS valide.");
      return;
    }
  }

  if(sourceType==="local"){
    localFile=$("#localInput").files[0];
    if(!localFile){
      alert("Choisis un fichier vidéo.");
      return;
    }
  }

  let subtitleData="";
  const subtitleFile=$("#subtitleFileInput").files[0];
  if(subtitleFile){
    try{
      const subtitleText=await readFileAsText(subtitleFile);
      if(!subtitleText.trim().startsWith("WEBVTT")){
        alert("Le fichier de sous-titres doit être au format WebVTT (.vtt).");
        return;
      }
      subtitleData=`data:text/vtt;charset=utf-8,${encodeURIComponent(subtitleText)}`;
    }catch{
      alert("Impossible de lire le fichier de sous-titres.");
      return;
    }
  }

  const id=crypto.randomUUID();

  if(localFile){
    const objectUrl=URL.createObjectURL(localFile);
    localObjectUrls.set(id,objectUrl);
    sourceUrl=`local:${localFile.name}`;
  }

  library.unshift({
    id,
    title,
    episode,
    status,
    sourceType,
    sourceUrl,
    cover,
    favorite,
    progress:0,
    subtitleData,
    createdAt:new Date().toISOString()
  });

  saveLibrary();
  addForm.reset();
  uploadedCoverData="";
  $("#coverPreviewImage").removeAttribute("src");
  $("#coverPreview").hidden=true;
  $("#episodeInput").value="1";
  switchSource("youtube");
  addDialog.close();
  render();
});

render();