import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";

export function NewOpportunity() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (key: string) => String(form.get(key) ?? "").trim() || null;
    const email = text("email");
    const mobile = text("mobile");
    if (!email && !mobile) {
      setError("Add an email or a mobile so you can reach the client.");
      return;
    }
    const budget = text("budget");
    const budgetAud = budget ? Number(budget.replace(/[$,\s]/g, "")) : null;
    if (budgetAud !== null && !Number.isInteger(budgetAud)) {
      setError("The budget should be a whole number of dollars, such as 950000.");
      return;
    }
    setSaving(true);
    setError(null);
    const { data } = await api.POST("/api/engagements", {
      body: {
        household_name: text("household") ?? "",
        client: { name: text("client") ?? "", email, mobile },
        budget_aud: budgetAud,
      },
    });
    setSaving(false);
    if (!data) {
      setError("That could not be saved. Check the details and try again.");
      return;
    }
    navigate(`/engagements/${data.id}`);
  }

  return (
    <>
      <div className="eyebrow">New buying opportunity</div>
      <h1>Who are you helping buy?</h1>
      <p className="muted">
        Enter the household and one client. You can add the discovery call afterwards.
      </p>
      <form className="panel form" onSubmit={submit}>
        <label>
          Household name
          <input name="household" required placeholder="The Synthetic Nguyens" />
        </label>
        <label>
          Client name
          <input name="client" required autoComplete="off" />
        </label>
        <div className="two">
          <label>
            Email
            <input name="email" type="email" autoComplete="off" />
          </label>
          <label>
            Mobile
            <input name="mobile" type="tel" autoComplete="off" />
          </label>
        </div>
        <label>
          Budget on record (AUD, optional)
          <input name="budget" inputMode="numeric" placeholder="950000" />
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div>
          <button className="button primary" type="submit" disabled={saving}>
            Create opportunity
          </button>
        </div>
      </form>
    </>
  );
}
