#!/usr/bin/env python3
"""Capture only verified live content gaps, preserving the original capture unchanged."""
import hashlib
import importlib.util
import json
from datetime import datetime,timezone
from pathlib import Path

root=Path(__file__).resolve().parents[1]
def module(name,path):
    spec=importlib.util.spec_from_file_location(name,root/path)
    value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
http=module('seo_http','scripts/lib/seo-audit.py')
capture=module('source_capture','scripts/capture-sds.py')
capture.PAGE_DIR=root/'migration/supplemental-original/pages'
origin='https://www.sds-solicitors.com'
audit=json.loads((root/'build/historical-route-reconciliation.json').read_text())
supplemental_path=root/'migration/supplemental-source-manifest.json'
supplemental=json.loads(supplemental_path.read_text()) if supplemental_path.exists() else {'pages':[],'assets':[]}
captured_urls={p['url'] for p in supplemental['pages'] if p.get('source_file')}
paths=[e['path'] for e in audit['urls'] if e['disposition']=='live-content-gap-needs-review' and origin+e['path'] not in captured_urls]

def page(path):
    url=origin+path;measured,raw=http.fetch(url,redirects=False,timeout=30)
    record={'url':url,'final_url':measured.get('finalUrl',url),'status':measured['status'],
            'content_type':measured.get('contentType',''),'captured_at':datetime.now(timezone.utc).isoformat(),
            'sha256':hashlib.sha256(raw).hexdigest(),'bytes':len(raw)}
    if measured['status']!=200 or 'html' not in record['content_type']:
        return {**record,'error':'Live content gap could not be captured'}
    return capture.describe_page({**record,'data':raw})

pages=http.parallel(paths,page,workers=4)
existing=json.loads((root/'migration/source-manifest.json').read_text())
existing_resources={a['url'] for a in [*existing['assets'],*supplemental['assets']]}
resources=sorted({url for p in pages for url in p.get('resources',[]) if url not in existing_resources})
assets=[]
for url in resources:
    measured,raw=http.fetch(url,timeout=30)
    entry={'url':url,'final_url':measured.get('finalUrl',url),'status':measured['status'],
           'content_type':measured.get('contentType',''),'captured_at':datetime.now(timezone.utc).isoformat(),
           'sha256':hashlib.sha256(raw).hexdigest(),'bytes':len(raw)}
    if measured['status']==200:
        # Resources use their already public original path, and cannot overwrite
        # an immutable captured asset because existing URLs were excluded.
        from urllib.parse import urlsplit
        path=urlsplit(url).path
        destination=root/('public'+path)
        if destination.exists() and hashlib.sha256(destination.read_bytes()).hexdigest()!=entry['sha256']:
            raise SystemExit('Refusing to overwrite an existing original asset')
        destination.parent.mkdir(parents=True,exist_ok=True);destination.write_bytes(raw)
        entry['file']=str(destination.relative_to(root))
    assets.append(entry)
combined_pages={p['url']:p for p in [*supplemental['pages'],*pages]}
combined_assets={a['url']:a for a in [*supplemental['assets'],*assets]}
manifest={'source_origin':origin,'completed_at':datetime.now(timezone.utc).isoformat(),
          'source':'Verified current live 200 URLs discovered by the public historic URL audit',
          'originalCaptureUnchanged':True,'pages':sorted(combined_pages.values(),key=lambda p:p['url']),'assets':list(combined_assets.values())}
supplemental_path.write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps({'requestedPages':len(paths),'capturedPages':sum(bool(p.get('source_file')) for p in pages),'newResources':len(assets),'failedPaths':[p['url'] for p in pages if not p.get('source_file')]}),flush=True)
raise SystemExit(0 if all(p.get('source_file') for p in pages) else 1)
