import { Lock, Ruler, UserCheck } from "lucide-react";

const COMMITMENTS = [
  {
    icon: UserCheck,
    title: "Reviewed by a glazier, every time",
    body: "No estimate reaches you without someone looking at it first. There is no confidence threshold that skips that step.",
  },
  {
    icon: Lock,
    title: "Your photos stay private",
    body: "Location data is stripped from every image before anyone opens it, and photos are never used for anything but your job.",
  },
  {
    icon: Ruler,
    title: "We measure before we cut",
    body: "The photo estimate gets you a price. A glazier still measures on site before any glass is ordered.",
  },
] as const;

export function AssuranceSection() {
  return (
    <section className="mx-auto grid max-w-[74rem] gap-14 px-6 py-20 lg:grid-cols-2 lg:items-center lg:gap-20 lg:py-[5.5rem]">
      <div className="flex flex-col gap-5">
        <span className="text-accent-500 text-xs font-semibold tracking-[0.12em] uppercase">
          Why a person still prices it
        </span>
        <h2 className="font-display text-brand-950 text-[2rem] leading-[1.15] font-bold tracking-[-0.022em] text-pretty sm:text-[2.375rem]">
          Software is good at looking. It is not good at standing behind a
          number.
        </h2>
        <p className="text-[17px] leading-7 text-slate-600">
          The assistant reads your photos, works out the opening size and asks
          the questions a glazier would ask. Then it stops. A person on our team
          checks the job, prices it from the rate book and decides what you are
          sent.
        </p>
        <p className="text-[17px] leading-7 text-slate-600">
          You never get an automated quote from us, and you never get a surprise
          on the day.
        </p>
      </div>

      <ul className="flex flex-col gap-3.5">
        {COMMITMENTS.map(({ icon: Icon, title, body }) => (
          <li
            key={title}
            className="border-brand-100 bg-brand-50 flex gap-4.5 rounded-2xl border p-5.5"
          >
            <Icon
              className="text-brand-600 mt-0.5 size-6 shrink-0"
              strokeWidth={1.7}
              aria-hidden="true"
            />
            <div className="flex flex-col gap-1.5">
              <p className="text-brand-950 text-base font-semibold">{title}</p>
              <p className="text-[14.5px] leading-[23px] text-slate-600">
                {body}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
