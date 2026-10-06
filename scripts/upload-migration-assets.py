#!/usr/bin/env python3
"""Seed checksum-verified public assets to a review deployment. Secret is stdin only."""
import argparse,concurrent.futures,hashlib,json,sys
from pathlib import Path
from urllib.parse import quote,urlsplit
from urllib.request import Request,urlopen
root=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--origin',required=True);args=parser.parse_args()
origin=args.origin.rstrip('/')
if urlsplit(origin).scheme!='https' or urlsplit(origin).hostname not in {'housingconditionclaims.org','www.housingconditionclaims.org'}: raise SystemExit('Use the configured HTTPS review origin.')
token=json.loads(sys.stdin.readline())['token']
data=json.loads((root/'build/data.json').read_text())
assets={path:asset for path,asset in data['assets'].items() if not asset.get('base64')}
def upload(item):
 path,asset=item;raw=(root/'public'/path.lstrip('/')).read_bytes()
 if hashlib.sha256(raw).hexdigest()!=asset['sha256']: raise ValueError('Local asset mismatch: '+path)
 url=origin+'/api/migration/assets?path='+quote(path,safe='')
 headers={'Authorization':'Bearer '+token,'Content-Type':asset['type'],'Content-Length':str(len(raw))}
 with urlopen(Request(url,headers={'Authorization':'Bearer '+token}),timeout=45) as r: status=json.loads(r.read())
 if not status.get('present'):
  with urlopen(Request(url,data=raw,headers=headers,method='PUT'),timeout=90) as r:
   result=json.loads(r.read());assert result['sha256']==asset['sha256']
 with urlopen(Request(url,headers={'Authorization':'Bearer '+token}),timeout=45) as r: assert json.loads(r.read()).get('present')
 return path
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
 for i,path in enumerate(pool.map(upload,assets.items()),1):
  if i%25==0 or i==len(assets): print(f'Verified hosted assets {i}/{len(assets)}',flush=True)
print(json.dumps({'verified_assets':len(assets),'public_asset_bytes':sum(asset['bytes'] for asset in assets.values())}))
