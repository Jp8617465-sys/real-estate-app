# Delivery loop

Adapted from the merged ASXOS factory; see provenance.md.

1. Discover through grilling and domain-modeling. James owns decisions; agents find facts. Confirm shared understanding before acting on the design.
2. Wayfind using one map Issue. Children resolve decisions through research, discussion, prototype or prerequisite work. Resolve at most one non-research decision per session. Keep later uncertainty as fog until the question is precise.
3. Prototype a named question cheaply. Label illustrative data. Capture question, verdict and artifact/branch pointer on the decision Issue. Keep throwaway code on a prototype/<slug> branch; no persistence/tests unless the question requires them.
4. Specify validated outcomes, constraints, acceptance examples and agreed testing seams with to-spec; link the north star.
5. Slice with to-tickets. Approve granularity/dependencies before publishing implementation Issues. Each product slice delivers one narrow complete useful path across necessary layers. Research/prerequisites are explicit exceptions.
6. Assign one stable delivery owner through building, integration, publication and acceptance. Record scope, dependencies, integration agreements, publication plan, acceptance cases and verification command before readiness.
7. Run meaningful checks and acceptance. Inspect required checks at the actual PR head and review the diff before landing. Merge/release within delegated scope and host permissions; branch-specific instructions override general authority.
8. Verify the published version through read-back and dated observed acceptance. Tests/merge alone do not complete a product slice. Keep open while integrating, awaiting publication or verifying; close with evidence.
9. Record learnings, update the owning Issue and leave a brief handoff before the next phase/fresh chat.

States: planned → building → integrating → awaiting-publication → verifying → complete.

This bootstrap ports instructions, templates and offline/CI verification. ASXOS's governance engine, scheduled builders, authority hooks, automated closure engine, monthly upstream monitor and publication tooling require separate adaptation. They are not enabled or described as enforced here.
