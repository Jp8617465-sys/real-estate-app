"""Print the API's machine-readable description (OpenAPI). The front end's client is generated from it."""
import json

from buyers_desk.app import create_app

if __name__ == "__main__":
    print(json.dumps(create_app().openapi(), indent=2, sort_keys=True))
