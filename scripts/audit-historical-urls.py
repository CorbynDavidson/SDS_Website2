#!/usr/bin/env python3
"""Reconcile public archive URLs and optional private CSV exports without publishing account data."""
import argparse
import csv
import hashlib
import importlib.util
import json
import re
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('seo_audit', ROOT/'scripts/lib/seo-audit.py')
http = importlib.util.module_from_spec(spec)
spec.loader.exec_module(http)
ORIGIN = 'https://www.sds-solicitors.com'
PRIVATE = re.compile(r'^/(?:api|submissions|editor|staging|preview|_preview|build|wp-admin|wp-login|wp-json|xmlrpc|dashboard|admin)(?:[/.]|$)', re.I)
SYSTEM = re.compile(r'(?:/feed/?$|/(?:author|category|tag)/|/(?:wp-content|wp-includes|packages|application|concrete)/|\.(?:css|js|png|jpe?g|gif|svg|webp|ico|pdf|xml|txt|woff2?|zip|php)$)', re.I)

def public_path(value):
    """Drop credentials, query secrets, system routes and unrelated hosts before any report."""
    value = value.strip()
    if value.startswith('/'):
        value = ORIGIN+value
    try:
        u = urlsplit(value)
    except ValueError:
        return None, 'invalid'
    if u.scheme not in ('http', 'https') or u.hostname not in ('sds-solicitors.com', 'www.sds-solicitors.com') or u.username or u.password:
        return None, 'other-host-or-invalid'
    path = u.path or '/'
    if PRIVATE.search(path) or SYSTEM.search(path):
        return None, 'private-or-system'
    # Wordfence scans and application actions are not public content URL evidence.
    query = parse_qsl(u.query, keep_blank_values=True)
    if any(k.lower() in ('wordfence_lh', 'wf_log', 'action', 'download', 'edit', 'token', 'email', 'password') for k,v in query):
        return None, 'private-or-system-query'
    keep = [(k,v) for k,v in query if re.fullmatch(r'(?:p|page_id|ccm_paging_p_b\d+)', k) and v.isdigit()]
    return path+('?' + urlencode(keep) if keep else ''), None

def csv_paths(filename):
    """Read common GSC, GA4, backlink and URL/log CSV headers, retaining only eligible URL paths."""
    with open(filename, encoding='utf-8-sig', newline='') as source:
        rows = csv.DictReader(source)
        fields = [f for f in (rows.fieldnames or []) if re.sub(r'[^a-z]', '', f.lower()) in (
            'url', 'page', 'toppages', 'landingpage', 'landingpagequerystring', 'landingpagequerystring',
            'targeturl', 'target', 'address', 'requesturl', 'original')]
        if not fields:
            raise ValueError('CSV must contain a URL/Page/Landing page/Target URL/Request URL column')
        for row in rows:
            for field in fields:
                yield row.get(field) or ''

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--archive', default='build/historical-cdx.json')
    parser.add_argument('--private-export', action='append', default=[], metavar='KIND=CSV', help='gsc, analytics, backlinks, redirects or logs; local-only outputs required')
    parser.add_argument('--live', action='store_true')
    parser.add_argument('--output', default='build/historical-url-audit.json')
    args = parser.parse_args()
    output = (ROOT/args.output).resolve()
    if args.private_export and not output.is_relative_to(ROOT/'.data'):
        raise SystemExit('Private export reconciliation must be written under ignored .data/. Review and select public redirect rules separately.')
    raw = (ROOT/args.archive).read_bytes()
    rows = json.loads(raw)[1:]
    found = {}
    excluded = Counter()
    for timestamp, original in rows:
        path, reason = public_path(original)
        if not path:
            excluded[reason]+=1
            continue
        entry = found.setdefault(path, {'path': path, 'sources': ['public-wayback'], 'firstPublicCapture': timestamp})
        entry['firstPublicCapture'] = min(entry['firstPublicCapture'], timestamp)
    categories = []
    for item in args.private_export:
        kind, filename = item.split('=',1)
        if kind not in ('gsc','analytics','backlinks','redirects','logs'):
            raise SystemExit('Unknown export kind')
        categories.append(kind)
        for value in csv_paths(filename):
            path, reason = public_path(value)
            if not path:
                excluded[reason]+=1
                continue
            entry=found.setdefault(path, {'path': path, 'sources': []})
            if kind not in entry['sources']:
                entry['sources'].append(kind)
    if args.live:
        def check(entry):
            measurement,_ = http.fetch(ORIGIN+entry['path'], redirects=False, body=False)
            return {**entry, 'liveOriginal': measurement}
        entries=http.parallel(list(found.values()),check)
    else:
        entries=list(found.values())
    report={'checkedAt':datetime.now(timezone.utc).isoformat(), 'clientProfile':http.CLIENT_PROFILE,
            'archiveSource':'https://web.archive.org/cdx/search/cdx?url=sds-solicitors.com&matchType=domain&output=json&filter=statuscode:200&filter=mimetype:text/html&collapse=urlkey&fl=timestamp,original&limit=2000',
            'archiveSha256':hashlib.sha256(raw).hexdigest(), 'archiveRecords':len(rows),
            'archiveLimit':2000, 'archiveLimitReached':len(rows)>=2000, 'earliestCapture':min(r[0] for r in rows),
            'latestCapture':max(r[0] for r in rows), 'eligiblePublicPaths':len(entries), 'excludedRecords':dict(excluded),
            'privateEvidenceKindsImported':sorted(set(categories)), 'historicalInventoryComplete':False,
            'remainingEvidence':['Search Console indexed/performance URLs','analytics landing pages','backlink targets','old redirect configuration','historical request URLs'],
            'limitations':['Wayback capture is incomplete and is not a complete 25-year backlink/indexed inventory.', 'Archive membership alone does not justify a redirect or restoring discontinued service copy.'],
            'urls':sorted(entries,key=lambda e:e['path'])}
    output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({k:v for k,v in report.items() if k!='urls'}),flush=True)

if __name__=='__main__':
    main()
