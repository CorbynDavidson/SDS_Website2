#!/usr/bin/env python3
"""Seed checksum-verified public assets to a review deployment. Secret is stdin only."""
import argparse,concurrent.futures,hashlib,json,sys
from pathlib import Path
from urllib.parse import quote,urlsplit
from urllib.request import Request,urlopen
from urllib.error import HTTPError
root=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--origin',required=True);parser.add_argument('--from-github',action='store_true');args=parser.parse_args()
origin=args.origin.rstrip('/')
if urlsplit(origin).scheme!='https' or urlsplit(origin).hostname not in {'housingconditionclaims.org','www.housingconditionclaims.org'}: raise SystemExit('Use the configured HTTPS review origin.')
token=json.loads(sys.stdin.readline())['token']
data=json.loads((root/'build/data.json').read_text())
assets={path:asset for path,asset in data['assets'].items() if not asset.get('base64')}
agent='SDSMigration/1.0'
if args.from_github:
 paths=list(assets)
 for start in range(0,len(paths),10):
  batch=paths[start:start+10]
  request=Request(origin+'/api/migration/assets',data=json.dumps({'paths':batch}).encode(),headers={'Authorization':'Bearer '+token,'Content-Type':'application/json','User-Agent':agent},method='POST')
  with urlopen(request,timeout=90) as r: result=json.loads(r.read())
  assert result.get('ok') and len(result['assets'])==len(batch)
  for item in result['assets']: assert item['present'] and item['sha256']==assets[item['path']]['sha256']
  completed=start+len(batch);print(f'Verified hosted assets {completed}/{len(paths)}',flush=True)
  (root/'build/asset-upload-progress.json').write_text(json.dumps({'verified_assets':completed,'total_assets':len(paths),'source_ref':result['sourceRef']}))
 print(json.dumps({'verified_assets':len(paths),'public_asset_bytes':sum(asset['bytes'] for asset in assets.values())}))
 sys.exit(0)
def upload(item):
 path,asset=item;raw=(root/'public'/path.lstrip('/')).read_bytes()
 if hashlib.sha256(raw).hexdigest()!=asset['sha256']: raise ValueError('Local asset mismatch: '+path)
 url=origin+'/api/migration/assets?path='+quote(path,safe='')
 headers={'Authorization':'Bearer '+token,'Content-Type':asset['type'],'Content-Length':str(len(raw)),'User-Agent':agent}
 with urlopen(Request(url,headers={'Authorization':'Bearer '+token,'User-Agent':agent}),timeout=45) as r: status=json.loads(r.read())
 if not status.get('present'):
  with urlopen(Request(url,data=raw,headers=headers,method='PUT'),timeout=90) as r:
   result=json.loads(r.read());assert result['sha256']==asset['sha256']
 with urlopen(Request(url,headers={'Authorization':'Bearer '+token,'User-Agent':agent}),timeout=45) as r: assert json.loads(r.read()).get('present')
 return path
pool=concurrent.futures.ThreadPoolExecutor(max_workers=4)
try:
 futures={pool.submit(upload,item):item[0] for item in assets.items()}
 for i,future in enumerate(concurrent.futures.as_completed(futures),1):
  try: path=future.result()
  except HTTPError as error:
   detail=error.read(400).decode(errors='replace')
   print(json.dumps({'asset':futures[future],'status':error.code,'error':detail}),flush=True)
   raise RuntimeError('Asset import failed; use the status above to correct the request.') from None
  if i==1 or i%25==0 or i==len(assets): print(f'Verified hosted assets {i}/{len(assets)}',flush=True)
  (root/'build/asset-upload-progress.json').write_text(json.dumps({'verified_assets':i,'total_assets':len(assets),'latest_path':path}))
finally:
 pool.shutdown(wait=True,cancel_futures=True)
print(json.dumps({'verified_assets':len(assets),'public_asset_bytes':sum(asset['bytes'] for asset in assets.values())}))
