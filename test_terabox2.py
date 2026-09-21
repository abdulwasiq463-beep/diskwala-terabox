import urllib.request
import re
import urllib.parse
import json

url = 'https://teraboxlink.com/s/1DAl-MoEEm0pWq-a99E0q6A'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0'})
resp = urllib.request.urlopen(req)
html = resp.read().decode('utf-8', errors='ignore')
final_url = resp.geturl()

cookies = resp.headers.get_all('Set-Cookie') or []
cookie_header = "; ".join([c.split(';')[0] for c in cookies])
print("Cookies:", cookie_header)

js_token_match = re.search(r'fn\("([A-F0-9]+)"\)', html)
js_token = js_token_match.group(1) if js_token_match else None
print("Extracted jsToken:", js_token)

surl_match = re.search(r'surl=([a-zA-Z0-9_-]+)', final_url)
shorturl = surl_match.group(1) if surl_match else "DAl-MoEEm0pWq-a99E0q6A"
print("shorturl:", shorturl)

# Test share/list
api_url = f"https://www.terabox.app/share/list?app_id=250528&web=1&channel=dubox&clienttype=0&jsToken={js_token}&shorturl={shorturl}&root=1"
print("Calling:", api_url)
req2 = urllib.request.Request(api_url, headers={
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
    'Referer': final_url,
    'Cookie': cookie_header
})
try:
    resp2 = urllib.request.urlopen(req2)
    data = json.loads(resp2.read().decode('utf-8'))
    print("API Response:", json.dumps(data, indent=2)[:1000])
except Exception as e:
    print("API error:", e)
