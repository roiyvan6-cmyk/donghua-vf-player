const STORAGE_KEY="donghua-vf-series-v5";
const LEGACY_KEY="donghua-vf-library-v1";
const $=s=>document.querySelector(s);
const $$=s=>document.querySelectorAll(s);

let seriesLibrary=loadData();
let activeSeriesId=null;
let activeEpisodeId=null;
let uploadedSeriesCover="";
const localVideoUrls=new Map();

function uid(){
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function loadData(){
  try{
    const saved=JSON.parse(localStorage.getItem(STORAGE_KEY));
    if(Array.isArray(saved)) return saved;
  }catch{}

  try{
    const legacy=JSON.parse(localStorage.getItem(LEGACY_KEY));
    if(Array.isArray(legacy)&&legacy.length){
      const grouped=new Map();
      legacy.forEach(item=>{
        const key=(item.title||"Sans titre").trim().toLowerCase();
        if(!grouped.has(key)){
          grouped.set(key,{
            id:uid(),
            title:item.title||"Sans titre",
            synopsis:"",
            status:item.status||"watching",
            favorite:Boolean(item.favorite),
            cover:item.cover||"",
            createdAt:item.createdAt||new Date().toISOString(),
            episodes:[]
          });
        }
        grouped.get(key).episodes.push({
          id:uid(),
          label:String(item.episode||"Épisode"),
          sourceType:item.sourceType||"direct",
          sourceUrl:item.sourceUrl||"",
          subtitleData:item.subtitleData||"",
          watched:item.status==="completed"||Number(item.progress||0)>=100,
          progress:Number(item.progress||0),
          createdAt:item.createdAt||new Date().toISOString()
        });
      });
      const migrated=[...grouped.values()];
      localStorage.setItem(STORAGE_KEY,JSON.stringify(migrated));
      return migrated;
    }
  }catch{}

  return [];
}

function save(){
  localStorage.setItem(STORAGE_KEY,JSON.stringify(seriesLibrary));
}

function normalize(value=""){
  return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
}

function escapeHtml(text){
  const div=document.createElement("div");
  div.textContent=String(text);
  return div.innerHTML;
}

function safeHttpUrl(value){
  try{
    const url=new URL(value);
    return ["http:","https:"].includes(url.protocol)?url.href:"";
  }catch{
    return "";
  }
}

function statusLabel(status){
  return {watching:"En cours",planned:"À voir",completed:"Terminé"}[status]||"À voir";
}

function sourceLabel(type){
  return {youtube:"YouTube",direct:"Lien direct",embed:"Autre plateforme",local:"Fichier iPhone"}[type]||"Vidéo";
}

function parseYouTube(url){
  try{
    const parsed=new URL(url);
    const host=parsed.hostname.replace("www.","");
    let videoId="";
    const playlistId=parsed.searchParams.get("list")||"";

    if(host==="youtu.be") videoId=parsed.pathname.split("/").filter(Boolean)[0]||"";
    if(host.includes("youtube.com")){
      if(parsed.pathname==="/watch") videoId=parsed.searchParams.get("v")||"";
      if(parsed.pathname.startsWith("/shorts/")) videoId=parsed.pathname.split("/")[2]||"";
      if(parsed.pathname.startsWith("/embed/")) videoId=parsed.pathname.split("/")[2]||"";
    }

    if(playlistId){
      return `https://www.youtube-nocookie.com/embed/videoseries?list=${encodeURIComponent(playlistId)}&rel=0&hl=fr&cc_lang_pref=fr&cc_load_policy=1`;
    }
    if(videoId){
      return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?rel=0&hl=fr&cc_lang_pref=fr&cc_load_policy=1`;
    }
    return "";
  }catch{
    return "";
  }
}

function currentSeries(){
  return seriesLibrary.find(item=>item.id===activeSeriesId);
}

function updateStats(){
  $("#seriesCount").textContent=seriesLibrary.length;
  $("#episodeCount").textContent=seriesLibrary.reduce((sum,item)=>sum+item.episodes.length,0);
  $("#watchingCount").textContent=seriesLibrary.filter(item=>item.status==="watching").length;
  $("#favoriteCount").textContent=seriesLibrary.filter(item=>item.favorite).length;
}

function filteredSeries(){
  const query=normalize($("#searchInput").value);
  const filter=$("#filterSelect").value;
  const sort=$("#sortSelect").value;

  let items=seriesLibrary.filter(item=>{
    const queryMatch=!query||normalize(`${item.title} ${item.synopsis}`).includes(query);
    const filterMatch=filter==="all"||(filter==="favorites"?item.favorite:item.status===filter);
    return queryMatch&&filterMatch;
  });

  return items.sort((a,b)=>{
    if(sort==="title") return a.title.localeCompare(b.title,"fr");
    if(sort==="episodes") return b.episodes.length-a.episodes.length;
    return new Date(b.createdAt)-new Date(a.createdAt);
  });
}

function renderHome(){
  const items=filteredSeries();
  const grid=$("#seriesGrid");
  grid.replaceChildren();

  $("#emptyState").hidden=seriesLibrary.length>0;
  $("#noResultsState").hidden=seriesLibrary.length===0||items.length>0;
  $("#resultCount").textContent=seriesLibrary.length?`${items.length} résultat${items.length>1?"s":""}`:"";
  $("#clearSearchButton").style.display=$("#searchInput").value.trim()?"block":"none";

  items.forEach(item=>grid.append(createSeriesCard(item)));
  updateStats();
}

function createSeriesCard(item){
  const card=document.createElement("article");
  card.className="series-card";

  const cover=document.createElement("div");
  cover.className="series-cover";
  if(item.cover){
    const img=document.createElement("img");
    img.src=item.cover;
    img.alt=`Couverture de ${item.title}`;
    img.onerror=()=>img.replaceWith(makePlaceholder());
    cover.append(img);
  }else{
    cover.append(makePlaceholder());
  }

  const favorite=document.createElement("button");
  favorite.className=`favorite-button${item.favorite?" active":""}`;
  favorite.textContent=item.favorite?"♥":"♡";
  favorite.addEventListener("click",event=>{
    event.stopPropagation();
    item.favorite=!item.favorite;
    save();
    renderHome();
  });
  cover.append(favorite);

  const body=document.createElement("div");
  body.className="series-body";
  body.innerHTML=`
    <h3>${escapeHtml(item.title)}</h3>
    <div class="series-meta">
      <span>${item.episodes.length} épisode${item.episodes.length>1?"s":""}</span>
      <span class="pill">${statusLabel(item.status)}</span>
    </div>
  `;

  const open=document.createElement("button");
  open.className="primary open-series-button";
  open.textContent="Voir la fiche";
  open.addEventListener("click",()=>openSeriesDetail(item.id));

  body.append(open);
  card.append(cover,body);
  return card;
}

function makePlaceholder(){
  const div=document.createElement("div");
  div.className="placeholder";
  div.textContent="🌙";
  return div;
}

function openSeriesDetail(id){
  activeSeriesId=id;
  const item=currentSeries();
  if(!item) return;

  $("#homeView").hidden=true;
  $("#detailView").hidden=false;
  window.scrollTo({top:0,behavior:"smooth"});
  renderDetail();
}

function renderDetail(){
  const item=currentSeries();
  if(!item) return;

  $("#detailTitle").textContent=item.title;
  $("#detailSynopsis").textContent=item.synopsis||"Aucun synopsis pour le moment.";
  $("#detailStatus").textContent=statusLabel(item.status);
  $("#detailEpisodeCount").textContent=`${item.episodes.length} épisode${item.episodes.length>1?"s":""}`;
  $("#toggleSeriesFavoriteButton").textContent=item.favorite?"♥ Favori":"♡ Favori";

  const image=$("#detailCover");
  const placeholder=$("#detailCoverPlaceholder");
  if(item.cover){
    image.src=item.cover;
    image.alt=`Couverture de ${item.title}`;
    image.hidden=false;
    placeholder.hidden=true;
    image.onerror=()=>{
      image.hidden=true;
      placeholder.hidden=false;
    };
  }else{
    image.hidden=true;
    placeholder.hidden=false;
  }

  const list=$("#episodeList");
  list.replaceChildren();
  $("#episodeEmptyState").hidden=item.episodes.length>0;

  item.episodes.forEach((episode,index)=>{
    list.append(createEpisodeRow(item,episode,index));
  });
}

function createEpisodeRow(series,episode,index){
  const row=document.createElement("article");
  row.className="episode-row";

  const main=document.createElement("div");
  main.className="episode-main";
  main.innerHTML=`
    <div class="episode-number">${index+1}</div>
    <div class="episode-text">
      <h3>${escapeHtml(episode.label)}</h3>
      <p>${sourceLabel(episode.sourceType)} ${episode.watched?'<span class="watched-badge">• Regardé</span>':""}</p>
    </div>
  `;

  const play=document.createElement("button");
  play.className="primary";
  play.textContent="▶ Lire";
  play.addEventListener("click",()=>openPlayer(series.id,episode.id));

  const actions=document.createElement("div");
  actions.className="episode-actions";

  const watched=document.createElement("button");
  watched.className="secondary";
  watched.textContent=episode.watched?"Non regardé":"Vu";
  watched.addEventListener("click",()=>{
    episode.watched=!episode.watched;
    episode.progress=episode.watched?100:0;
    save();
    renderDetail();
    renderHome();
  });

  const remove=document.createElement("button");
  remove.className="danger";
  remove.textContent="Supprimer";
  remove.addEventListener("click",()=>{
    if(!confirm(`Supprimer « ${episode.label} » ?`)) return;
    series.episodes=series.episodes.filter(item=>item.id!==episode.id);
    save();
    renderDetail();
    renderHome();
  });

  actions.append(watched,remove);
  row.append(main,play,actions);
  return row;
}

function showHome(){
  activeSeriesId=null;
  $("#detailView").hidden=true;
  $("#homeView").hidden=false;
  renderHome();
  window.scrollTo({top:0,behavior:"smooth"});
}

function openSeriesDialog(editing=false){
  const form=$("#seriesForm");
  form.reset();
  uploadedSeriesCover="";
  $("#seriesCoverPreview").hidden=true;
  $("#seriesCoverPreviewImage").removeAttribute("src");

  if(editing){
    const item=currentSeries();
    if(!item) return;
    $("#seriesDialogTitle").textContent="Modifier le donghua";
    $("#editingSeriesId").value=item.id;
    $("#seriesTitleInput").value=item.title;
    $("#seriesSynopsisInput").value=item.synopsis||"";
    $("#seriesStatusInput").value=item.status;
    $("#seriesCoverUrlInput").value=item.cover&&item.cover.startsWith("http")?item.cover:"";
    $("#seriesFavoriteInput").checked=item.favorite;
    if(item.cover&&!item.cover.startsWith("http")){
      uploadedSeriesCover=item.cover;
      $("#seriesCoverPreviewImage").src=item.cover;
      $("#seriesCoverPreview").hidden=false;
    }
  }else{
    $("#seriesDialogTitle").textContent="Nouveau donghua";
    $("#editingSeriesId").value="";
  }

  $("#seriesDialog").showModal();
}

function switchEpisodeSource(type){
  $("#episodeSourceTypeInput").value=type;
  $$(".source-tab").forEach(button=>button.classList.toggle("active",button.dataset.source===type));
  $("#youtubeFields").hidden=type!=="youtube";
  $("#directFields").hidden=type!=="direct";
  $("#embedFields").hidden=type!=="embed";
  $("#localFields").hidden=type!=="local";
  $("#subtitleFields").hidden=!["direct","local"].includes(type);
}

function readFileAsText(file){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(String(reader.result||""));
    reader.onerror=reject;
    reader.readAsText(file);
  });
}

function compressImage(file){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>{
      const img=new Image();
      img.onload=()=>{
        const maxWidth=900;
        const scale=Math.min(1,maxWidth/img.width);
        const canvas=document.createElement("canvas");
        canvas.width=Math.max(1,Math.round(img.width*scale));
        canvas.height=Math.max(1,Math.round(img.height*scale));
        canvas.getContext("2d").drawImage(img,0,0,canvas.width,canvas.height);
        resolve(canvas.toDataURL("image/jpeg",.82));
      };
      img.onerror=reject;
      img.src=String(reader.result);
    };
    reader.onerror=reject;
    reader.readAsDataURL(file);
  });
}

function openPlayer(seriesId,episodeId){
  activeSeriesId=seriesId;
  activeEpisodeId=episodeId;

  const series=seriesLibrary.find(item=>item.id===seriesId);
  const episode=series?.episodes.find(item=>item.id===episodeId);
  if(!series||!episode) return;

  $("#playerSeriesTitle").textContent=series.title;
  $("#playerEpisodeLabel").textContent=episode.label;
  $("#playerError").hidden=true;
  $("#progressLabel").textContent=`Progression : ${Math.round(episode.progress||0)} %`;

  const iframeContainer=$("#iframePlayerContainer");
  const video=$("#videoPlayer");
  iframeContainer.replaceChildren();
  iframeContainer.hidden=true;
  video.pause();
  video.removeAttribute("src");
  video.querySelectorAll("track").forEach(track=>track.remove());
  video.hidden=true;

  if(episode.sourceType==="youtube"||episode.sourceType==="embed"){
    const src=episode.sourceType==="youtube"?parseYouTube(episode.sourceUrl):safeHttpUrl(episode.sourceUrl);
    if(!src){
      $("#playerError").hidden=false;
    }else{
      const iframe=document.createElement("iframe");
      iframe.src=src;
      iframe.title=`${series.title} — ${episode.label}`;
      iframe.allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen";
      iframe.allowFullscreen=true;
      iframeContainer.append(iframe);
      iframeContainer.hidden=false;
    }
  }else{
    let src=episode.sourceUrl;
    if(episode.sourceType==="local") src=localVideoUrls.get(episode.id)||"";
    if(!src){
      $("#playerError").hidden=false;
    }else{
      video.src=src;
      if(episode.subtitleData){
        const track=document.createElement("track");
        track.kind="subtitles";
        track.label="Français";
        track.srclang="fr";
        track.src=episode.subtitleData;
        track.default=true;
        video.append(track);
      }
      video.hidden=false;
      video.load();
      video.play().catch(()=>{});
    }
  }

  const index=series.episodes.findIndex(item=>item.id===episode.id);
  $("#previousEpisodeButton").disabled=index<=0;
  $("#nextEpisodeButton").disabled=index>=series.episodes.length-1;

  $("#playerDialog").showModal();
}

function updateVideoProgress(){
  const series=currentSeries();
  const episode=series?.episodes.find(item=>item.id===activeEpisodeId);
  const video=$("#videoPlayer");
  if(!episode||!video.duration) return;
  episode.progress=Math.min(100,(video.currentTime/video.duration)*100);
  if(episode.progress>=98) episode.watched=true;
  save();
  $("#progressLabel").textContent=`Progression : ${Math.round(episode.progress)} %`;
}

function closePlayer(){
  updateVideoProgress();
  const video=$("#videoPlayer");
  video.pause();
  video.removeAttribute("src");
  video.load();
  $("#iframePlayerContainer").replaceChildren();
  $("#playerDialog").close();
  renderDetail();
  renderHome();
}

function moveEpisode(direction){
  const series=currentSeries();
  if(!series) return;
  const index=series.episodes.findIndex(item=>item.id===activeEpisodeId);
  const target=series.episodes[index+direction];
  if(!target) return;
  closePlayer();
  setTimeout(()=>openPlayer(series.id,target.id),50);
}

$("#homeLogo").addEventListener("click",showHome);
$("#backToLibraryButton").addEventListener("click",showHome);
["#openSeriesButton","#heroSeriesButton","#emptySeriesButton"].forEach(selector=>{
  $(selector).addEventListener("click",()=>openSeriesDialog(false));
});

$("#heroFavoritesButton").addEventListener("click",()=>{
  $("#filterSelect").value="favorites";
  updateNav("favorites");
  renderHome();
  document.querySelector(".catalog").scrollIntoView({behavior:"smooth"});
});

$$(".nav-link").forEach(button=>{
  button.addEventListener("click",()=>{
    showHome();
    $("#filterSelect").value=button.dataset.filter;
    updateNav(button.dataset.filter);
    renderHome();
  });
});

function updateNav(filter){
  $$(".nav-link").forEach(button=>button.classList.toggle("active",button.dataset.filter===filter));
}

$("#searchInput").addEventListener("input",renderHome);
$("#filterSelect").addEventListener("change",()=>{
  updateNav($("#filterSelect").value);
  renderHome();
});
$("#sortSelect").addEventListener("change",renderHome);
$("#clearSearchButton").addEventListener("click",()=>{
  $("#searchInput").value="";
  renderHome();
  $("#searchInput").focus();
});

$("#closeSeriesDialogButton").addEventListener("click",()=>$("#seriesDialog").close());
$("#closeEpisodeDialogButton").addEventListener("click",()=>$("#episodeDialog").close());
$("#closePlayerButton").addEventListener("click",closePlayer);

$("#seriesCoverFileInput").addEventListener("change",async event=>{
  const file=event.target.files[0];
  if(!file) return;
  try{
    uploadedSeriesCover=await compressImage(file);
    $("#seriesCoverPreviewImage").src=uploadedSeriesCover;
    $("#seriesCoverPreview").hidden=false;
  }catch{
    alert("Impossible de lire cette image.");
  }
});

$("#removeSeriesCoverButton").addEventListener("click",()=>{
  uploadedSeriesCover="";
  $("#seriesCoverFileInput").value="";
  $("#seriesCoverPreview").hidden=true;
});

$("#seriesForm").addEventListener("submit",event=>{
  event.preventDefault();
  const editingId=$("#editingSeriesId").value;
  const data={
    title:$("#seriesTitleInput").value.trim(),
    synopsis:$("#seriesSynopsisInput").value.trim(),
    status:$("#seriesStatusInput").value,
    favorite:$("#seriesFavoriteInput").checked,
    cover:uploadedSeriesCover||$("#seriesCoverUrlInput").value.trim()
  };

  if(editingId){
    const item=seriesLibrary.find(series=>series.id===editingId);
    Object.assign(item,data);
  }else{
    seriesLibrary.unshift({
      id:uid(),
      ...data,
      createdAt:new Date().toISOString(),
      episodes:[]
    });
  }

  save();
  $("#seriesDialog").close();
  renderHome();
  if(editingId) renderDetail();
});

$("#addEpisodeButton").addEventListener("click",()=>{
  $("#episodeForm").reset();
  switchEpisodeSource("youtube");
  $("#episodeDialog").showModal();
});

$$(".source-tab").forEach(button=>{
  button.addEventListener("click",()=>switchEpisodeSource(button.dataset.source));
});

$("#episodeForm").addEventListener("submit",async event=>{
  event.preventDefault();
  const series=currentSeries();
  if(!series) return;

  const sourceType=$("#episodeSourceTypeInput").value;
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
      alert("Entre un lien vidéo direct valide.");
      return;
    }
  }

  if(sourceType==="embed"){
    sourceUrl=$("#embedInput").value.trim();
    if(!safeHttpUrl(sourceUrl)){
      alert("Entre une URL d’intégration valide.");
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
    const text=await readFileAsText(subtitleFile);
    if(!text.trim().startsWith("WEBVTT")){
      alert("Le fichier doit être au format WebVTT (.vtt).");
      return;
    }
    subtitleData=`data:text/vtt;charset=utf-8,${encodeURIComponent(text)}`;
  }

  const episodeId=uid();
  if(localFile){
    sourceUrl=`local:${localFile.name}`;
    localVideoUrls.set(episodeId,URL.createObjectURL(localFile));
  }

  series.episodes.push({
    id:episodeId,
    label:$("#episodeLabelInput").value.trim(),
    sourceType,
    sourceUrl,
    subtitleData,
    watched:$("#episodeWatchedInput").checked,
    progress:$("#episodeWatchedInput").checked?100:0,
    createdAt:new Date().toISOString()
  });

  save();
  $("#episodeDialog").close();
  renderDetail();
  renderHome();
});

$("#toggleSeriesFavoriteButton").addEventListener("click",()=>{
  const item=currentSeries();
  if(!item) return;
  item.favorite=!item.favorite;
  save();
  renderDetail();
  renderHome();
});

$("#editSeriesButton").addEventListener("click",()=>openSeriesDialog(true));

$("#deleteSeriesButton").addEventListener("click",()=>{
  const item=currentSeries();
  if(!item||!confirm(`Supprimer « ${item.title} » et tous ses épisodes ?`)) return;
  seriesLibrary=seriesLibrary.filter(series=>series.id!==item.id);
  save();
  showHome();
});

$("#videoPlayer").addEventListener("timeupdate",()=>{
  const video=$("#videoPlayer");
  if(!video.duration) return;
  $("#progressLabel").textContent=`Progression : ${Math.round((video.currentTime/video.duration)*100)} %`;
});
$("#videoPlayer").addEventListener("pause",updateVideoProgress);
$("#videoPlayer").addEventListener("ended",()=>{
  const series=currentSeries();
  const episode=series?.episodes.find(item=>item.id===activeEpisodeId);
  if(!episode) return;
  episode.progress=100;
  episode.watched=true;
  save();
  renderDetail();
});

$("#previousEpisodeButton").addEventListener("click",()=>moveEpisode(-1));
$("#nextEpisodeButton").addEventListener("click",()=>moveEpisode(1));
$("#returnToSeriesButton").addEventListener("click",closePlayer);

$("#markEpisodeWatchedButton").addEventListener("click",()=>{
  const series=currentSeries();
  const episode=series?.episodes.find(item=>item.id===activeEpisodeId);
  if(!episode) return;
  episode.watched=true;
  episode.progress=100;
  save();
  $("#progressLabel").textContent="Progression : 100 %";
});

renderHome();