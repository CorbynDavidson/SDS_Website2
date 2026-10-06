#!/usr/bin/env python3
"""Capture public SDS pages and their first-party resources without rewriting copy."""
from __future__ import annotations

import argparse
import concurrent.futures
import gzip
import hashlib
import json
import mimetypes
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import unquote, urljoin, urlsplit, urlunsplit, parse_qsl, urlencode
from urllib.request import Request, urlopen

from lxml import etree, html

ROOT = Path(__file__).resolve().parents[1]
ORIGIN = 'https://www.sds-solicitors.com'
HOSTS = {'www.sds-solicitors.com', 'sds-solicitors.com'}
AGENT = 'Mozilla/5.0 (compatible; SDSMigration/1.0; public content preservation)'
PAGE_DIR = ROOT / 'migration' / 'source-pages'
ASSET_DIR = ROOT / 'public'
MAX_BYTES = 15 * 1024 * 1024


def stamp():
    return datetime.now(timezone.utc).isoformat()


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def canonical_url(url):
    value = urlsplit(urljoin(ORIGIN + '/', url))
    if value.hostname not in HOSTS:
        return None
    # Preserve path case and trailing slash; remove ephemeral cache query strings.
    query = urlencode([(k, v) for k, v in parse_qsl(value.query) if k.startswith('ccm_paging_p')])
    return urlunsplit(('https', 'www.sds-solicitors.com', value.path or '/', query, ''))


def safe_asset_path(url):
    path = unquote(urlsplit(url).path)
    if '..' in path.split('/') or '\\' in path or not path.startswith('/'):
        raise ValueError('Unsafe resource path')
    return ASSET_DIR / path.lstrip('/')


def retrieve(url):
    for attempt in range(3):
        try:
            request = Request(url, headers={'User-Agent': AGENT, 'Accept': '*/*'})
            with urlopen(request, timeout=35) as response:
                data = response.read(MAX_BYTES + 1)
                if len(data) > MAX_BYTES:
                    raise ValueError('Resource exceeds 15 MiB capture limit')
                return {'url': url, 'final_url': response.geturl(), 'status': response.status,
                        'content_type': response.headers.get('Content-Type', ''),
                        'captured_at': stamp(), 'sha256': hashlib.sha256(data).hexdigest(), 'data': data}
        except HTTPError as error:
            if error.code in {429, 500, 502, 503, 504} and attempt < 2:
                time.sleep(1 + attempt)
                continue
            return {'url': url, 'status': error.code, 'captured_at': stamp(), 'error': str(error)}
        except Exception as error:
            if attempt < 2:
                time.sleep(1 + attempt)
                continue
            return {'url': url, 'status': 0, 'captured_at': stamp(), 'error': str(error)}


def visible_text(root):
    clone = html.fromstring(html.tostring(root, encoding='unicode'))
    for element in clone.xpath('//script|//style|//noscript|//template'):
        element.drop_tree()
    return re.sub(r'\s+', ' ', clone.text_content()).strip()


