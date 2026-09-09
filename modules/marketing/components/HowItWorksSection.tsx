const STEPS = [
  {
    step: "01",
    title: "Send two photos",
    body: "One from inside, floor to ceiling. One from outside, the whole wall. The assistant tells you if a third close-up would help.",
  },
  {
    step: "02",
    title: "Answer a few questions",
    body: "Four at most, and only the ones that change the job: what broke, whether the pane is single or double, how high off the ground it sits.",
  },
  {
    step: "03",
    title: "Confirm the measurements",
    body: "We estimate the size from the photo and show you the numbers. If they look wrong, correct them. Nothing is used until you agree.",
  },
  {
    step: "04",
    title: "A person prices and sends it",
    body: "Your details go to the nearest of our three locations. A glazier prices the work and emails you the estimate.",
  },
] as const;

export function HowItWorksSection() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-16 lg:py-20">
      <div className="max-w-2xl space-y-3">
        <h2 className="text-3xl font-semibold tracking-tight text-slate-900">
          How it works
        </h2>
        <p className="text-lg text-slate-600">
          The assistant collects information. It never sets a price.
        </p>
      </div>

      <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map(({ step, title, body }) => (
          <li
            key={step}
            className="bg-surface-muted ring-border-subtle flex flex-col gap-3 rounded-xl p-6 ring-1"
          >
            <span className="text-brand-700 font-mono text-sm font-semibold">
              {step}
            </span>
            <p className="font-semibold text-slate-900">{title}</p>
            <p className="text-sm text-slate-600">{body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
