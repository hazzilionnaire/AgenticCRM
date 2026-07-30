import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { tierLabel } from "@/server/tiering/calculate-tier";

const EmailDraftSchema = z.object({
  subject: z.string().describe("Email subject line"),
  body: z.string().describe("Plain-text email body. No greeting placeholder, no signature block."),
});

export interface EmailDraft {
  subject: string;
  body: string;
}

export interface DraftEmailInput {
  legalName: string;
  dbaName: string | null;
  industryName: string | null;
  tier: number | null;
  companyType: string;
  lifecycleStage: string;
  websiteDomain: string | null;
}

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set. Copy .env.example to .env and fill it in.");
  }
  return new Anthropic({ apiKey });
}

function describeCompany(input: DraftEmailInput): string {
  const lines = [
    input.dbaName
      ? `Company: ${input.legalName}, doing business as ${input.dbaName}`
      : `Company: ${input.legalName}`,
    input.industryName ? `Industry: ${input.industryName}` : null,
    `Relationship type: ${input.companyType}`,
    `Lifecycle stage: ${input.lifecycleStage}`,
    `Segment: ${tierLabel(input.tier)}`,
    input.websiteDomain ? `Website: ${input.websiteDomain}` : null,
  ];
  return lines.filter(Boolean).join("\n");
}

/**
 * Drafts an intro email from the fields already on the company record --
 * no live web search, so it must never present a guess as a verified fact.
 * Structured outputs guarantee a parseable {subject, body} rather than a
 * prompt asking the model to emit JSON, which a stray sentence could break.
 */
export async function draftIntroEmail(input: DraftEmailInput): Promise<EmailDraft> {
  const response = await getClient().messages.parse({
    model: "claude-opus-5",
    max_tokens: 1024,
    system:
      "You write short, specific B2B sales introduction emails for account executives. " +
      "Write only from the facts you're given -- never invent a specific event, statistic, " +
      "or piece of news about the company. General, truthful statements about their industry " +
      "are fine; a claim that names a specific recent event is not, unless it was given to you " +
      "as a fact. The sender doesn't have a contact name yet, so open with something generic " +
      "like \"Hi there\" rather than a [Name] placeholder. Keep the body under 150 words. " +
      "No signature block -- the sender adds their own.",
    messages: [
      {
        role: "user",
        content: `Draft an introduction email to send to this prospective account:\n\n${describeCompany(input)}`,
      },
    ],
    output_config: {
      format: zodOutputFormat(EmailDraftSchema),
      effort: "medium",
    },
  });

  if (!response.parsed_output) {
    throw new Error("Could not generate an email draft. Try again.");
  }
  return response.parsed_output;
}
