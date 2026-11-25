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

// Load public activity photos from the official UIBU WordPress media endpoint.
// Images remain hosted by UIBU; this microsite stores only the article ID and metadata.
(async function loadFstGallery(){
  const root=document.getElementById('fstGallery');
  if(!root)return;
  const sources=[{id:14318,category:'Kolaborasi industri',fallbackTitle:'Honda Service Visit UIBU 2026',fallbackText:'FST UIBU bekerja sama dengan AHASS Honda Sinar Indah Motor menghadirkan layanan servis motor dan oli gratis bagi sivitas akademika.',url:'https://uibu.ac.id/?p=14318'}];
  const esc=value=>String(value||'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const cards=[];
  for(const item of sources){
    try{
      const response=await fetch('https://uibu.ac.id/wp-json/wp/v2/posts/'+item.id+'?_embed',{headers:{Accept:'application/json'}});
      if(!response.ok)throw new Error('Sumber foto tidak merespons');
      const post=await response.json();
      const media=post?._embedded?.['wp:featuredmedia']?.[0];
      const image=media?.media_details?.sizes?.large?.source_url||media?.source_url;
      if(!image)throw new Error('Foto utama belum tersedia melalui API');
      const title=post.title?.rendered||item.fallbackTitle;
      const excerpt=(post.excerpt?.rendered||'').replace(/<[^>]*>/g,' ').replace(/\\s+/g,' ').trim()||item.fallbackText;
      cards.push('<article class="gallery-card"><a href="'+esc(item.url)+'" target="_blank" rel="noopener noreferrer"><img class="gallery-photo" src="'+esc(image)+'" alt="'+esc(title)+'" loading="lazy" referrerpolicy="no-referrer"></a><div class="gallery-card-body"><span class="gallery-tag">'+esc(item.category)+'</span><h3>'+esc(title)+'</h3><p>'+esc(excerpt.slice(0,170))+'</p><a href="'+esc(item.url)+'" target="_blank" rel="noopener noreferrer">Lihat dokumentasi ↗</a></div></article>');
    }catch(error){
      cards.push('<article class="gallery-card"><div class="gallery-photo gallery-photo-fallback" role="img" aria-label="Dokumentasi kegiatan FST UIBU"><div class="fallback-mark">UIBU</div><span>Dokumentasi resmi</span></div><div class="gallery-card-body"><span class="gallery-tag">'+esc(item.category)+'</span><h3>'+esc(item.fallbackTitle)+'</h3><p>'+esc(item.fallbackText)+'</p><a href="'+esc(item.url)+'" target="_blank" rel="noopener noreferrer">Buka berita dan foto ↗</a></div></article>');
    }
  }
  root.innerHTML=cards.join('');
})();
