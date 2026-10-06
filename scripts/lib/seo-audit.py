"""Public, identified browser-profile HTTP checks; no authentication or WAF bypass."""
import concurrent.futures
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen, build_opener, HTTPRedirectHandler

CLIENT_PROFILE = 'Chrome-compatible public HTTP request; not verified Googlebot'
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-GB,en;q=0.9',
    'Accept-Encoding': 'identity',
}

class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None

def fetch(url, *, redirects=True, timeout=20, body=True):
    start = time.monotonic()
    opener = build_opener() if redirects else build_opener(NoRedirect())
    try:
        response = opener.open(Request(url, headers=HEADERS), timeout=timeout)
    except HTTPError as error:
        response = error
    except (URLError, TimeoutError, OSError) as error:
        return {'status': None, 'error': type(error).__name__, 'elapsedMs': round((time.monotonic()-start)*1000)}, b''
    with response:
        raw = response.read() if body else b''
        result = {'status': response.code, 'finalUrl': response.geturl(), 'location': response.headers.get('Location'),
                  'contentType': response.headers.get('Content-Type', ''), 'robots': response.headers.get('X-Robots-Tag', ''),
                  'cacheControl': response.headers.get('Cache-Control', ''), 'bytes': len(raw),
                  'elapsedMs': round((time.monotonic()-start)*1000)}
        return result, raw

def parallel(items, fn, workers=6):
    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
        futures = [pool.submit(fn, item) for item in items]
        for n, future in enumerate(concurrent.futures.as_completed(futures), 1):
            results.append(future.result())
            if n == 1 or n % 50 == 0 or n == len(items):
                print(f'Checked {n}/{len(items)}', flush=True)
    return results
