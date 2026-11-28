const form=document.getElementById('surveyForm');
const steps=[...document.querySelectorAll('.form-step')];
const next=document.getElementById('next'),back=document.getElementById('back'),submit=document.getElementById('submit');
const progress=document.getElementById('progress'),counter=document.getElementById('counter'),stepLabel=document.getElementById('stepLabel'),error=document.getElementById('error');
const labels=['01 — Asal responden','02 — Sumber informasi','03 — Relasi dan rekomendasi','04 — Minat program studi'];
let current=0;
function render(){steps.forEach((s,i)=>s.classList.toggle('active',i===current));progress.style.width=((current+1)/steps.length*100)+'%';counter.textContent=(current+1)+' / '+steps.length;stepLabel.textContent=labels[current];back.disabled=current===0;next.classList.toggle('hidden',current===steps.length-1);submit.classList.toggle('hidden',current!==steps.length-1);error.textContent='';}
function validateStep(){const active=steps[current];for(const el of active.querySelectorAll('[required]')){if(!el.checkValidity()){el.reportValidity();return false;}}return true;}
next.addEventListener('click',()=>{if(validateStep()){current=Math.min(current+1,steps.length-1);render();}});
back.addEventListener('click',()=>{current=Math.max(current-1,0);render();});
document.getElementById('source').addEventListener('change',e=>document.getElementById('socialFields').classList.toggle('hidden',e.target.value!=='Media sosial'));
document.getElementById('relative').addEventListener('change',e=>document.getElementById('relativeFields').classList.toggle('hidden',e.target.value!=='Ya'));
const SURVEY_API_URL = "https://script.google.com/macros/s/AKfycbzx_6Jn7SNXxvEe4qJICPrAvd9XFYzNU6PKDGn-N258aXqzkkNKRL_tuDv4pyfW0YU/exec"; // Google Apps Script Web App FST-UIBU.
form.addEventListener('submit',async e=>{
  e.preventDefault();
  if(!validateStep())return;
  if(!SURVEY_API_URL){
    error.textContent='Pengiriman belum aktif. Admin perlu memasukkan URL Google Apps Script terlebih dahulu.';
    return;
  }
  const button=submit;
  button.disabled=true;button.textContent='Mengirim...';
  const data=Object.fromEntries(new FormData(form).entries());
  data.platform=FormDataArray('platform');data.alasan=FormDataArray('alasan');
  data.consent=form.querySelector('[name="consent"]').checked;
  data.submitted_at=new Date().toISOString();
  try{
    // text/plain + no-cors avoids a browser preflight. Apps Script receives the JSON body.
    await fetch(SURVEY_API_URL,{method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(data)});
    form.classList.add('hidden');
    const success=document.getElementById('success');
    success.querySelector('h3').textContent='Terima kasih!';
    success.querySelector('p').textContent='Browser telah mengirim permintaan jawaban ke server survei. Karena pembatasan keamanan lintas situs, halaman ini tidak dapat membaca tanda terima server. Pengelola perlu memastikan baris baru muncul di Google Sheets.';
    success.classList.remove('hidden');
  }catch(err){
    console.error(err);error.textContent='Pengiriman gagal. Periksa koneksi internet atau hubungi pengelola survei.';
    button.disabled=false;button.innerHTML='Kirim jawaban <span>↗</span>';
  }
});
function FormDataArray(name){return [...form.querySelectorAll('input[name="'+name+'"]:checked')].map(x=>x.value);}
render();

