import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { NO_PII_HINT, ReasonNoteField } from "@/platform/components/reason-dialog";

describe("reason dialog", () => {
  it("asks reviewers not to type PII under the note box", () => {
    const html = renderToStaticMarkup(createElement(ReasonNoteField, { label: "Note", required: true, value: "", onChange: () => {} }));
    expect(NO_PII_HINT).toMatch(/^Don't type PII/);
    expect(html).toContain("Don&#x27;t type PII");
    expect(html).toContain('aria-describedby="reason-note-hint"');
  });
});
