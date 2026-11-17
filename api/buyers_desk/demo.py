"""One command for the trial: start the app, seed synthetic data through its own API, and keep it
running. `make demo` resets the database first."""
import threading
import time

import httpx2 as httpx
import uvicorn

from buyers_desk.app import create_app
from buyers_desk.seed import AlreadyHasData, seed

HOST, PORT = "127.0.0.1", 8000


def main() -> None:
    server = uvicorn.Server(uvicorn.Config(create_app(), host=HOST, port=PORT, log_level="warning"))
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()
    while not server.started:
        time.sleep(0.1)
    with httpx.Client(base_url=f"http://{HOST}:{PORT}", timeout=60) as client:
        try:
            print("Seeded synthetic data:", seed(client))
        except AlreadyHasData as refusal:
            print(refusal, "Showing what is there.")
    print(f"\nBuyers desk is running at http://{HOST}:{PORT}  (synthetic material only; Ctrl-C to stop)")
    try:
        thread.join()
    except KeyboardInterrupt:
        server.should_exit = True


if __name__ == "__main__":
    main()
