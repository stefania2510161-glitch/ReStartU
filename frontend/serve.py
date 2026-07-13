from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
import os

PORT = int(os.environ.get("PORT", "8001"))
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

if __name__ == "__main__":
    with ThreadingHTTPServer(("127.0.0.1", PORT), Handler) as httpd:
        print(f"Serving ReStartU frontend at http://127.0.0.1:{PORT}")
        httpd.serve_forever()