// Automatic slideshow using public images hosted by UIBU. No image files are copied into this repository.
// External FST activity gallery. Load the known article first; discovery is optional.
(async function loadFstGallerySlideshow(){
  const root=document.getElementById('fstGallery');
  if(!root)return;
  root.classList.add('is-slideshow');

  const fetchJson=async(url,timeout=7000)=>{
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),timeout);
    try{
      const response=await fetch(url,{headers:{Accept:'application/json'},signal:controller.signal,mode:'cors'});
      if(!response.ok)throw new Error('HTTP '+response.status);
      return await response.json();
    }finally{clearTimeout(timer);}
  };

  const slides=[];
  const addSlide=(image,title,description,category,url)=>{
    if(!image||slides.some(s=>s.image===image))return;
    slides.push({image,title,description,category,url});
  };
  const loadPost=async(item)=>{
    try{
      const post=await fetchJson('https://uibu.ac.id/wp-json/wp/v2/posts/'+item.id+'?_embed',7000);
      const title=(post.title?.rendered||'Kegiatan FST UIBU').replace(/<[^>]*>/g,'').trim();
      const description=(post.excerpt?.rendered||'Dokumentasi kegiatan Fakultas Sains dan Teknologi UIBU.').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
      const featured=post._embedded?.['wp:featuredmedia']?.[0];
      addSlide(featured?.media_details?.sizes?.large?.source_url||featured?.source_url,title,description,item.category,item.url||post.link);
      const content=post.content?.rendered||'';
      for(const match of content.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi)){
        const altMatch=match[0].match(/alt=["']([^"']*)["']/i);
        addSlide(match[1],altMatch?.[1]||title,description,item.category,item.url||post.link);
      }
    }catch(error){console.warn('Artikel UIBU gagal dimuat:',item.id,error);}
  };

  // Do not let a slow listing request block the known article.
  await loadPost({id:14318,category:'Kolaborasi industri',url:'https://uibu.ac.id/?p=14318'});
  if(!slides.length){
    try{
      const posts=await fetchJson('https://uibu.ac.id/wp-json/wp/v2/posts?search=Fakultas%20Sains%20dan%20Teknologi&per_page=8&_embed',6000);
      for(const post of posts.slice(0,8)){
        await loadPost({id:post.id,category:'Kegiatan FST',url:post.link});
        if(slides.length>=12)break;
      }
    }catch(error){console.warn('Pencarian berita FST tidak tersedia:',error);}
  }

  if(!slides.length){
    const fallback=document.createElement('article');
    fallback.className='gallery-empty';
    const heading=document.createElement('b');heading.textContent='Foto kegiatan belum dapat dimuat otomatis.';
    const note=document.createElement('small');note.textContent='Sumber foto UIBU tidak merespons atau membatasi akses lintas situs. Buka dokumentasi resmi melalui tautan berikut.';
    const link=document.createElement('a');link.href='https://uibu.ac.id/?p=14318';link.target='_blank';link.rel='noopener noreferrer';link.textContent='Buka dokumentasi UIBU ↗';
    fallback.append(heading,note,link);root.replaceChildren(fallback);return;
  }

  let active=0,timer=null;
  const cards=slides.map((slide,index)=>{
    const card=document.createElement('article');card.className='gallery-card'+(index===0?' is-active':'');
    const link=document.createElement('a');link.href=slide.url;link.target='_blank';link.rel='noopener noreferrer';
    const img=document.createElement('img');img.className='gallery-photo';img.src=slide.image;img.alt=slide.title;img.loading=index===0?'eager':'lazy';img.referrerPolicy='no-referrer';
    link.append(img);
    const body=document.createElement('div');body.className='gallery-card-body';
    const tag=document.createElement('span');tag.className='gallery-tag';tag.textContent=slide.category;
    const heading=document.createElement('h3');heading.textContent=slide.title;
    const desc=document.createElement('p');desc.textContent=slide.description.slice(0,180);
    const more=document.createElement('a');more.href=slide.url;more.target='_blank';more.rel='noopener noreferrer';more.textContent='Lihat dokumentasi ↗';
    body.append(tag,heading,desc,more);card.append(link,body);
    img.addEventListener('error',()=>{card.remove();slides.splice(slides.indexOf(slide),1);if(!slides.length){root.classList.remove('is-slideshow');root.textContent='Foto dokumentasi tidak dapat diakses dari server sumber.';}else{show(Math.min(active,slides.length-1));}});
    return card;
  });
  root.replaceChildren(...cards);
  const controls=document.createElement('div');controls.className='gallery-controls';
  const previous=document.createElement('button');previous.className='gallery-arrow';previous.type='button';previous.setAttribute('aria-label','Foto sebelumnya');previous.textContent='‹';
  const dots=document.createElement('div');dots.className='gallery-dots';
  const status=document.createElement('span');status.className='gallery-status';status.setAttribute('aria-live','polite');
  const next=document.createElement('button');next.className='gallery-arrow';next.type='button';next.setAttribute('aria-label','Foto berikutnya');next.textContent='›';
  const dotButtons=slides.map((_,i)=>{const dot=document.createElement('button');dot.type='button';dot.className='gallery-dot'+(i===0?' is-active':'');dot.setAttribute('aria-label','Tampilkan foto '+(i+1));dot.addEventListener('click',()=>show(i,true));dots.append(dot);return dot;});
  controls.append(previous,dots,status,next);root.after(controls);
  function show(index,manual=false){
    if(!slides.length)return;
    active=(index+slides.length)%slides.length;
    cards.forEach((card,i)=>card.classList.toggle('is-active',i===active));
    dotButtons.forEach((dot,i)=>{dot.classList.toggle('is-active',i===active);dot.setAttribute('aria-current',i===active?'true':'false');});
    status.textContent=(active+1)+' / '+slides.length;
    if(manual)start();
  }
  function stop(){if(timer){clearInterval(timer);timer=null;}}
  function start(){stop();if(slides.length>1&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches)timer=setInterval(()=>show(active+1),5000);}
  previous.addEventListener('click',()=>show(active-1,true));next.addEventListener('click',()=>show(active+1,true));
  root.addEventListener('mouseenter',stop);root.addEventListener('mouseleave',start);
  root.addEventListener('focusin',stop);root.addEventListener('focusout',start);
  show(0);start();
})();


