#!/usr/bin/env python3
"""Read-only primary-domain verification after cutover; exits nonzero until the new release is served."""
import hashlib
import importlib.util
import json
from datetime import datetime,timezone
from pathlib import Path
root=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('http',root/'scripts/lib/seo-audit.py')
http=importlib.util.module_from_spec(spec);spec.loader.exec_module(http)
origin='https://www.sds-solicitors.com'
checks=[]
for url in ['http://sds-solicitors.com/','http://www.sds-solicitors.com/','https://sds-solicitors.com/',origin+'/']:
    measured,_=http.fetch(url,redirects=False,body=False)
    good=(measured['status']==200 and 'noindex' not in measured.get('robots','')) if url==origin+'/' else measured['status']==301 and measured.get('location')==origin+'/'
    checks.append({'url':url,**measured,'verified':good})
for path,source in [('/robots.txt','public/robots.txt'),('/sitemap.xml','public/sitemap.xml')]:
    measured,raw=http.fetch(origin+path,redirects=False)
    checks.append({'url':origin+path,**measured,'sha256':hashlib.sha256(raw).hexdigest(),'verified':measured['status']==200 and raw==(root/source).read_bytes() and 'noindex' not in measured.get('robots','')})
measured,raw=http.fetch('https://housingconditionclaims.org/robots.txt',redirects=False)
checks.append({'url':'https://housingconditionclaims.org/robots.txt',**measured,'verified':measured['status']==200 and raw==b'User-agent: *\nDisallow: /\n'})
report={'checkedAt':datetime.now(timezone.utc).isoformat(),'clientProfile':http.CLIENT_PROFILE,'allVerified':all(x['verified'] for x in checks),'checks':checks,'verifiedGooglebot':False,'limitation':'Use this with active provider TLS/domain statuses and Search Console live URL inspection. Matching robots/sitemap alone does not verify Googlebot or field rankings.'}
output=root/'build/production-domain-verification.json';output.write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2));raise SystemExit(0 if report['allVerified'] else 1)