def describe_page(result):
    raw = result['data']
    tree = html.document_fromstring(raw, base_url=result['final_url'])
    body = tree.find('body')
    head = tree.find('head')
    metadata = {
        'title': ''.join(tree.xpath('//title/text()')),
        'meta': [dict(element.attrib) for element in tree.xpath('//head/meta')],
        'links': [dict(element.attrib) for element in tree.xpath('//head/link')
                  if any(x in element.get('rel', '').lower().split() for x in ['canonical', 'alternate', 'icon', 'apple-touch-icon', 'manifest'])],
        'structured_data': [element.text or '' for element in tree.xpath('//script[@type="application/ld+json"]')],
        'headings': [{'tag': element.tag, 'text': re.sub(r'\s+', ' ', element.text_content()).strip()}
                     for element in tree.xpath('//h1|//h2|//h3|//h4|//h5|//h6')],
    }
    resources = set()
    for element in tree.xpath('//*[@src or @href or @srcset or @style or @poster or @*[local-name()="href"]] | //head/meta | //style'):
        values = []
        if element.tag in {'img', 'script', 'iframe', 'source', 'video', 'audio', 'input'}:
            values.extend([element.get('src'), element.get('poster')])
        if element.tag == 'link' and any(x in element.get('rel', '').lower() for x in ['stylesheet', 'icon', 'manifest']):
            values.append(element.get('href'))
        if element.tag == 'use':
            values.append(element.get('href') or element.get('{http://www.w3.org/1999/xlink}href'))
        if element.tag == 'meta' and re.search('image', element.get('property', '') + element.get('name', ''), re.I):
            values.append(element.get('content'))
        if element.tag == 'style':
            values.extend(re.findall(r'url\(\s*[\"\']?([^\)\"\']+)', element.text or ''))
        if element.tag == 'a' and re.search(r'\.(?:pdf|docx?|xlsx?|csv|zip|jpg|jpeg|png|webp|svg)(?:[?#]|$)', element.get('href', ''), re.I):
            values.append(element.get('href'))
        values.extend(item.strip().split(' ')[0] for item in element.get('srcset', '').split(',') if item.strip())
        values.extend(re.findall(r'url\([\"\']?([^\)\"\']+)', element.get('style', '')))
        for value in values:
            if not value or value.startswith(('data:', '#')):
                continue
            url = canonical_url(urljoin(result['final_url'], value))
            if url:
                resources.add(url)
    links = {url for element in tree.xpath('//a[@href]')
             if (url := canonical_url(urljoin(result['final_url'], element.get('href'))))}
    forms = []
    for form in tree.xpath('//form'):
        controls = []
        for element in form.xpath('.//input|.//textarea|.//select'):
            if element.get('type') == 'hidden' or element.get('name') == 'hnpt':
                continue
            labels = tree.xpath('//label[@for=$id]', id=element.get('id', ''))
            controls.append({'tag': element.tag, 'name': element.get('name'), 'id': element.get('id'),
                             'type': element.get('type'), 'label': ' '.join(e.text_content().strip() for e in labels),
                             'required': element.get('required') is not None,
                             'options': [{'value': e.get('value'), 'text': e.text_content()} for e in element.xpath('./option')]})
        forms.append({'action': form.get('action'), 'method': form.get('method', 'get'), 'controls': controls})
    digest = hashlib.sha256(result['url'].encode()).hexdigest()[:24]
    target = PAGE_DIR / (digest + '.html.gz')
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(gzip.compress(raw, mtime=0))
    text = visible_text(body)
    return {key: value for key, value in result.items() if key != 'data'} | {
        'path': urlsplit(result['url']).path or '/', 'source_file': str(target.relative_to(ROOT)),
        'metadata': metadata, 'body_text_sha256': hashlib.sha256(text.encode()).hexdigest(),
        'body_text_length': len(text), 'forms': forms, 'resources': sorted(resources), 'internal_links': sorted(links),
    }


