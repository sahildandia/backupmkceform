"""Authenticated server-side Apps Script bridge; credentials never go to form JS."""
import json
import re
import secrets
import urllib.request
import urllib.error
from pathlib import Path

SETTINGS=Path(__file__).resolve().parent/'google-sheets'/'connection.json'
SPREADSHEET_ID='1jTPb8S7mVIJfwmRuNJf_eyaj5S7ytZKKGNgyBSWV5Xk'

def settings():
    return json.loads(SETTINGS.read_text()) if SETTINGS.exists() else {}

def enabled(): return settings().get('enabled',False)

def prepare():
    SETTINGS.parent.mkdir(parents=True,exist_ok=True)
    if not SETTINGS.exists():
        SETTINGS.write_text(json.dumps(dict(enabled=False,web_app_url='',token=secrets.token_urlsafe(32)),indent=2))
    template=SETTINGS.parent/'Code.template.gs'
    if template.exists():
        (SETTINGS.parent/'Code.gs').write_text(template.read_text().replace('__CONNECTION_TOKEN__',settings()['token']))

def call(action,data=None,url=None):
    config=settings()
    endpoint=url or config.get('web_app_url','')
    if not re.fullmatch(r'https://script\.google\.com/macros/s/[A-Za-z0-9_-]+/exec',endpoint):
        raise ValueError('Enter the deployed Google Apps Script Web app URL ending in /exec.')
    if not config.get('token'): raise ValueError('Google connection token is missing.')
    body=json.dumps(dict(action=action,token=config['token'],data=data)).encode()
    request=urllib.request.Request(endpoint,data=body,headers={'Content-Type':'application/json'})
    try:
        with urllib.request.urlopen(request,timeout=45) as response:
            result=json.loads(response.read(2_000_000))
    except (urllib.error.URLError,TimeoutError,json.JSONDecodeError):
        raise ValueError('Google Sheets did not confirm the request. Check the deployment and retry the same submission. No Excel fallback is used.')
    if not isinstance(result,dict) or not result.get('ok'):
        raise ValueError(result.get('error','Google Sheets rejected the request.') if isinstance(result,dict) else 'Invalid Google Sheets response.')
    value=result.get('data')
    if not isinstance(value,dict): raise ValueError('Invalid Google Sheets response.')
    if action=='config' and value.get('spreadsheetId')!=SPREADSHEET_ID:
        raise ValueError('This deployment is connected to a different spreadsheet.')
    return value

def connect(url):
    state=call('config',url=url)
    if len(state.get('clubs',[]))!=10 or len(state.get('allocations',[]))!=400:
        raise ValueError('The deployment does not contain all 10 clubs and 400 allocations.')
    config=settings();config.update(enabled=True,web_app_url=url)
    temp=SETTINGS.with_suffix('.tmp');temp.write_text(json.dumps(config,indent=2));temp.replace(SETTINGS)
    return dict(ok=True,storage='google',spreadsheetId=SPREADSHEET_ID)
