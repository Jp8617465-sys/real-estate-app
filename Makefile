.PHONY: check prototype
check:
	python3 scripts/upstream_skills.py verify
	python3 scripts/check_factory.py

# Working hybrid. Open http://127.0.0.1:8765/buyers-desk-hybrid.html
prototype:
	python3 -m http.server 8765 --bind 127.0.0.1 --directory prototypes