// ===== FST survey results dashboard =====
// Set this to the deployed Google Apps Script Web App URL when the Sheet backend is ready.
// Expected JSON: { totalResponses: 25, schoolTypes:[{label:"SMK",count:12}], programs:[...],
// regions:[...], firstSources:[...], platforms:[...], schoolMajors:[...],
// referrals:[...], reasons:[...] }
const SURVEY_SUMMARY_URL = SURVEY_API_URL; // Dashboard memakai endpoint yang sama dengan formulir.

(function initSurveyResults(){
  const section=document.getElementById('hasil');
  if(!section)return;
  const status=section.querySelector('#resultsStatus');
  const setStatus=(message,live=false)=>{
    status.lastElementChild.textContent=message;
    status.classList.toggle('is-live',live);
  };
  if(!SURVEY_SUMMARY_URL){
    setStatus('Belum terhubung ke Google Sheets · grafik akan aktif setelah database disambungkan');
    return;
  }
  const palette=['#2478bd','#28b9b0','#f28c28','#12345b','#55b9e8','#79a8cf','#80cfc5','#dca45d'];
  const list=(value)=>Array.isArray(value)?value:[];
  const labelsOf=(items)=>items.map(x=>String(x.label??x.name??'Lainnya'));
  const valuesOf=(items)=>items.map(x=>Number(x.count??x.value??0));
  const draw=(id,items,type='bar')=>{
    const card=document.getElementById(id)?.closest('.result-chart');
    const canvas=document.getElementById(id);
    const rows=list(items).filter(x=>Number(x.count??x.value??0)>0);
    if(!canvas||!card||!rows.length)return;
    card.classList.add('has-data');
    const horizontal=type==='bar';
    new Chart(canvas,{
      type:type==='doughnut'?'doughnut':'bar',
      data:{labels:labelsOf(rows),datasets:[{data:valuesOf(rows),backgroundColor:palette,borderRadius:horizontal?6:2,borderWidth:0,barThickness:'flex',maxBarThickness:26}]},
      options:{
        responsive:true,maintainAspectRatio:false,indexAxis:horizontal?'y':'x',
        plugins:{legend:{display:type==='doughnut',position:'bottom',labels:{boxWidth:10,usePointStyle:true,font:{family:'DM Sans',size:10}}},tooltip:{callbacks:{label:(ctx)=>ctx.label+': '+(ctx.parsed.x??ctx.parsed)+' responden'}}},
        scales:type==='doughnut'?{}:{x:{beginAtZero:true,ticks:{precision:0,font:{size:9}},grid:{color:'#edf2f6'}},y:{ticks:{font:{size:10}},grid:{display:false}}}
      }
    });
  };
  if(!SURVEY_SUMMARY_URL){
    setStatus('Belum terhubung ke Google Sheets · URL Web App belum dikonfigurasi');
    return;
  }
  const callbackName='uibuSurveySummaryCallback';
  window[callbackName]=(payload)=>{
    const data=payload.summary||payload;
    const total=Number(data.totalResponses||0);
    document.getElementById('kpiTotal').textContent=total.toLocaleString('id-ID');
    document.getElementById('kpiSchools').textContent=list(data.schoolTypes).length;
    document.getElementById('kpiRegions').textContent=list(data.regions).length;
    document.getElementById('kpiPrograms').textContent=list(data.programs).length;
    draw('chartSchool',data.schoolTypes);
    draw('chartProgram',data.programs,'doughnut');
    draw('chartRegion',list(data.regions).slice(0,10));
    draw('chartSource',data.firstSources);
    draw('chartPlatform',data.platforms,'doughnut');
    draw('chartMajor',list(data.schoolMajors).slice(0,10));
    draw('chartReferral',data.referrals);
    draw('chartReason',data.reasons);
    setStatus('Data diperbarui · '+total.toLocaleString('id-ID')+' responden',true);
    updateCampusBuilding(data);
  };
  const script=document.createElement('script');
  script.src=SURVEY_SUMMARY_URL+'?callback='+callbackName+'&t='+Date.now();
  script.onerror=()=>setStatus('Google Sheets belum dapat dibaca · periksa URL deployment dan akses Web App');
  document.head.appendChild(script);
})();


