#!/usr/bin/env python3
"""Package the tested Worker and stable client snapshot, verify each archive byte and reject static bypass routes."""
import hashlib
import json
import sys
import tarfile
from pathlib import Path
root=Path(__file__).resolve().parents[1]
archive=Path(sys.argv[1]).resolve()
data=json.loads((root/'build/data.json').read_text())
client=root/'build/deployment-client'
files={**{p:'dist/client/'+str(p.relative_to(client)) for p in client.rglob('*') if p.is_file()},
       root/'dist/server/index.js':'dist/server/index.js',root/'dist/.openai/hosting.json':'dist/.openai/hosting.json'}
blocked={'dist/client/robots.txt','dist/client/sitemap.xml',*('dist/client'+p for p,a in data['assets'].items() if a.get('storagePath'))}
if blocked.intersection(files.values()):raise SystemExit('Refusing archive with routes that bypass Worker crawl/MIME policy')
archive.parent.mkdir(parents=True,exist_ok=True)
with tarfile.open(archive,'w',format=tarfile.USTAR_FORMAT) as bundle:
    for path,name in sorted(files.items(),key=lambda i:i[1]):bundle.add(path,arcname=name)
expected={name:hashlib.sha256(path.read_bytes()).hexdigest() for path,name in files.items()}
with tarfile.open(archive,'r:') as bundle:
    actual={m.name:hashlib.sha256(bundle.extractfile(m).read()).hexdigest() for m in bundle.getmembers() if m.isfile()}
if actual!=expected:raise SystemExit('Archive differs from verified release bytes')
report={'archive':str(archive),'fileCount':len(files),'sha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'everyArchivedFileVerified':True,'staticBypassRoutesExcluded':True,'releaseFingerprint':data['releaseFingerprint']}
(root/'build/verified-release-package.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report))
