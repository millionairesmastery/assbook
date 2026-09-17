import { env } from "cloudflare:workers";

export type PhotoTarget = "post" | "avatar";
export type PhotoVerdict = {
  verdict: "allow" | "reject" | "unsure";
  reason: string;
};

// Workers AI vision models for the automatic dress-code check. PHOTO_MODEL
// picks one: "llama" (default, Meta's Llama 3.2 Vision, whose licence must be
// accepted once in the account by sending the prompt "agree") or "moondream".
const MODELS = {
  moondream: "@cf/moondream/moondream3.1-9B-A2B",
  llama: "@cf/meta/llama-3.2-11b-vision-instruct",
} as const;
const TIMEOUT_MS = 12000;

// The description comes first on purpose: it makes the model look at the
// image before it fills in the flags, instead of echoing the template.
const RULES =
  "You check photos for a social site. Its rule: a profile photo shows the owner's own fully clothed behind (backside, bottom, seen from behind), and no photo anywhere may contain nudity or sexual content. " +
  "Look carefully at the image, then answer with JSON only and nothing else, using exactly these keys: " +
  '{"description": one factual sentence about what the image shows, ' +
  '"people": number of people visible (0 if none), ' +
  '"view": "behind" if the main subject is a person seen from behind, "front" if seen from the front or side, "none" if no person, ' +
  '"clothing": "clothed" only if the buttocks, genitals and chest of every visible person are covered by normal clothing such as trousers, jeans, a skirt, a dress or shorts; "revealing" if underwear, lingerie, swimwear, a towel, or partly exposed buttocks; "nude" if buttocks skin, genitals or nipples are visible, even partly, even from far away; "none" if no person, ' +
  '"lower_body": the exact garment covering the buttocks of the main person, such as "blue jeans", "black skirt", "swim trunks", "underwear", or "nothing" if the buttocks are bare, or "no person", ' +
  '"upper_body": the garment on the upper body, or "nothing" if bare, or "no person", ' +
  '"buttocks_bare": true if any buttocks skin is visible, otherwise false, ' +
  '"underwear_only": true if the lower body is covered only by underwear, lingerie or swimwear, otherwise false, ' +
  '"sexual": true if there is sexual activity or an explicitly sexual pose, otherwise false, ' +
  '"confidence": "high" if the image is clear and you are sure, otherwise "low"}. ' +
  "Be literal and strict: when in doubt between clothed and revealing choose revealing, and between revealing and nude choose nude. " +
  "A plain colour, a drawing, an object or a landscape has 0 people, view none and clothing none.";
// Garments that count as clothed for the dress code.
const CLOTHED_WORDS =
  /\b(jeans|trousers|pants|slacks|chinos|skirt|dress|shorts|leggings|joggers|sweatpants|tracksuit|overalls|dungarees|kilt|uniform|suit|khakis|corduroys|culottes|capris|jumpsuit|romper|gown|robe|coat|tights)\b/i;
// Garments or words that mean bare skin or nothing but underwear or swimwear.
const BARE_WORDS =
  /\b(nothing|none|bare|naked|nude|skin|underwear|panties|briefs|boxers|thong|g-string|lingerie|bikini|swimsuit|swimwear|swim trunks|trunks|speedo|towel)\b/i;
// Words in the model's own description that mean nudity. These reject on
// their own: the model's yes/no flags have said "no bare skin" for photos it
// described as showing buttocks, so the description is what counts.
const NUDITY_WORDS =
  /\b(nude|naked|nudity|undressed|unclothed|no clothes|without clothes|genital|genitals|penis|vulva|nipple|nipples|breasts?|topless|thong|g-string|bare (buttocks|bottom|butt|behind|rear|skin)|(buttocks|bottom|butt|behind|rear|cheeks)\b[^.]{0,40}\b(shown|visible|exposed|bare|uncovered|revealed))\b/i;
