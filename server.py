"""Local Excel-backed registration server. Run with Python 3 and openpyxl."""
import json
import os
import re
import threading
import uuid
from datetime import datetime
from zoneinfo import ZoneInfo
from pathlib import Path
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import openpyxl
import google_connection

ROOT = Path(__file__).resolve().parent
BOOK = ROOT / 'data' / 'Club_Registrations.xlsx'
LOCK = threading.Lock()
HEADERS = ['Name','Register Number','Official college mail id','Phone','Department','Year','Japanese Student','AWS Interest','Club','Status','Confirmation ID','Registration Date']

def initialize_excel():
    """Create an empty registration workbook on a fresh checkout."""
    if BOOK.exists(): return
    allocations=json.loads((ROOT/'data'/'allocations.json').read_text())
    wb=openpyxl.Workbook(); wb.remove(wb.active)
    for name in [*dict.fromkeys(x['sheet'] for x in allocations),'Japanese Club']:
        sheet=wb.create_sheet(name);sheet.append(HEADERS);sheet.freeze_panes='A2'
        for col,width in enumerate([28,23,33,18,48,10,19,18,38,18,45,26],1):
            sheet.column_dimensions[openpyxl.utils.get_column_letter(col)].width=width
        for cell in sheet[1]:
            cell.font=openpyxl.styles.Font(bold=True,color='FFFFFF')
            cell.fill=openpyxl.styles.PatternFill('solid',fgColor='203566')
        sheet.auto_filter.ref='A1:L151'
    sheet=wb.create_sheet('Allocations')
    sheet.append(['Club','Club sheet','Department','Year','Allocated seats','Registered','Remaining'])
    for index,x in enumerate(allocations,2):
        name=x['sheet'].replace("'","''")
        sheet.append([x['club'],x['sheet'],x['department'],x['year'],x['seats'],f"=COUNTIFS('{name}'!$E$2:$E$151,C{index},'{name}'!$F$2:$F$151,D{index})",f'=E{index}-F{index}'])
    BOOK.parent.mkdir(parents=True,exist_ok=True);wb.save(BOOK);wb.close()

def read_state(wb):
    allocations=[]
    for row in wb['Allocations'].iter_rows(min_row=2,values_only=True):
        if not row[0]: continue
        club,sheet,department,year,seats=row[:5]
        if sheet not in wb.sheetnames or not isinstance(seats,int) or seats<0 or year not in (1,2,3,4):
            raise ValueError('Invalid allocation workbook. Check the Allocations sheet.')
        records=list(wb[sheet].iter_rows(min_row=2,max_col=12,values_only=True))
        count=sum(1 for r in records if r[0] and r[4]==department and r[5]==year)
        allocations.append(dict(club=club,sheet=sheet,department=department,year=year,seats=seats,registered=count))
    keys=[(x['club'],x['department'],x['year']) for x in allocations]
    if len(keys)!=len(set(keys)) or len(allocations)!=400:
        raise ValueError('Allocation rows are missing or duplicated.')
    return dict(clubs=list(dict.fromkeys(x['club'] for x in allocations)),departments=list(dict.fromkeys(x['department'] for x in allocations)),allocations=allocations,japaneseClub='Japanese Club')

def literal(value):
    return "'"+value if isinstance(value,str) and value.startswith(('=','+','-','@')) else value

