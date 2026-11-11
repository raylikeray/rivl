# a static server for the tests, in-process: starts on import if nothing already answers on 8777
import threading, http.server, socketserver, functools, urllib.request, os
def _up():
    try: urllib.request.urlopen('http://127.0.0.1:8777/rivl/index.html', timeout=1); return True
    except Exception: return False
if not _up():
    _root = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..'))   # the folder that holds the repo; the repo folder must be named rivl
    H = functools.partial(http.server.SimpleHTTPRequestHandler, directory=_root)
    class Q(socketserver.ThreadingTCPServer): allow_reuse_address = True; daemon_threads = True
    H.log_message = lambda *a, **k: None
    _s = Q(('127.0.0.1', 8777), H); threading.Thread(target=_s.serve_forever, daemon=True).start()
