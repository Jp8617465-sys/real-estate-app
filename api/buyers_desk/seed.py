"""Seed a synthetic, Buy Well-style agency through the real product API, so a demo or trial opens on a
believable workspace. Every person, agency and property is invented (example.com addresses); the one
discovery call is the fictional transcript 03. Refuses to add to existing data: run `make reset` first."""
import sys
from datetime import date, timedelta
from pathlib import Path
from typing import Any

V1 = "/api/v1"
TESTDATA = Path(__file__).resolve().parents[2] / "testdata" / "intake-consultations"


class AlreadyHasData(Exception):
    pass


class _Api:
    def __init__(self, client: Any) -> None:
        self.client = client
        self.counts = {"people": 0, "households": 0, "engagements": 0, "properties": 0, "tasks": 0}

    def call(self, method: str, path: str, ok: tuple[int, ...] = (200, 201), **kw: Any) -> Any:
        response = getattr(self.client, method)(f"{V1}{path}", **kw)
        if response.status_code not in ok:
            raise RuntimeError(f"{method.upper()} {path} -> {response.status_code}: {response.text[:300]}")
        return response.json()

    def person(self, name: str, email: str | None, mobile: str) -> str:
        self.counts["people"] += 1
        return str(self.call("post", "/people", json={"name": name, "email": email, "mobile": mobile})["id"])

    def household(self, name: str, *members: str) -> str:
        self.counts["households"] += 1
        return str(self.call("post", "/households", json={"name": name, "member_ids": list(members)})["id"])

    def opportunity(self, household: str, budget: int | None, stage: str = "enquiry", reason: str | None = None) -> str:
        self.counts["engagements"] += 1
        eid = str(self.call("post", f"/households/{household}/opportunities", json={"budget_aud": budget})["id"])
        if stage != "enquiry":
            self.call("post", f"/engagements/{eid}/stage", json={"stage": stage, "reason": reason})
        return eid

    def brief(self, eid: str, **values: Any) -> None:
        for field, value in values.items():
            if isinstance(value, list):
                for v in value:
                    self.call("post", f"/engagements/{eid}/brief/{field}/values", json={"value": v})
            elif isinstance(value, tuple):
                self.call("put", f"/engagements/{eid}/brief/{field}", json={"value": value[1], "subject": value[0]})
            else:
                self.call("put", f"/engagements/{eid}/brief/{field}", json={"value": value})

    def prop(self, eid: str, address: str, suburb: str, status: str, *, beds: int | None = None, low: int | None = None, high: int | None = None, assessment: str | None = None, checks: dict[str, str] | None = None) -> None:
        self.counts["properties"] += 1
        found = self.call("get", "/properties", params={"q": address})
        existing = next((p for p in found if p["address_line"] == address and p["suburb"] == suburb), None)
        pid = existing["id"] if existing else self.call("post", "/properties", json={"address_line": address, "suburb": suburb, "bedrooms": beds, "price_guide_low": low, "price_guide_high": high})["id"]
        link = self.call("post", f"/engagements/{eid}/properties", json={"property_id": pid, "status": status})
        if assessment:
            self.call("patch", f"/engagements/{eid}/properties/{link['id']}", json={"assessment": assessment})
        for criterion, result in (checks or {}).items():
            self.call("put", f"/engagements/{eid}/properties/{link['id']}/checks", json={"criterion": criterion, "result": result})

    def task(self, eid: str | None, title: str, owner: str, days: int | None, done: bool = False) -> None:
        self.counts["tasks"] += 1
        due = (date.today() + timedelta(days=days)).isoformat() if days is not None else None
        t = self.call("post", "/tasks", json={"title": title, "engagement_id": eid, "owner": owner, "due_on": due})
        if done:
            self.call("post", f"/tasks/{t['id']}/done")


