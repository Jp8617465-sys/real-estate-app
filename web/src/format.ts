export const money = (aud: number | null | undefined): string =>
  aud == null ? "No budget on record" : `$${aud.toLocaleString("en-AU")}`;

export const when = (iso: string): string =>
  new Date(iso).toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" });

export const stageLabel = (stage: string): string =>
  stage.charAt(0).toUpperCase() + stage.slice(1).replace(/_/g, " ");
