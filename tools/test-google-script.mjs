import vm from 'node:vm';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const allocations=JSON.parse(fs.readFileSync('data/allocations.json','utf8'));
const headers=['Name','Register Number','Official college mail id','Phone','Department','Year','Japanese Student','AWS Interest','Club','Status','Confirmation ID','Registration Date'];
class Sheet {
 constructor(rows){this.rows=rows;this.maxRows=1000;}
 getMaxRows(){return this.maxRows;}
 insertRowsAfter(row,count){this.maxRows+=count;}
 getLastRow(){return this.rows.length;}
 getRange(row,col,rows=1,cols=1){const s=this;return {getValues(){return Array.from({length:rows},(_,i)=>Array.from({length:cols},(_,j)=>s.rows[row+i-1]?.[col+j-1]??''));},setNumberFormat(){return this;},setValues(values){values.forEach((r,i)=>{s.rows[row+i-1]??=[];r.forEach((v,j)=>s.rows[row+i-1][col+j-1]=v);});return this;}};}
}
const sheets={Allocations:new Sheet([['Club','Club sheet','Department','Year','Allocated seats'],...allocations.map(x=>[x.club,x.sheet,x.department,x.year,x.seats])]),'Japanese Club':new Sheet([headers])};
for(const x of allocations)sheets[x.sheet]??=new Sheet([headers]);
let held=false;
const context=vm.createContext({ContentService:{MimeType:{JSON:'json'},createTextOutput:text=>({setMimeType:()=>JSON.parse(text)})},LockService:{getScriptLock:()=>({waitLock:()=>held=true,releaseLock:()=>held=false})},SpreadsheetApp:{openById:id=>({getSheetByName:n=>sheets[n]}),flush:()=>assert(held)},Utilities:{formatDate:()=> '12-Oct-2026 18:00:00'},console});
vm.runInContext(fs.readFileSync('google-sheets/Code.template.gs','utf8').replace('__CONNECTION_TOKEN__','test-key'),context);
const post=(action,data,token='test-key')=>context.doPost({postData:{contents:JSON.stringify({token,action,data})}});
assert.equal(post('config',null,'incorrect').ok,false);
assert.equal(context.doGet().ok,false);
let config=post('config').data;assert.equal(config.clubs.length,10);assert.equal(config.allocations.length,400);
const p={name:'Test Student',register:'TEST0001',email:'test1@mkce.ac.in',phone:'9876543210',department:'Civil Engineering',year:'1',japanese:'No',aws:'Yes',club:'Google Club',requestId:'12345678-1234-1234-1234-123456789012'};
let result=post('register',p);assert.equal(result.ok,true);assert.equal(sheets['Google Club'].rows[1][0],'Test Student');assert.equal(sheets['Google Club'].rows[1][7],'');assert.equal(sheets['Google Club'].rows[1][9],'Registered');assert.equal(sheets['Google Club'].rows[1][10],result.data.id);
assert.equal(post('register',p).ok,true);assert.equal(sheets['Google Club'].rows.length,2);
assert.match(post('register',{...p,club:'Mobile App Club',requestId:'22345678-1234-1234-1234-123456789012'}).error,/already registered/);
assert.match(post('register',{...p,register:'TEST0002',email:'test2@mkce.ac.in',requestId:'32345678-1234-1234-1234-123456789012'}).error,/full/);
assert.equal(post('config').data.allocations.find(x=>x.club==='Google Club'&&x.department==='Civil Engineering'&&x.year===1).registered,1);
assert.equal(post('register',{...p,register:'TEST0003',email:'outside@gmail.com'}).ok,false);
assert.equal(held,false);
assert.match(post('register',{...p,year:'4'}).error,/1st, 2nd and 3rd/);
assert.match(post('register',{...p,japanese:'Yes'}).error,/Japanese Club/);
assert.match(post('register',{...p,club:'Japanese Club'}).error,/regular club/);
for(let i=0;i<151;i++)assert.equal(post('register',{...p,japanese:'Yes',club:'Japanese Club',register:`JPTEST${String(i).padStart(4,'0')}`,email:`jp${i}@mkce.ac.in`,requestId:`42345678-1234-1234-1234-${String(i).padStart(12,'0')}`}).ok,true);
assert.equal(sheets['Japanese Club'].rows.length,152);
console.log('Japanese Club accepted 151 registrations without a seat cap; Year 4 and incorrect club eligibility rejected.');
console.log('Apps Script logic passed: authentication, allocation reads, correct columns, one-club rule, capacity boundary and retry deduplication.');