def register(data,book=BOOK):
    if not isinstance(data,dict): raise ValueError('Invalid submission.')
    fields={key:str(data.get(key,'')).strip() for key in ['name','register','email','phone','department','year','japanese','club','aws']}
    fields['aws']=''
    fields['register']=fields['register'].upper()
    fields['email']=fields['email'].lower()
    if not 2<=len(fields['name'])<=100: raise ValueError('Enter your full student name.')
    if not re.fullmatch(r'[A-Z0-9]{6,25}',fields['register']): raise ValueError('Enter a valid register number (6–25 letters or numbers).')
    if len(fields['email'])>120 or not re.fullmatch(r'[a-z0-9._%+\-]+@mkce\.ac\.in',fields['email']): raise ValueError('Use your official @mkce.ac.in college email.')
    if not re.fullmatch(r'[6-9][0-9]{9}',fields['phone']): raise ValueError('Enter a valid 10-digit mobile number.')
    if fields['year'] not in ['1','2','3'] or fields['japanese'] not in ['Yes','No']: raise ValueError('Registration is open only to 1st, 2nd and 3rd year students.')
    with LOCK:
        wb=openpyxl.load_workbook(book)
        state=read_state(wb)
        japanese=fields['japanese']=='Yes'
        allowed=['Japanese Club'] if japanese else state['clubs']
        if fields['department'] not in state['departments'] or fields['club'] not in allowed: raise ValueError('Japanese students must select Japanese Club. Other students must select a regular club.')
        for sheet in [*dict.fromkeys(x['sheet'] for x in state['allocations']),'Japanese Club']:
            if sheet not in wb.sheetnames: continue
            for r in wb[sheet].iter_rows(min_row=2,max_col=12,values_only=True):
                if r[0] and (str(r[1]).upper()==fields['register'] or str(r[2]).lower()==fields['email']):
                    raise ValueError('This register number or email is already registered. Only ONE club is allowed.')
        matching=[x for x in state['allocations'] if x['club']==fields['club']]
        slot=None if japanese else next(x for x in matching if x['department']==fields['department'] and x['year']==int(fields['year']))
        dept=[x for x in matching if x['department']==fields['department']]
        if not japanese and (slot['registered']>=slot['seats'] or sum(x['registered'] for x in dept)>=sum(x['seats'] for x in dept) or sum(x['registered'] for x in matching)>=150):
            raise ValueError('This club is full for your department or year. Please choose another club.')
        identifier='CLB-'+uuid.uuid4().hex[:12].upper()
        sheet=wb['Japanese Club' if japanese else slot['sheet']]
        row=max(2,sheet.max_row+1)
        # Artifact export may include reserved blank cells: find first empty registration row.
        row=next((r for r in range(2,sheet.max_row+2) if not sheet.cell(r,1).value),row)
        values=[fields['name'],fields['register'],fields['email'],fields['phone'],fields['department'],int(fields['year']),fields['japanese'],fields['aws'] or None,fields['club'],'Registered',identifier,datetime.now(ZoneInfo('Asia/Kolkata')).replace(tzinfo=None)]
        for col,value in enumerate(values,1): sheet.cell(row,col,literal(value))
        sheet.cell(row,12).number_format='dd-mmm-yyyy hh:mm:ss'
        temporary=Path(str(book)+'.tmp')
        try:
            wb.save(temporary)
            os.replace(temporary,book)
        except PermissionError:
            raise ValueError('Close the registration workbook in Excel, then submit again. No registration was saved.')
        finally:
            wb.close()
            if temporary.exists(): temporary.unlink()
        return dict(id=identifier,club=fields['club'])

class Handler(BaseHTTPRequestHandler):
    def json_response(self,status,data):
        body=json.dumps(data).encode()
        self.send_response(status); self.send_header('Content-Type','application/json'); self.send_header('Cache-Control','no-store'); self.send_header('Content-Length',str(len(body))); self.end_headers(); self.wfile.write(body)
    def do_GET(self):
        path=self.path.split('?')[0]
        if path=='/api/config':
            try:
                with LOCK:
                    if google_connection.enabled():
                        state=google_connection.call('config')
                    else:
                        wb=openpyxl.load_workbook(BOOK); state=read_state(wb); wb.close()
                        state['storage']='excel'
                self.json_response(200,state)
            except Exception:
                self.json_response(503,dict(error='Unable to read seat allocations. Check the Google Sheets connection or Excel workbook.'))
            return
        files={'/':('index.html','text/html'),'/index.html':('index.html','text/html'),'/setup':('setup.html','text/html'),'/style.css':('style.css','text/css'),'/app.js':('app.js','text/javascript')}
        if path not in files: self.send_error(404); return
        filename,mime=files[path]; body=(ROOT/filename).read_bytes()
        self.send_response(200); self.send_header('Content-Type',mime+'; charset=utf-8'); self.send_header('Content-Length',str(len(body))); self.end_headers(); self.wfile.write(body)
    def do_POST(self):
        if self.path not in ('/api/register','/api/google-connect'): self.send_error(404); return
        # Same-origin submissions only.
        origin=self.headers.get('Origin')
        if origin and origin not in ['http://localhost:8000','http://127.0.0.1:8000']:
            self.json_response(403,dict(error='Submit from the registration form.')); return
        try:
            size=int(self.headers.get('Content-Length','0'))
            if not 0<size<=8192: raise ValueError('Invalid submission size.')
            payload=json.loads(self.rfile.read(size))
            if not isinstance(payload,dict): raise ValueError('Invalid submission.')
            if self.path=='/api/google-connect':
                result=google_connection.connect(str(payload.get('url','')).strip())
            elif google_connection.enabled():
                result=google_connection.call('register',payload)
            else:
                result=register(payload)
            self.json_response(201,result)
        except (ValueError,UnicodeDecodeError) as error: self.json_response(400,dict(error=str(error)))
        except Exception: self.json_response(503,dict(error='Unable to save the registration. Please retry.'))

if __name__=='__main__':
    initialize_excel()
    google_connection.prepare()
    print('Club Registration Form: http://localhost:8000',flush=True)
    print('Workbook: '+str(BOOK),flush=True)
    ThreadingHTTPServer(('127.0.0.1',8000),Handler).serve_forever()