// Words that mean bare skin or nothing but underwear or swimwear.
const SKIN_WORDS =
  /\b(buttocks|shirtless|bare (back|chest|torso)|underwear|panties|briefs|boxers|lingerie|bikini|swimsuit|swimwear|swim trunks|towel)\b/i;

type Answer = {
  description?: string;
  people?: number | string;
  view?: string;
  clothing?: string;
  lower_body?: string;
  upper_body?: string;
  buttocks_bare?: boolean | string;
  underwear_only?: boolean | string;
  sexual?: boolean | string;
  confidence?: string;
};
function flag(value: unknown) {
  return value === true || String(value).toLowerCase() === "true";
}

type AiBinding = { run(model: string, input: unknown): Promise<unknown> };

function mode() {
  return String((env as { PHOTO_CHECK?: string }).PHOTO_CHECK ?? "on")
    .trim()
    .toLowerCase();
}
function modelChoice(): keyof typeof MODELS {
  const value = String((env as { PHOTO_MODEL?: string }).PHOTO_MODEL ?? "llama")
    .trim()
    .toLowerCase();
  return value === "moondream" ? "moondream" : "llama";
}
// Each model has its own request shape; both get the same rules and question.
function buildInput(choice: keyof typeof MODELS, dataUrl: string, question: string) {
  if (choice === "llama")
    return {
      messages: [
        { role: "system", content: RULES },
        {
          role: "user",
          content: [
            { type: "text", text: question },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
      max_tokens: 200,
      temperature: 0,
    };
  return {
    task: "query",
    image: dataUrl,
    question: RULES + " " + question,
    reasoning: false,
    max_tokens: 200,
    temperature: 0,
  };
}
// The model may return the JSON as a string or as an already-parsed object.
function answerText(result: unknown): string {
  if (typeof result === "string") return result;
  if (!result || typeof result !== "object") return "";
  if (isAnswer(result)) return JSON.stringify(result);
  const r = result as Record<string, unknown>;
  for (const key of ["answer", "response", "text", "result", "output"]) {
    const value = r[key];
    if (typeof value === "string") return value;
    if (value && typeof value === "object") {
      const nested = answerText(value);
      if (nested) return nested;
    }
  }
  return "";
}

function toBase64(bytes: Uint8Array) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk)
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(binary);
}

function parseAnswer(text: string): Answer | null {
  const start = text.indexOf("{"),
    end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed: unknown = JSON.parse(text.slice(start, end + 1));
    return isAnswer(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
function isAnswer(value: unknown): value is Answer {
  return !!value && typeof value === "object" && "clothing" in value && "view" in value;
}

function decide(answer: Answer | null, target: PhotoTarget): PhotoVerdict {
  if (!answer)
    return {
      verdict: "reject",
      reason: "We could not check this photo just now. Please try again in a moment.",
    };
  const sure = answer.confidence === "high";
  const people = Number(answer.people) || 0;
  const clothing = String(answer.clothing ?? "").toLowerCase();
  const view = String(answer.view ?? "").toLowerCase();
  const description = String(answer.description ?? "");
  const lower = String(answer.lower_body ?? "").toLowerCase();
  const sexual = flag(answer.sexual);
  // The garment words are more truthful than the booleans, so they decide.
  const lowerBare = people > 0 && (lower === "" || (BARE_WORDS.test(lower) && !CLOTHED_WORDS.test(lower)));
  const lowerNude = people > 0 && /\b(nothing|none|bare|naked|nude|skin)\b/i.test(lower) && !CLOTHED_WORDS.test(lower);
  const bare = flag(answer.buttocks_bare) || lowerNude;
  const underwear = flag(answer.underwear_only) || lowerBare;
  const seen = description ? " The check saw: " + description.slice(0, 140) : "";
  const garmentNamed = CLOTHED_WORDS.test(lower);
  // Nudity in any form, at any confidence, is a rejection. Nothing is stored.
  if (clothing === "nude" || sexual || bare || NUDITY_WORDS.test(description))
    return {
      verdict: "reject",
      reason: "This looks like it shows nudity or sexual content, which is not allowed here.",
    };
  // Bare skin, underwear or swimwear: a profile photo is rejected. A post
  // photo is fine (beach days are allowed) as long as there is no nudity,
  // which was handled above. A mention of buttocks with no real garment
  // named counts as bare.
  const skin =
    clothing === "revealing" ||
    underwear ||
    SKIN_WORDS.test(description) ||
    (people > 0 && !garmentNamed && /\b(buttocks|bottom|butt|behind|rear)\b/i.test(description));
  if (skin && target === "avatar")
    return {
      verdict: "reject",
      reason: "A profile photo has to be your own fully clothed behind. Underwear and swimwear do not count.",
    };
  if (target === "avatar") {
    const behind = people > 0 && view === "behind" && clothing === "clothed" && garmentNamed;
    if (behind && sure) return { verdict: "allow", reason: "" };
    if (sure && (people === 0 || view === "front"))
      return {
        verdict: "reject",
        reason: "A profile photo has to be your own fully clothed behind. Pants on, camera behind you.",
      };
    return { verdict: "unsure", reason: "The automatic check was not sure this is a clothed behind." + seen };
  }
  if (sure) return { verdict: "allow", reason: "" };
  return { verdict: "unsure", reason: "The automatic check was not sure about this photo." + seen };
}

/**
 * Checks a photo against the dress code before it is stored.
 * PHOTO_CHECK controls it: "on" (default) runs the model, "off" allows
 * everything, and "test" lets integration tests pick a verdict through the
 * X-Photo-Check-Test header without calling the model.
 */
export async function checkPhoto(
  bytes: Uint8Array,
  contentType: string,
  target: PhotoTarget,
  testHint: string | null,
): Promise<PhotoVerdict> {
  const current = mode();
  if (current === "off") return { verdict: "allow", reason: "" };
  if (current === "test") {
    if (testHint === "reject")
      return { verdict: "reject", reason: "Test rejection: this photo breaks the dress code." };
    if (testHint === "flag")
      return { verdict: "unsure", reason: "Test flag: a moderator should look at this photo." };
    return { verdict: "allow", reason: "" };
  }
  const ai = (env as { AI?: AiBinding }).AI;
  if (!ai)
    return {
      verdict: "reject",
      reason: "Photo checks are not configured on this server. Uploads are disabled.",
    };
  const question =
    target === "avatar"
      ? "This photo was uploaded as a profile photo. Check it against the rules."
      : "This photo was uploaded for a post. Check it against the rules.";
  try {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("photo check timed out")), TIMEOUT_MS),
    );
    const choice = modelChoice();
    const result = await Promise.race([
      ai.run(
        MODELS[choice],
        buildInput(choice, "data:" + contentType + ";base64," + toBase64(bytes), question),
      ),
      timeout,
    ]);
    const answer = parseAnswer(answerText(result));
    if (!answer)
      console.error(
        JSON.stringify({
          event: "photo_check_unreadable",
          model: choice,
          sample: JSON.stringify(result).slice(0, 300),
        }),
      );
    const verdict = decide(answer, target);
    console.log(
      JSON.stringify({
        event: "photo_check",
        model: choice,
        target,
        verdict: verdict.verdict,
        answer: answer ? JSON.stringify(answer).slice(0, 400) : null,
      }),
    );
    return verdict;
  } catch (e) {
    // Fail closed: an unchecked photo is never stored. The member can retry.
    console.error(
      JSON.stringify({
        event: "photo_check_failed",
        error: e instanceof Error ? e.message : String(e),
      }),
    );
    return {
      verdict: "reject",
      reason: "We could not check this photo just now. Please try again in a moment.",
    };
  }
}
