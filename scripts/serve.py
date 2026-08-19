#!/usr/bin/env python3
"""Serve the static web app and open it in the browser."""

from __future__ import annotations

import http.server
import os
import socket
import socketserver
import sys
import webbrowser

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
WEB = os.path.join(ROOT, "web")
DATA = os.path.join(WEB, "data", "app-data.json")
START_PORT = 8765


def ensure_data() -> None:
    if os.path.exists(DATA) and os.path.getsize(DATA) > 1000:
        return
    print("Data file missing — building it first…")
    sys.path.insert(0, os.path.dirname(__file__))
    import build_data

    build_data.main()


def pick_port(start: int) -> int:
    for port in range(start, start + 20):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            try:
                sock.bind(("127.0.0.1", port))
            except OSError:
                continue
            return port
    raise RuntimeError("No free port in 8765–8784")


def main() -> int:
    ensure_data()
    os.chdir(WEB)
    port = pick_port(START_PORT)

    class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
        def end_headers(self):
            self.send_header("Cache-Control", "no-store")
            super().end_headers()

    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("127.0.0.1", port), NoCacheHandler) as httpd:
        url = f"http://127.0.0.1:{port}/"
        print(f"方舟幹員資料終端 running at {url}")
        print("Press Ctrl+C to stop.")
        try:
            webbrowser.open(url)
        except Exception:
            pass
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nStopped.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
