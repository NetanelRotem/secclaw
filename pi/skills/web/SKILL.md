---
name: web
description: Search the web and read web pages with curl. Use when the answer needs current information, a URL is given, or you need to look something up online.
---

# Web

Search (DuckDuckGo HTML, no API key):

```bash
curl -sL "https://html.duckduckgo.com/html/?q=$(printf %s "QUERY" | jq -sRr @uri)" -A "Mozilla/5.0" \
  | grep -oE 'class="result__a" href="[^"]+"[^>]*>[^<]+' | sed -E 's/.*href="([^"]+)"[^>]*>/\1  /' | head -10
```

Read a page as text:

```bash
curl -sL "URL" -A "Mozilla/5.0" | sed -e 's/<script.*<\/script>//g' -e 's/<[^>]*>//g' | tr -s ' \n' | head -c 20000
```

APIs that return JSON: use `curl -s URL | jq`.

Cite the URLs you used.
