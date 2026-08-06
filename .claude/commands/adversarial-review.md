---
name: "Adversarial Review"
description: "Run a 5-agent adversarial code review (correctness, silent failures, type design, test coverage, comment quality) against the current branch or a PR, independent of the OpenSpec archive/PR flow"
category: "Workflow"
tags: ["review", "quality", "workflow"]
---

Run the adversarial code review described in `AGENTS.md` §3.2, as a standalone step decoupled from `/opsx:archive`. This command does not commit, push, open a PR, or merge — it only reviews, and (with your approval) fixes what needs fixing. Sequencing (PR/merge) stays entirely in your hands or `/opsx:archive`'s.

**Input**: Optional argument — a PR number (e.g. `/adversarial-review 3`), a branch name to diff against `main`, or nothing (defaults to the current branch's diff against `main`, via `git diff main...HEAD`). The typical use is on a change's feature branch, before running `/opsx:archive` — reviewing before the PR exists means `/opsx:archive` can run straight through (sync → commit → push → PR → merge) without a post-hoc fix-and-repush cycle. Reviewing an already-open PR by number also works, if that's when you'd rather do it.

## Steps

1. **Resolve the target diff**
   - No argument: `git diff main...HEAD` on the current branch (make sure `origin/main` is fetched first: `git fetch origin main --quiet`).
   - Numeric argument: treat as a PR number, use `gh pr diff <n>` and `gh pr view <n>` for context.
   - Non-numeric argument: treat as a branch name, `git diff main...<branch>`.
   - Announce what you resolved to before proceeding ("Reviewing `<branch>` against `main`" / "Reviewing PR #<n>").

2. **Brief yourself on the change**
   - Read `AGENTS.md` and `CLAUDE.md` for house rules.
   - Read the actual diff. If it touches a capability under `openspec/specs/`, skim that capability's spec so the review can check the diff against documented requirements, not just generic code quality.
   - If the diff is large, write yourself a short factual summary (files touched, what changed and why, quoting the proposal/design docs if this maps to an OpenSpec change) to hand to each subagent — don't make them re-derive it independently, that's wasted parallel work and risks five slightly different mental models of "what this PR does."

3. **Launch 5 parallel review passes**

   Try launching with `subagent_type` set to the real `pr-review-toolkit` plugin agent names first: `code-reviewer`, `silent-failure-hunter`, `type-design-analyzer`, `pr-test-analyzer`, `comment-analyzer`. If any comes back with an "Agent type not found" error (this plugin is not registered as an invocable agent type in every environment), fall back to `general-purpose` for that role and prepend its persona instructions verbatim to the prompt, sourced from `~/.claude/plugins/marketplaces/*/plugins/pr-review-toolkit/agents/<role>.md` if that file exists on disk, or the condensed personas below if it doesn't. Do this fallback silently and automatically — don't ask the user to resolve it, and don't skip a role just because the plugin type isn't registered.

   Launch all 5 as background agents in a single message (parallel tool calls), each with a self-contained prompt: the diff-location instructions from step 1, the briefing from step 2, and (for the fallback case) the relevant persona below. Each agent should fetch the diff itself (`git diff main...HEAD` / `gh pr diff <n>`) rather than have the full diff pasted into the prompt, unless the diff is small.

   <details>
   <summary>Condensed personas (fallback only — prefer the real plugin files or agent types when available)</summary>

   **code-reviewer**: Expert code reviewer. Check adherence to `AGENTS.md`/`CLAUDE.md` conventions, real bugs (logic errors, null handling, race conditions, security), and significant quality issues (duplication, missing error handling). Rate 0-100 (0-25 false positive, 26-50 minor nitpick, 51-75 valid low-impact, 76-90 important, 91-100 critical/explicit rule violation). Only report ≥80.

   **silent-failure-hunter**: Zero tolerance for silent failures. Find every try-catch, error callback, fallback, optional-chaining-that-hides-a-failure, catch-and-continue. For each: is it logged, does the user get actionable feedback, is the catch overly broad, is the fallback explicit and justified, should the error propagate instead. Empty catch blocks are always critical. Report Location/Severity/Issue/Hidden-Errors/User-Impact/Recommendation, with your own 0-100 confidence, only report ≥80.

   **type-design-analyzer**: Type design expert. For new/changed types and interfaces: identify invariants, rate Encapsulation/Invariant-Expression/Invariant-Usefulness/Invariant-Enforcement each 1-10 with justification. Flag illegal-states-representable, duplicated sources of truth with no compile-time link, weak escape hatches (`any`, unchecked casts). Prefer compile-time guarantees; suggest only pragmatic, in-scope improvements — this is a review of a specific diff, not a redesign invitation. Translate your findings to the same 0-100 confidence scale before reporting; only surface ≥80.

   **pr-test-analyzer**: Test coverage analyst, pragmatic not pedantic. Focus on behavioral coverage of critical paths, not line coverage. Before flagging a gap, check whether sibling/precedent code in the same repo already has (or lacks) the same kind of coverage — a gap consistent with existing project convention is not a new regression this PR introduced. Rate 1-10 criticality, translate to 0-100 confidence, only surface ≥80 (roughly, criticality 8-10).

   **comment-analyzer**: Skeptical comment auditor. Verify every comment (including any project convention docs like `openspec/specs/*.md` if touched) against the actual code/behavior it describes. Flag comments/spec-text that name internal implementation details when the project's own convention says otherwise (check `AGENTS.md`), comments that restate the obvious, comments likely to rot. Rate 0-100 confidence, only surface ≥80.

   </details>

4. **Consolidate and score**

   Collect all 5 reports. For anything a subagent already scored, sanity-check the score against the rubric above rather than accepting it uncritically — subagents sometimes self-rate generously. Only carry forward findings that land at ≥80 confidence after your own judgment.

   If nothing reaches ≥80: report a clean pass (briefly note anything sub-80 worth being aware of, don't pad the report with it) and stop here.

5. **Fix, or ask — don't guess**

   For each ≥80 finding:
   - **Pure technical fix** (bug, type-safety gap, misleading comment/spec text, missing test for a real regression): fix it directly. Verify with the project's own checks (typecheck, test suite, `openspec validate --strict` if specs were touched) before moving on.
   - **A fix that isn't actually cheap once attempted** (e.g. crosses a module boundary that breaks compilation, requires restructuring something not already in scope): don't force it in. Revert the attempt, note it as a legitimate but out-of-scope follow-up instead of letting scope creep into this diff.
   - **A finding that implies a product/UX/architecture decision** (a behavior trade-off nobody explicitly signed off on, not just a code defect): stop and ask the user with concrete options via `AskUserQuestion` — per `AGENTS.md` §3's rule against making architecture decisions silently in code. Do not pick an option yourself and proceed.

   After fixing what should be fixed, commit and push to the current feature branch (standing authorization per `AGENTS.md` §3, same branch this review is running against) with a message describing what the review found and what was done about it.

6. **Re-review once**

   Run one more targeted pass over just the incremental fix diff (`git show <fix-commit>` or `git diff <pre-fix-sha>..HEAD`) — a single reviewer pass is enough here, not all 5 again, unless the fixes were substantial enough to warrant full re-coverage. Confirm: the fixes are accurate, nothing new broke, and the project's checks still pass.

7. **Report**

   Summarize: what was found, what was fixed (and how), what was deliberately left as a documented trade-off or follow-up (and why), and confirm the branch is clean and ready for `/opsx:archive` (or for the PR to be merged, if you were reviewing one already open). Do not push, open a PR, or merge as part of this command — that's `/opsx:archive`'s job, or the user's.

## Guardrails

- Never invoke this automatically from `/opsx:apply` or `/opsx:archive` — it only runs when explicitly invoked (`/adversarial-review`) or explicitly requested by the user in conversation.
- Don't fabricate or predict findings before background agents actually report back — wait for real results.
- Don't merge, push a PR, or open one from this command.
- Findings under 80 confidence are noise for this rubric — don't report them as if they mattered, and don't pad a clean report with "minor observations" nobody asked for.
- A finding you can't confidently fix without guessing at product intent is a question for the user, not a coin flip.
