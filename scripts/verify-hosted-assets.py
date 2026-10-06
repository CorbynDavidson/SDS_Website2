#!/usr/bin/env python3
"""Compare every hosted public asset with the built release's bytes and SHA-256."""
import argparse
import concurrent.futures
import hashlib
import json
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote, urlsplit
from urllib.request import Request, urlopen

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--origin', required=True)
parser.add_argument('--output', default='build/hosted-assets-verification.json')
args = parser.parse_args()
origin = args.origin.rstrip('/')
if urlsplit(origin).scheme != 'https' or not urlsplit(origin).hostname:
    raise SystemExit('Use the explicit HTTPS deployment origin.')
assets = json.loads((root / 'build/data.json').read_text())['assets']

def verify(item):
    path, asset = item
    for attempt in range(3):
        try:
            request = Request(origin + quote(path, safe='/'), headers={'User-Agent': 'SDSMigration/1.0', 'Accept-Encoding': 'identity'})
            with urlopen(request, timeout=45) as response:
                raw = response.read()
                status = response.status
                content_type = response.headers.get('Content-Type', '').split(';')[0]
            actual = hashlib.sha256(raw).hexdigest()
            passed = status == 200 and len(raw) == asset['bytes'] and actual == asset['sha256'] and content_type == asset['type'].split(';')[0]
            return {'path': path, 'status': status, 'bytes': len(raw), 'sha256': actual, 'verified': passed}
        except Exception as error:
            if attempt == 2:
                return {'path': path, 'verified': False, 'error': type(error).__name__, 'status': getattr(error, 'code', None)}
            time.sleep(attempt + 1)

results = []
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    futures = [pool.submit(verify, item) for item in assets.items()]
    for completed, future in enumerate(concurrent.futures.as_completed(futures), 1):
        result = future.result()
        results.append(result)
        if not result['verified']:
            print(json.dumps(result), flush=True)
        if completed == 1 or completed % 25 == 0 or completed == len(assets):
            print(f'Checked hosted assets {completed}/{len(assets)}', flush=True)
report = {'reviewOrigin': origin, 'checkedAt': datetime.now(timezone.utc).isoformat(), 'expectedAssets': len(assets), 'verifiedAssets': sum(result['verified'] for result in results), 'allVerified': all(result['verified'] for result in results), 'expectedBytes': sum(asset['bytes'] for asset in assets.values()), 'assets': sorted(results, key=lambda result: result['path'])}
output = root / args.output
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps({key: value for key, value in report.items() if key != 'assets'}), flush=True)
raise SystemExit(0 if report['allVerified'] else 1)
