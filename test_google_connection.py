import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch,MagicMock
import google_connection as g

class GoogleBridgeTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(); self.path=Path(self.tmp.name)/'config.json'
        self.path.write_text(json.dumps(dict(enabled=False,token='secret-test',web_app_url='')))
        self.patcher=patch.object(g,'SETTINGS',self.path);self.patcher.start()
    def tearDown(self):self.patcher.stop();self.tmp.cleanup()
    def test_invalid_url_rejected_before_request(self):
        with patch('urllib.request.urlopen') as request:
            with self.assertRaises(ValueError):g.connect('https://example.com/exec')
            request.assert_not_called()
    def test_verification_before_activation(self):
        with patch.object(g,'call',return_value={'clubs':['club']*10,'allocations':[{}]*400}):g.connect('https://script.google.com/macros/s/abc/exec')
        self.assertTrue(g.enabled())
    def test_wrong_sheet_and_cloud_error(self):
        response=MagicMock();response.__enter__.return_value=response
        response.read.return_value=json.dumps({'ok':True,'data':{'spreadsheetId':'other'}}).encode()
        with patch('urllib.request.urlopen',return_value=response):
            with self.assertRaisesRegex(ValueError,'different spreadsheet'):g.call('config',url='https://script.google.com/macros/s/abc/exec')
        response.read.return_value=json.dumps({'ok':False,'error':'Club is full'}).encode()
        with patch('urllib.request.urlopen',return_value=response):
            with self.assertRaisesRegex(ValueError,'Club is full'):g.call('register',{},url='https://script.google.com/macros/s/abc/exec')

if __name__=='__main__':unittest.main()
