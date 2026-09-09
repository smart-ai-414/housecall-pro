import { BRAND } from "@/core/config/branding";
import { StartEstimateButton } from "@/modules/marketing/components/StartEstimateButton";

const COMMITMENTS = [
  {
    question: "Does a computer decide what I pay?",
    answer:
      "No. The assistant reads your photos and asks questions. Pricing comes from our rate book, applied by a glazier who reviews every estimate before it leaves the office.",
  },
  {
    question: "What if the assistant gets the size wrong?",
    answer:
      "It shows you the measurement it read from the photo and asks you to confirm it. An unconfirmed measurement is never used, and you can type the real numbers instead.",
  },
  {
    question: "What about safety glass?",
    answer:
      "We ask, or we verify it on site. A visible safety marking on the pane proves it is tempered. The absence of one proves nothing, so we never assume.",
  },
  {
    question: "What happens to my photos?",
    answer:
      "They are re-encoded on upload, which removes the GPS coordinates your phone attaches. Only our estimating team sees them.",
  },
  {
    question: "What if my job is unusual?",
    answer: `Then the assistant says so instead of guessing. Complicated work goes to a person, and we call you at ${BRAND.phone}.`,
  },
] as const;

export function AssuranceSection() {
  return (
    <section className="border-border-subtle bg-surface-muted border-y">
      <div className="mx-auto max-w-6xl px-6 py-16 lg:py-20">
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="space-y-5">
            <h2 className="text-3xl font-semibold tracking-tight text-slate-900">
              Straight answers
            </h2>
            <p className="text-lg text-slate-600">
              Glass pricing depends on details a photo can miss. Here is exactly
              where the assistant stops and a person takes over.
            </p>
            <StartEstimateButton size="md" variant="secondary" />
          </div>

          <dl className="space-y-6">
            {COMMITMENTS.map(({ question, answer }) => (
              <div
                key={question}
                className="border-border-subtle border-b pb-6 last:border-0 last:pb-0"
              >
                <dt className="font-semibold text-slate-900">{question}</dt>
                <dd className="mt-1.5 text-slate-600">{answer}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