function updateCampusBuilding(data){
  const set=(id,items)=>{const node=document.getElementById(id);if(node)node.textContent=items?.[0]?.label||'Belum ada data';};
  set('buildingSchool',data.schoolTypes);set('buildingSource',data.firstSources);
  set('buildingProgram',data.programs);set('buildingRegion',data.regions);
  const total=Number(data.totalResponses||0);
  document.querySelectorAll('[data-building-total]').forEach(el=>el.textContent=total.toLocaleString('id-ID'));
}


/* Separate lecturer PMB participation survey */
(() => {
  const lecturerForm=document.getElementById('lecturerSurveyForm');
  if(!lecturerForm)return;
  const error=document.getElementById('lecturerError');
  const button=document.getElementById('lecturerSubmit');
  lecturerForm.addEventListener('submit',async event=>{
    event.preventDefault();
    if(!lecturerForm.reportValidity())return;
    const data=Object.fromEntries(new FormData(lecturerForm).entries());
    for(const name of ['bentuk_promosi','media_promosi','dukungan']){
      data[name]=[...lecturerForm.querySelectorAll('input[name="'+name+'"]:checked')].map(input=>input.value);
    }
    data.survey_type='dosen_pmb';
    data.consent=lecturerForm.querySelector('[name="consent"]').checked;
    data.submitted_at=new Date().toISOString();
    if(!SURVEY_API_URL){error.textContent='Endpoint survei belum dikonfigurasi.';return;}
    button.disabled=true;button.textContent='Mengirim...';error.textContent='';
    try{
      await fetch(SURVEY_API_URL,{method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(data)});
      lecturerForm.classList.add('hidden');
      document.getElementById('lecturerSuccess').classList.remove('hidden');
    }catch(err){
      console.error(err);error.textContent='Pengiriman gagal. Periksa koneksi internet lalu coba kembali.';
      button.disabled=false;button.innerHTML='Kirim survei dosen <span>↗</span>';
    }
  });
})();
