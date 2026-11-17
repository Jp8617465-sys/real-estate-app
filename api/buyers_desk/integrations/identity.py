"""Identity checks for customer identification (buyers agents have been AML/CTF reporting entities since
1 July 2026). The rules and provider are unresolved, so the synthetic adapter only shows the shape of a
result: a status, a reference and evidence. It must never be read as a real check."""
import hashlib
from typing import Protocol, runtime_checkable

from buyers_desk.integrations.models import CheckResult, IntegrationInfo


@runtime_checkable
class IdentityCheckPort(Protocol):
    def info(self) -> IntegrationInfo: ...
    def start_check(self, name: str, kind: str) -> CheckResult: ...


class SyntheticIdentityCheck:
    def info(self) -> IntegrationInfo:
        return IntegrationInfo(
            port="identity_check", adapter="synthetic identity check", synthetic=True, live=False,
            description="Synthetic only: shows the shape of a check result. No identity provider is selected and no real check is made.",
        )

    def start_check(self, name: str, kind: str) -> CheckResult:
        low = name.lower()
        status = "failed" if "fail" in low else "needs_review" if "refer" in low else "passed"
        reference = "SYN-" + hashlib.sha256(f"{kind}:{name}".encode()).hexdigest()[:10].upper()
        evidence = [
            "Synthetic check: no real provider was contacted and no document was examined.",
            {"passed": "The synthetic rule found nothing to flag.", "needs_review": "The synthetic rule asked for a person to review.", "failed": "The synthetic rule failed this name on purpose."}[status],
        ]
        return CheckResult(kind=kind, status=status, provider="synthetic", reference=reference, evidence=evidence, synthetic=True)  # type: ignore[arg-type]
