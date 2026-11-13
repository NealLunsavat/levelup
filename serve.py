"""Local test server: python3 serve.py [port], then open http://localhost:8123

Python's built-in `python3 -m http.server` can hang on some Macs while doing a DNS lookup,
so this skips that step.
"""
import functools
import http.server
import os
import socket
import sys


class Server(http.server.ThreadingHTTPServer):
    def server_bind(self):
        # Let the port be reused right after a restart.
        self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.socket.bind(self.server_address)
        self.server_name, self.server_port = 'localhost', self.server_address[1]


class Handler(http.server.SimpleHTTPRequestHandler):
    # Never cache while developing, so edits always show up on reload.
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


port = int(sys.argv[1]) if len(sys.argv) > 1 else 8123
handler = functools.partial(Handler, directory=os.path.dirname(os.path.abspath(__file__)))
print(f'LevelUp running at http://localhost:{port}', flush=True)
Server(('', port), handler).serve_forever()
