"""Local dev server that tells the browser to always re-check files.

The plain `python3 -m http.server` lets the browser reuse old copies, which
hides your latest changes. Serves the repository root from any folder.
Usage: python3 scripts/serve.py [port]
"""

import functools
import http.server
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()


port = 8080
if len(sys.argv) > 1:
    port = int(sys.argv[1])

handler = functools.partial(NoCacheHandler, directory=str(ROOT))
http.server.ThreadingHTTPServer(('', port), handler).serve_forever()
