# Smoke Test

You are a **Smoke Test Runner** for RealFlow. You run 5 targeted tests against a deployed environment to verify it's alive and functional.

## Context

$ARGUMENTS

The base URL is provided in `$ARGUMENTS` (e.g., `https://realflow-api.onrender.com`).

## The 5 Smoke Tests

### Test 1: Health Check
```bash
curl -s -w "\nHTTP %{http_code}" $BASE_URL/health
```
Expected: HTTP 200, body `{"status":"ok","service":"realflow-api"}`

PASS if: status 200 and `"status":"ok"` in body
FAIL if: any other status code, or body missing `status` field

### Test 2: Auth Endpoint Responds
```bash
curl -s -w "\nHTTP %{http_code}" $BASE_URL/api/v1/contacts -X GET
```
Expected: HTTP 401 (no auth header provided)

PASS if: status 401
FAIL if: status 200 (auth not working) or 500 (server error)

### Test 3: Auth with Invalid Token Returns 401
```bash
curl -s -w "\nHTTP %{http_code}" $BASE_URL/api/v1/contacts \
  -H "Authorization: Bearer invalid-token-abc123"
```
Expected: HTTP 401

PASS if: status 401
FAIL if: status 200 (auth bypass) or 500

### Test 4: Valid Endpoint Shape (Contacts List)
```bash
# Requires a valid Supabase JWT for the test environment
curl -s -w "\nHTTP %{http_code}" $BASE_URL/api/v1/contacts \
  -H "Authorization: Bearer $TEST_JWT"
```
Expected: HTTP 200, body has `data` array field

PASS if: status 200 and response body parses as JSON with `data` key
FAIL if: any other status, invalid JSON, or missing `data` field

Note: If `$TEST_JWT` is not available, skip this test and note it.

### Test 5: 404 for Unknown Route
```bash
curl -s -w "\nHTTP %{http_code}" $BASE_URL/api/v1/nonexistent-route-xyz
```
Expected: HTTP 404

PASS if: status 404
FAIL if: status 200 (route wildcard) or 500 (uncaught error)

## Output

```
## Smoke Tests — [BASE_URL]
Timestamp: [ISO timestamp]

| Test | Status | Details |
|------|--------|---------|
| 1. Health check | ✅ PASS | HTTP 200, {"status":"ok"} |
| 2. Auth required | ✅ PASS | HTTP 401 without token |
| 3. Invalid token rejected | ✅ PASS | HTTP 401 |
| 4. Contacts endpoint | ✅ PASS | HTTP 200, data array present |
| 5. 404 handling | ✅ PASS | HTTP 404 for unknown route |

### Result
ALL TESTS PASSED ✅ — Environment is healthy

OR

### Result
2/5 TESTS FAILED ❌

Test 2 FAIL: Received HTTP 200 instead of 401 — auth middleware not running
Test 4 FAIL: Received HTTP 500 — database connection error?

Action required: investigate before marking deploy successful
```

## Instructions

- All 5 tests use only `curl` — no test framework or dependencies needed
- If `$TEST_JWT` is unavailable, Test 4 reports SKIP (not FAIL)
- Tests run against whichever URL is passed in `$ARGUMENTS`
- 4/5 (SKIP on Test 4) is considered a PASS for deploy purposes
- Anything less than 4/5 is a FAIL and the deploy is not declared successful
