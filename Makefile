.PHONY: check
check:
	python3 scripts/upstream_skills.py verify
	python3 scripts/check_factory.py
