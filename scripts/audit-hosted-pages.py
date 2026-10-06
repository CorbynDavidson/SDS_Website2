#!/usr/bin/env python3
"""Check every public page against the exact compiled review response and crawl controls."""
import argparse
import hashlib
import importlib.util
import json
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote

root=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('seo_audit',root/'scripts/lib/seo-audit.py')
http=importlib.util.module_from_spec(spec)
spec.loader.exec_module(http)
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output',default='build/hosted-pages-verification.json')
args=parser.parse_args()
expected=json.loads((root/'build/hosted-page-expectations.json').read_text())

def check(page):
    measured,raw=http.fetch(expected['origin']+quote(page['path'],safe='/?=&%'),redirects=False)
    digest=hashlib.sha256(raw).hexdigest()
    return {'path':page['path'],**measured,'sha256':digest,'expectedSha256':page['sha256'],
            'verified':measured['status']==page['status'] and (digest==page['sha256'] if page['status']==200 else measured.get('location')==page.get('location')) and measured.get('robots')==page['robots']}

pages=http.parallel(expected['pages'],check)
controls=[]
for path in ('/robots.txt','/sitemap.xml','/seo-migration-deliberate-missing-page/'):
    measured,raw=http.fetch(expected['origin']+path,redirects=False)
    expected_robots=(root/'public/robots.txt').read_bytes() if expected.get('mode')=='production' else b'User-agent: *\nDisallow: /\n'
    check_ok=(measured['status']==200 and raw==expected_robots) if path=='/robots.txt' else (
        measured['status']==200 and raw==(root/'public/sitemap.xml').read_bytes()) if path=='/sitemap.xml' else (
        measured['status']==404 and 'noindex' in measured.get('robots',''))
    controls.append({'path':path,**measured,'sha256':hashlib.sha256(raw).hexdigest(),'verified':check_ok})
elapsed=sorted(p['elapsedMs'] for p in pages)
report={'checkedAt':datetime.now(timezone.utc).isoformat(),'origin':expected['origin'], 'clientProfile':http.CLIENT_PROFILE,
        'releaseFingerprint':expected.get('releaseFingerprint'), 'expectedPages':len(pages),
        'verifiedPages':sum(p['verified'] for p in pages),'allVerified':all(p['verified'] for p in pages+controls),
        'responseTimeMs':{'median':elapsed[len(elapsed)//2],'p95':elapsed[int(len(elapsed)*.95)],'maximum':max(elapsed)},
        'performanceLimitations':'These are HTTP request timings, not Lighthouse, throttled mobile metrics or field Core Web Vitals.',
        'verifiedGooglebot':False, 'controls':controls,'pages':sorted(pages,key=lambda p:p['path'])}
output=root/args.output
output.parent.mkdir(parents=True,exist_ok=True)
output.write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items() if k not in ('pages','controls')}),flush=True)
failures=[p for p in pages+controls if not p['verified']]
print(json.dumps({'failedPagesAndControls':len(failures),'firstFailures':failures[:3]},indent=2),flush=True)
raise SystemExit(0 if report['allVerified'] else 1)
