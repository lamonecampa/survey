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
form.addEventListener('submit',e=>{e.preventDefault();if(!validateStep())return;const data=Object.fromEntries(new FormData(form).entries());data.platform=FormDataArray('platform');data.alasan=FormDataArray('alasan');data.submitted_at=new Date().toISOString();try{const all=JSON.parse(localStorage.getItem('uibu_survey_demo')||'[]');all.push(data);localStorage.setItem('uibu_survey_demo',JSON.stringify(all));}catch(err){console.warn('Penyimpanan demo tidak tersedia',err);}form.classList.add('hidden');document.getElementById('success').classList.remove('hidden');});
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
