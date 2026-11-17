import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { components } from "../api/schema";

type Info = components["schemas"]["IntegrationInfo"];

export function IntegrationsPage() {
  const [items, setItems] = useState<Info[]>([]);
  useEffect(() => {
    api.GET("/api/v1/integrations").then(({ data }) => data && setItems(data));
  }, []);
  return (
    <>
      <div className="eyebrow">Integrations</div>
      <h1>What is connected</h1>
      <p className="muted">Every external system sits behind a replaceable port. Today every adapter is synthetic: nothing here reaches a real provider.</p>
      {items.map((i) => (
        <div className="card" key={i.port}>
          <div className="fieldname">{i.port.replace("_", " ")}</div>
          <div className="value">{i.adapter}</div>
          <div className="pills">
            <span className="pill warn">{i.synthetic ? "synthetic" : "real"}</span>
            <span className={`pill ${i.live ? "" : "plain"}`}>{i.live ? "live" : "not live"}</span>
          </div>
          <p className="muted">{i.description}</p>
        </div>
      ))}
    </>
  );
}
