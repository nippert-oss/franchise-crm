import re
import sys

def extract_js(html):
    matches = re.finditer(r'<script>(.*?)</script>', html, re.DOTALL)
    for m in matches:
        return m.group(1)
    return ""

with open("index.html", "r", encoding="utf-8") as f:
    html = f.read()

js = extract_js(html)
with open("test.js", "w", encoding="utf-8") as f:
    f.write(js)

print("Extracted JS to test.js")
