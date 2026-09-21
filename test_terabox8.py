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

surl_match = re.search(r'surl=([a-zA-Z0-9_-]+)', final_url)
shorturl = surl_match.group(1)

js_token_match = re.search(r'fn\("([A-F0-9]+)"\)', html)
js_token = js_token_match.group(1) if js_token_match else ""

api_url = f"https://www.terabox.app/share/list?app_id=250528&web=1&channel=dubox&clienttype=0&jsToken={js_token}&shorturl={shorturl}&root=1"
req2 = urllib.request.Request(api_url, headers={
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
    'Referer': final_url,
    'Cookie': cookie_header
})
resp2 = urllib.request.urlopen(req2)
data = json.loads(resp2.read().decode('utf-8'))
share_id = data.get("share_id")
uk = data.get("uk")
first_file = data["list"][0]
fs_id = first_file["fs_id"]

thumb_url = first_file['thumbs']['url3']
parsed_thumb = urllib.parse.urlparse(thumb_url)
qs = urllib.parse.parse_qs(parsed_thumb.query)
sign = qs.get('sign', [''])[0]
timestamp = qs.get('time', [''])[0]

# Try with sign and timestamp on share/download:
dl_url = f"https://www.terabox.app/share/download?app_id=250528&web=1&channel=dubox&clienttype=0&jsToken={js_token}&shareid={share_id}&uk={uk}&fid_list=%5B{fs_id}%5D&primaryid={share_id}&sign={urllib.parse.quote(sign)}&timestamp={timestamp}"
print("Testing share/download with sign:", dl_url)
try:
    r = urllib.request.Request(dl_url, headers={
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
        'Referer': final_url,
        'Cookie': cookie_header
    })
    res = urllib.request.urlopen(r)
    print("Download response:", res.status, res.read()[:500])
except Exception as e:
    print("Download error:", e)
