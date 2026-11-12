"""Local test server: python3 serve.py [port], then open http://localhost:8123

Python's built-in `python3 -m http.server` can hang on some Macs while doing a DNS lookup,
so this skips that step.
"""
import functools
import http.server
import os
import sys


class Server(http.server.ThreadingHTTPServer):
    def server_bind(self):
        self.socket.bind(self.server_address)
        self.server_name, self.server_port = 'localhost', self.server_address[1]


port = int(sys.argv[1]) if len(sys.argv) > 1 else 8123
handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=os.path.dirname(os.path.abspath(__file__)))
print(f'LevelUp running at http://localhost:{port}', flush=True)
Server(('', port), handler).serve_forever()
