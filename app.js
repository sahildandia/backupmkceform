const form=document.querySelector('#registration'),department=form.department,year=form.year;
const clubs=document.querySelector('#clubs'),message=document.querySelector('#message'),submit=document.querySelector('#submit');
let state=null,busy=false,requestId=null;
const clubOrder=['Communication Club','EWB Club','Google Club','IBM Z Explore Student Community','IEEE Chapter','Innovators Forum','IoT Club','Mobile App Club','Sustainable Engineers','Unstop Igniters'];
function showMessage(text,type='error'){message.textContent=text;message.className=type;}
async function load(){const response=await fetch('/api/config',{cache:'no-store'});if(!response.ok)throw new Error('Unable to load seat allocations.');state=await response.json();if(department.options.length===1)for(const name of state.departments)department.add(new Option(name,name));document.querySelector('#connection').textContent=`Connected to ${state.storage==='google'?'Google Sheets':'Excel'} · 150 seats per club`;render();}
function render(){
 const ready=department.value&&year.value;document.querySelector('#club-section').hidden=!ready;
 const selected=form.querySelector('input[name=club]:checked')?.value;clubs.replaceChildren();
 const japanese=form.querySelector('input[name=japanese]:checked')?.value==='Yes';
 if(state)document.querySelector('#connection').textContent=`Connected to ${state.storage==='google'?'Google Sheets':'Excel'} · ${japanese?'Japanese Club: unlimited seats':'150 seats per regular club'}`;
 document.querySelector('.notice').textContent=japanese?'Japanese students can register for Japanese Club. Seats are unlimited.':'You can select exactly ONE club. Availability is based on the seats allocated to your department and year.';
 if(ready&&state)for(const club of japanese?['Japanese Club']:clubOrder.filter(c=>state.clubs.includes(c))){
  const slot=state.allocations.find(x=>x.club===club&&x.department===department.value&&x.year===Number(year.value));
  const dept=state.allocations.filter(x=>x.club===club&&x.department===department.value);
  const used=dept.reduce((a,x)=>a+x.registered,0),total=dept.reduce((a,x)=>a+x.seats,0);
  const global=state.allocations.filter(x=>x.club===club).reduce((a,x)=>a+x.registered,0);
  const left=japanese?Infinity:Math.max(0,Math.min(slot.seats-slot.registered,total-used,150-global));
  const label=document.createElement('label');label.className='club';const radio=document.createElement('input');radio.type='radio';radio.name='club';radio.value=club;radio.required=true;radio.disabled=left===0;radio.checked=club===selected&&left>0;
  const content=document.createElement('div');content.className='club-content';const title=document.createElement('strong');title.textContent=club==='Communication Club'?'LEXORA (COMMUNICATION CLUB)':club;
  const cap=document.createElement('div');cap.className='capacity';const count=document.createElement('span');count.textContent=japanese?'Capacity: Unlimited':`Capacity: ${used} / ${total}`;const badge=document.createElement('span');badge.className=`badge ${left===0?'full':left<=5?'low':''}`;badge.textContent=japanese?'UNLIMITED':left?`${left} LEFT`:'FULL';cap.append(count,badge);
  content.append(title,cap);label.append(radio,content);clubs.append(label);
 }
 submit.disabled=busy||!ready||!form.querySelector('input[name=club]:checked');
}
department.addEventListener('change',()=>{clubs.replaceChildren();render()});year.addEventListener('change',()=>{clubs.replaceChildren();render()});clubs.addEventListener('change',render);
form.querySelectorAll('input[name=japanese]').forEach(r=>r.addEventListener('change',()=>{requestId=null;clubs.replaceChildren();render()}));
form.addEventListener('submit',async event=>{event.preventDefault();if(!form.reportValidity()||busy)return;busy=true;submit.disabled=true;submit.textContent='Saving registration…';showMessage('','');
 try{requestId??=crypto.randomUUID();const payload={...Object.fromEntries(new FormData(form)),requestId};const response=await fetch('/api/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const result=await response.json();if(!response.ok)throw new Error(result.error);requestId=null;form.reset();showMessage(`Registration complete! You have joined ${result.club}. Your registration ID is ${result.id}.`,'success');await load();}catch(error){showMessage(error.message);try{await load()}catch{}}finally{busy=false;submit.textContent='Complete Registration';render();}});
load().catch(error=>{showMessage(`${error.message} Start the server using Start.bat, then open http://localhost:8000.`);document.querySelector('#connection').textContent='Excel connection unavailable';});
setInterval(()=>{if(!busy)load().catch(()=>{document.querySelector('#connection').textContent='Connection lost. Retry before submitting.'})},30000);
