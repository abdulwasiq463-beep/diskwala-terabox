import urllib.request
import re
import urllib.parse
import json

url = 'https://teraboxlink.com/s/1DAl-MoEEm0pWq-a99E0q6A'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0'})
resp = urllib.request.urlopen(req)
html = resp.read().decode('utf-8', errors='ignore')
final_url = resp.geturl()
print('Final URL:', final_url)

for m in re.findall(r'decodeURIComponent\(`([^`]+)`\)', html):
    print('Decoded eval:', urllib.parse.unquote(m))

for m in re.findall(r'window\.[a-zA-Z0-9_]+\s*=\s*[^;]+;', html):
    print('Window var:', m[:150])
