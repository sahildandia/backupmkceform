const SPREADSHEET_ID = '1jTPb8S7mVIJfwmRuNJf_eyaj5S7ytZKKGNgyBSWV5Xk';
const CONNECTION_TOKEN = '__CONNECTION_TOKEN__';
const HEADERS = ['Name','Register Number','Official college mail id','Phone','Department','Year','Japanese Student','AWS Interest','Club','Status','Confirmation ID','Registration Date'];

function output_(value) {
 return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
function doGet() { return output_({ok:false,error:'Use the authenticated registration server.'}); }
function doPost(e) {
 let lock;
 try {
  const input = JSON.parse(e.postData.contents);
  if (!CONNECTION_TOKEN || CONNECTION_TOKEN.startsWith('__') || input.token !== CONNECTION_TOKEN) return output_({ok:false,error:'Unauthorized connection.'});
  if (!['config','register'].includes(input.action)) throw new Error('Unknown action.');
  lock = LockService.getScriptLock(); lock.waitLock(20000);
  const book = SpreadsheetApp.openById(SPREADSHEET_ID);
  const state = readState_(book);
  if (input.action === 'config') {
   const config = {clubs:state.clubs,departments:state.departments,allocations:state.allocations,japaneseClub:'Japanese Club',storage:'google',spreadsheetId:SPREADSHEET_ID};
   return output_({ok:true,data:config});
  }
  return output_({ok:true,data:register_(book,state,input.data)});
 } catch (error) { return output_({ok:false,error:error.message || 'Unable to access Google Sheets.'}); }
 finally { if (lock) lock.releaseLock(); }
}
function readState_(book) {
 const source = book.getSheetByName('Allocations');
 if (!source) throw new Error('Allocations tab is missing.');
 const rows=source.getRange(2,1,400,5).getValues();
 const records={},allocations=[],keys=new Set();
 for(const row of rows) {
  const [club,sheet,department,year,seats]=row;
  if(!club || !sheet || !department || !Number.isInteger(year) || year<1 || year>4 || !Number.isInteger(seats) || seats<0) throw new Error('Invalid seat allocation.');
  const key=JSON.stringify([club,department,year]);
  if(keys.has(key))throw new Error('Duplicate allocation.');keys.add(key);
  if(!records[sheet]) {
   const tab=book.getSheetByName(sheet);
   if(!tab)throw new Error('Missing club tab: '+sheet);
   if(JSON.stringify(tab.getRange(1,1,1,12).getValues()[0])!==JSON.stringify(HEADERS))throw new Error('Unexpected columns in '+sheet);
   records[sheet]=tab.getLastRow()>1?tab.getRange(2,1,tab.getLastRow()-1,12).getValues().filter(r=>r[0]):[];
  }
  const registered=records[sheet].filter(r=>r[4]===department&&Number(r[5])===year).length;
  allocations.push({club,sheet,department,year,seats,registered});
 }
 const japanese=book.getSheetByName('Japanese Club');
 if(japanese)records['Japanese Club']=japanese.getLastRow()>1?japanese.getRange(2,1,japanese.getLastRow()-1,12).getValues().filter(r=>r[0]):[];
 return {clubs:[...new Set(allocations.map(x=>x.club))],departments:[...new Set(allocations.map(x=>x.department))],allocations,records};
}
function register_(book,state,data) {
 if(!data || typeof data!=='object')throw new Error('Invalid submission.');
 const p={};
 for(const key of ['name','register','email','phone','department','year','japanese','aws','club','requestId'])p[key]=String(data[key]||'').trim();
 p.register=p.register.toUpperCase();p.email=p.email.toLowerCase();p.aws='';
 if(p.name.length<2||p.name.length>100)throw new Error('Enter your full student name.');
 if(!/^[A-Z0-9]{6,25}$/.test(p.register))throw new Error('Enter a valid register number.');
 if(p.email.length>120||! /^[a-z0-9._%+\-]+@mkce\.ac\.in$/.test(p.email))throw new Error('Use your official @mkce.ac.in college email.');
 if(!/^[6-9][0-9]{9}$/.test(p.phone))throw new Error('Enter a valid 10-digit phone number.');
 if(!['1','2','3'].includes(p.year)||!['Yes','No'].includes(p.japanese))throw new Error('Registration is open only to 1st, 2nd and 3rd year students.');
 const isJapanese=p.japanese==='Yes';
 if(!state.departments.includes(p.department)||(isJapanese?p.club!=='Japanese Club':!state.clubs.includes(p.club)))throw new Error('Japanese students must select Japanese Club. Other students must select a regular club.');
 if(!/^[a-f0-9-]{36}$/i.test(p.requestId))throw new Error('Invalid registration request. Refresh and try again.');
 const id='CLB-'+p.requestId.toUpperCase();
 for(const rows of Object.values(state.records))for(const r of rows) {
  if(String(r[1]).toUpperCase()===p.register || String(r[2]).toLowerCase()===p.email) {
   if(r[10]===id && String(r[1]).toUpperCase()===p.register && String(r[2]).toLowerCase()===p.email && r[8]===p.club)return {id,club:r[8]};
   throw new Error('This register number or email is already registered. Only ONE club is allowed.');
  }
 }
 const clubRows=state.allocations.filter(x=>x.club===p.club);
 const deptRows=clubRows.filter(x=>x.department===p.department);
 const slot=deptRows.find(x=>x.year===Number(p.year));
 if(!isJapanese&&!slot)throw new Error('Select a valid department, year and club.');
 if(!isJapanese&&(slot.registered>=slot.seats || deptRows.reduce((n,x)=>n+x.registered,0)>=deptRows.reduce((n,x)=>n+x.seats,0) || state.records[slot.sheet].length>=150))throw new Error('This club is full for your department or year. Choose another club.');
 let sheet=book.getSheetByName(isJapanese?'Japanese Club':slot.sheet);
 if(!sheet){sheet=book.insertSheet('Japanese Club');sheet.getRange(1,1,1,12).setValues([HEADERS]);sheet.setFrozenRows(1);}
 // Imported workbooks have 150 preformatted rows. Find the first unused student row.
 let row;
 if(isJapanese) {
  row=sheet.getLastRow()+1;
  if(row>sheet.getMaxRows())sheet.insertRowsAfter(sheet.getMaxRows(),100);
 } else {
  const names=sheet.getRange(2,1,150,1).getValues();
  const index=names.findIndex(r=>!r[0]);
  if(index<0)throw new Error('This club is full.');
  row=index+2;
 }
 const safe=s=>/^[=+\-@]/.test(s)?"'"+s:s;
 const values=[safe(p.name),p.register,p.email,p.phone,p.department,Number(p.year),p.japanese,p.aws,p.club,'Registered',id,Utilities.formatDate(new Date(),'Asia/Kolkata','dd-MMM-yyyy HH:mm:ss')];
 sheet.getRange(row,1,1,12).setValues([values]);
 SpreadsheetApp.flush();
 return {id,club:p.club};
}