def capture_page(url):
    result = retrieve(url)
    if result.get('status') == 200 and 'html' in result.get('content_type', ''):
        try:
            return describe_page(result)
        except Exception as error:
            result['error'] = f'Parse error: {error}'
    return {key: value for key, value in result.items() if key != 'data'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--workers', type=int, default=4)
    parser.add_argument('--max-discovered-pages', type=int, default=100)
    parser.add_argument('--skip-assets', action='store_true')
    parser.add_argument('--resources-only', action='store_true', help='Reuse captured pages and media; supplement resource discovery and pagination.')
    args = parser.parse_args()
    started = stamp()
    print('Retrieving original sitemap and robots...', flush=True)
    sitemap = retrieve(ORIGIN + '/sitemap.xml')
    robots = retrieve(ORIGIN + '/robots.txt')
    if sitemap.get('status') != 200 or 'data' not in sitemap:
        raise SystemExit('Cannot establish authoritative sitemap: ' + str(sitemap.get('error')))
    source_dir = ROOT / 'migration'
    source_dir.mkdir(exist_ok=True)
    (source_dir / 'original-sitemap.xml').write_bytes(sitemap['data'])
    if 'data' in robots:
        (source_dir / 'original-robots.txt').write_bytes(robots['data'])
    xml = etree.fromstring(sitemap['data'])
    seeds = sorted({canonical_url(url) for url in xml.xpath('//*[local-name()="loc"]/text()') if canonical_url(url)})
    print(f'Sitemap contains {len(seeds)} URLs.', flush=True)
    previous = json.loads((source_dir / 'source-manifest.json').read_text()) if args.resources_only else None
    pages = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, min(args.workers, 6))) as pool:
        if previous:
            page_iterator = (describe_page(p | {'data': gzip.decompress((ROOT / p['source_file']).read_bytes())}) if p.get('source_file') else p for p in previous['pages'])
        else:
            page_iterator = pool.map(capture_page, seeds)
        for index, page in enumerate(page_iterator, 1):
            pages.append(page)
            if index % 10 == 0 or page.get('error'):
                print(f'Pages {index}/{len(seeds)}; latest {page["status"]} {page["url"]}', flush=True)
                write_json(source_dir / 'capture-progress.json', {'started_at': started, 'pages': pages})
        known = {p['url'] for p in pages}
        discovered = sorted({link for p in pages for link in p.get('internal_links', []) if link not in known
                             and not re.search(r'\.(?:pdf|docx?|xlsx?|csv|zip|jpg|jpeg|png|webp|svg|css|js)$', urlsplit(link).path, re.I)
                             and not re.search(r'^/(?:index\.php|login|logout|dashboard|submit|ccm|application|concrete|packages)(?:/|$)', urlsplit(link).path)})
        if len(discovered) > args.max_discovered_pages:
            write_json(source_dir / 'unvisited-discovered-urls.json', discovered[args.max_discovered_pages:])
        for page in pool.map(capture_page, discovered[:args.max_discovered_pages]):
            pages.append(page)
            print(f'Discovered {page["status"]} {page["url"]}', flush=True)
        # Pagination links may appear only on the next listing page.
        while len(discovered) < args.max_discovered_pages:
            known = {p['url'] for p in pages}
            more = sorted({link for p in pages for link in p.get('internal_links', []) if link not in known
                           and not re.search(r'\.(?:pdf|docx?|xlsx?|csv|zip|jpg|jpeg|png|webp|svg|css|js)$', urlsplit(link).path, re.I)
                           and not re.search(r'^/(?:index\.php|login|logout|dashboard|submit|ccm|application|concrete|packages)(?:/|$)', urlsplit(link).path)})
            if not more:
                break
            allowance = args.max_discovered_pages - len(discovered)
            discovered.extend(more)
            for page in pool.map(capture_page, more[:allowance]):
                pages.append(page)
                print(f'Discovered {page["status"]} {page["url"]}', flush=True)
    assets = list(previous['assets']) if previous else []
    pending = {url for p in pages for url in p.get('resources', [])}
    seen = {a['url'] for a in assets}
    for a in assets:
        if a.get('file') and a['file'].endswith('.css'):
            css = (ROOT / a['file']).read_text(errors='replace')
            for value in re.findall(r'url\(\s*[\"\']?([^\)\"\']+)', css):
                url = canonical_url(urljoin(a['url'], value.strip()))
                if url and url not in seen:
                    pending.add(url)
    if not args.skip_assets:
        with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, min(args.workers, 6))) as pool:
            while pending:
                batch = sorted(pending - seen)
                if not batch:
                    break
                seen.update(batch)
                pending = set()
                for index, result in enumerate(pool.map(retrieve, batch), 1):
                    if result.get('status') == 200 and 'data' in result:
                        destination = safe_asset_path(result['url'])
                        destination.parent.mkdir(parents=True, exist_ok=True)
                        destination.write_bytes(result['data'])
                        result['file'] = str(destination.relative_to(ROOT))
                        result['bytes'] = len(result['data'])
                        if 'text/css' in result.get('content_type', '') or destination.suffix == '.css':
                            css = result['data'].decode('utf-8', errors='replace')
                            values = re.findall(r'url\(\s*[\"\']?([^\)\"\']+)', css)
                            values += re.findall(r'@import\s+[\"\']([^\"\']+)', css)
                            for value in values:
                                url = canonical_url(urljoin(result['url'], value.strip()))
                                if url and url not in seen:
                                    pending.add(url)
                    assets.append({key: value for key, value in result.items() if key != 'data'})
                    if index % 20 == 0 or result.get('error'):
                        print(f'Assets batch {index}/{len(batch)}; total {len(assets)}', flush=True)
    failures = [p for p in pages if p.get('error') or not p.get('source_file')]
    asset_failures = [a for a in assets if not a.get('file')]
    manifest = {'format_version': 1, 'source_origin': ORIGIN, 'started_at': started, 'completed_at': stamp(),
                'sitemap_url_count': len(seeds), 'sitemap_sha256': sitemap['sha256'],
                'pages': pages, 'assets': assets, 'complete': not failures and not asset_failures
                and len(discovered) <= args.max_discovered_pages,
                'unresolved_pages': len(failures), 'unresolved_assets': len(asset_failures)}
    write_json(source_dir / 'source-manifest.json', manifest)
    write_json(ROOT / 'docs/migration/source-inventory.json', {
        'source_origin': ORIGIN, 'captured_at': manifest['completed_at'], 'sitemap_pages': len(seeds),
        'captured_pages': len(pages) - len(failures), 'discovered_pages': len(pages) - len(seeds),
        'captured_assets': len(assets) - len(asset_failures), 'asset_bytes': sum(a.get('bytes', 0) for a in assets),
        'unresolved_pages': failures, 'unresolved_assets': asset_failures, 'complete': manifest['complete']})
    print(json.dumps({key: manifest[key] for key in ['complete', 'sitemap_url_count', 'unresolved_pages', 'unresolved_assets']}))


if __name__ == '__main__':
    main()