def seed(client: Any) -> dict[str, int]:
    api = _Api(client)
    probe = client.get(f"{V1}/people", params={"limit": 1})
    if int(probe.headers.get("X-Total-Count", "0")) > 0:
        raise AlreadyHasData("This workspace already has people. Run `make reset` first to start from empty.")

    # Professionals (agency-wide).
    rosa = api.call("post", "/professionals", json={"name": "Rosa Finch", "kind": "broker", "firm": "Finch Finance (synthetic)", "email": "rosa@example.com", "mobile": "0400 900 001"})["id"]
    tom = api.call("post", "/professionals", json={"name": "Tom Bell", "kind": "selling_agent", "firm": "Bell Realty (synthetic)", "email": "tom@example.com", "mobile": "0400 900 002"})["id"]
    alma = api.call("post", "/professionals", json={"name": "Alma Reyes", "kind": "conveyancer", "firm": "Reyes Conveyancing (synthetic)", "email": "alma@example.com", "mobile": "0400 900 003"})["id"]
    pat = api.call("post", "/professionals", json={"name": "Pat Quill", "kind": "inspector", "firm": "Quill Inspections (synthetic)", "email": "pat@example.com", "mobile": "0400 900 004"})["id"]

    # 1. Searching: a couple with a clear brief and a live shortlist.
    linh, marcus = api.person("Linh Nguyen", "linh.nguyen@example.com", "0400 100 001"), api.person("Marcus Hall", "marcus.hall@example.com", "0400 100 002")
    api.call("post", f"/people/{linh}/relationships", json={"other_person_id": marcus, "kind": "partner"})
    h1 = api.household("Nguyen-Hall (synthetic)", linh, marcus)
    e1 = api.opportunity(h1, 1_200_000, "searching")
    api.brief(e1, purpose="A home to live in", bedrooms="4", propertyType="House", timeline="Settle by April", areas=["Kedron", "Stafford", "Wavell Heights"], dealBreakers=["Main road frontage", "Flooding"], mustHaves=["Lockable garage", "Pet friendly"], work=("Linh", "Pharmacist, Chermside"))
    api.prop(e1, "3 Sample Lane", "Kedron", "shortlisted", beds=3, low=1_050_000, high=1_150_000, assessment="Good block, needs a kitchen. Quiet street.", checks={"Not on a main road": "meets", "Lockable garage": "partly", "Flood overlay": "unknown"})
    api.prop(e1, "21 Demo Cres", "Stafford", "inspecting", beds=4, low=1_250_000, assessment="Over budget but the best layout.", checks={"Not on a main road": "meets"})
    api.prop(e1, "17 Mock Rd", "Wavell Heights", "passed", beds=3, low=990_000, assessment="Busy road.", checks={"Not on a main road": "fails"})
    api.prop(e1, "12 Example St", "Kedron", "considering", assessment="New listing, to look at this week.")
    api.prop(e1, "9 Sample Ave", "Nundah", "passed", beds=2, low=610_000, assessment="A unit: they want a house.", checks={"Property type": "fails"})
    api.prop(e1, "A townhouse on Zillmere Rd (number not yet known)", "Zillmere", "missed", assessment="Sold before they were ready.")
    api.call("post", f"/engagements/{e1}/professionals", json={"person_id": rosa, "role": "Their mortgage broker"})
    api.call("post", f"/engagements/{e1}/communications", json={"direction": "in", "channel": "email", "subject": "Pre-approval confirmed at $1.25M", "body": "Rosa confirmed the lender approval."})
    api.task(e1, "Book inspection at 21 Demo Cres", "Agent", 2)
    api.task(e1, "Send the Kedron contract to the conveyancer", "Operations", -1)

    # 2. Proposal: a family.
    chidi, amara = api.person("Chidi Okafor", "chidi.okafor@example.com", "0400 100 003"), api.person("Amara Okafor", "amara.okafor@example.com", "0400 100 004")
    api.call("post", f"/people/{chidi}/relationships", json={"other_person_id": amara, "kind": "partner"})
    h2 = api.household("Okafor family (synthetic)", chidi, amara)
    e2 = api.opportunity(h2, 900_000, "proposal")
    api.brief(e2, purpose="A home to live in", bedrooms="3, or 2 plus a study", children="Two children, one starting school", areas=["Chermside", "Nundah"], dealBreakers=["Flight path noise"])
    api.task(e2, "Send the service agreement", "Agent", 0)

    # 3. Qualified: a solo investor.
    priya = api.person("Priya Raman", "priya.raman@example.com", "0400 100 005")
    h3 = api.household("Raman (synthetic)", priya)
    e3 = api.opportunity(h3, 750_000, "qualified")
    api.brief(e3, purpose="First investment property", investor="Individual buyer, wants yield over growth")
    api.task(e3, "Ask Priya for her borrowing estimate", "Agent", 3)

    # 4. Due diligence: an offer accepted.
    eve, sam = api.person("Eve Walsh", "eve.walsh@example.com", "0400 100 006"), api.person("Sam Dunn", "sam.dunn@example.com", "0400 100 007")
    api.call("post", f"/people/{eve}/relationships", json={"other_person_id": sam, "kind": "partner"})
    h4 = api.household("Walsh-Dunn (synthetic)", eve, sam)
    e4 = api.opportunity(h4, 880_000, "due_diligence")
    api.brief(e4, purpose="A home to live in", bedrooms="3", areas=["Chermside"])
    api.prop(e4, "5 Fixture Ct", "Chermside", "offered", beds=3, low=780_000, high=830_000, assessment="Offer accepted at $815k, subject to finance and inspection.", checks={"Lockable garage": "meets"})
    api.call("post", f"/engagements/{e4}/professionals", json={"person_id": alma, "role": "Conveyancer"})
    api.call("post", f"/engagements/{e4}/professionals", json={"person_id": pat, "role": "Building inspector"})
    api.call("post", f"/engagements/{e4}/professionals", json={"person_id": tom, "role": "Selling agent, 5 Fixture Ct"})
    api.task(e4, "Building and pest report due", "Operations", 1)

    # 5. Aftercare: settled.
    gia, leo = api.person("Gia Bianchi", "gia.bianchi@example.com", "0400 100 008"), api.person("Leo Bianchi", "leo.bianchi@example.com", "0400 100 009")
    api.call("post", f"/people/{gia}/relationships", json={"other_person_id": leo, "kind": "partner"})
    h5 = api.household("Bianchi (synthetic)", gia, leo)
    e5 = api.opportunity(h5, 1_000_000, "aftercare")
    api.prop(e5, "8 Placeholder Pde", "Kedron", "purchased", beds=2, low=720_000, assessment="Settled in October.")
    api.task(e5, "Three-month check-in call", "Agent", 30)
    api.task(e5, "Send the settlement gift", "Operations", -10, done=True)

    # 6. A real call: the fictional transcript 03, reviewed and applied.
    tash = api.person("Tash Kumar", "tash.kumar@example.com", "0400 100 010")
    h6 = api.household("Tash and Rhys (call 03, synthetic)", tash)
    e6 = api.opportunity(h6, 950_000, "consultation")
    transcript = next(TESTDATA.glob("03-*"))
    intake = api.call("post", f"/engagements/{e6}/intakes", json={"filename": transcript.name, "text": transcript.read_text(encoding="utf-8"), "notes": False})
    iid = intake["id"]
    labels = [s["label"] for s in intake["speakers"]]
    nadia = next(lab for lab in labels if lab.startswith("Nadia"))
    broker = next(lab for lab in labels if lab.startswith("iPhone"))
    api.call("put", f"/intakes/{iid}/speakers", json={"label": nadia, "kind": "agent", "name": "Nadia Pearce"})
    api.call("put", f"/intakes/{iid}/speakers", json={"label": "Tash Kumar", "kind": "household", "name": "Tash Kumar", "person_id": tash})
    api.call("put", f"/intakes/{iid}/speakers", json={"label": "Rhys Gallagher", "kind": "household", "name": "Rhys Gallagher", "is_new": True})
    api.call("put", f"/intakes/{iid}/speakers", json={"label": broker, "kind": "professional", "name": "Dan", "role": "Mortgage broker"})
    api.call("post", f"/intakes/{iid}/speakers/confirm")
    api.call("post", f"/intakes/{iid}/accept-rest")
    api.call("post", f"/intakes/{iid}/finish")
    api.call("post", f"/engagements/{e6}/tasks/from-actions")

    # 7. A fresh enquiry, not yet booked.
    jae = api.person("Jae Kim", "jae.kim@example.com", "0400 100 011")
    h7 = api.household("Kim (synthetic)", jae)
    api.opportunity(h7, None, "enquiry")

    # 8. Closed.
    ana = api.person("Ana Moreno", "ana.moreno@example.com", "0400 100 012")
    h8 = api.household("Moreno (synthetic)", ana)
    api.opportunity(h8, 700_000, "closed", reason="Did not proceed: bought privately")

    # Identity checks (synthetic) for two clients, and a couple of notes.
    api.call("post", f"/people/{linh}/identity-checks", json={"kind": "customer_identification"})
    api.call("post", f"/people/{eve}/identity-checks", json={"kind": "customer_identification"})
    api.call("post", f"/engagements/{e2}/communications", json={"direction": "out", "channel": "call", "subject": "Walked through the proposal by phone"})

    return {**api.counts, "households": api.counts["households"], "professionals": 5}


if __name__ == "__main__":
    import httpx2 as httpx

    base = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8000"
    with httpx.Client(base_url=base, timeout=60) as c:
        try:
            print("Seeded:", seed(c))
        except AlreadyHasData as refusal:
            print(refusal)
            sys.exit(1)
