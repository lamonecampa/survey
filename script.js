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