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

api_url = f"https://www.terabox.app/share/list?app_id=250528&web=1&channel=dubox&clienttype=0&shorturl={shorturl}&root=1"
req2 = urllib.request.Request(api_url, headers={
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
    'Referer': final_url,
    'Cookie': cookie_header
})
resp2 = urllib.request.urlopen(req2)
data = json.loads(resp2.read().decode('utf-8'))
print("Keys in response:", list(data.keys()))
for k in ["uk", "shareid", "sign", "timestamp", "title"]:
    print(k, ":", data.get(k))

if data.get("list"):
    first = data["list"][0]
    print("First item keys:", list(first.keys()))
    print("filename:", first.get("server_filename"))
    print("size:", first.get("size"))
    print("dlink:", first.get("dlink"))
