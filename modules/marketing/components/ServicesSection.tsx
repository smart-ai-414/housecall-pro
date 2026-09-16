import {
  Columns2,
  DoorOpen,
  Grid2x2,
  RectangleHorizontal,
  Store,
  Table2,
} from "lucide-react";

const SERVICES = [
  {
    icon: Grid2x2,
    title: "Window glass",
    body: "Single pane, double glazed, cracked or shattered. The most common call we take.",
  },
  {
    icon: Columns2,
    title: "Sliding door glass",
    body: "Patio and slider panels. Almost always tempered, and almost always urgent.",
  },
  {
    icon: DoorOpen,
    title: "Shower glass",
    body: "Enclosures, doors and panels. Safety glazing is required, so we always ask.",
  },
  {
    icon: Store,
    title: "Storefront",
    body: "Commercial glazing and entrance doors. Board-up available while glass is on order.",
  },
  {
    icon: RectangleHorizontal,
    title: "Mirrors",
    body: "Wall, vanity and closet mirrors, cut and fitted to the opening you have.",
  },
  {
    icon: Table2,
    title: "Table tops",
    body: "Cut, polished and edged to your template. Send a photo with a tape measure in frame.",
  },
] as const;

export function ServicesSection() {
  return (
    <section className="border-border-subtle bg-surface-sunken border-y">
      <div className="mx-auto max-w-[74rem] px-6 py-20 lg:py-21">
        <div className="mb-11 flex max-w-[38.75rem] flex-col gap-4">
          <span className="text-accent-500 text-xs font-semibold tracking-[0.12em] uppercase">
            What we replace
          </span>
          <h2 className="font-display text-brand-950 text-[2rem] leading-[1.15] font-bold tracking-[-0.022em] sm:text-[2.375rem]">
            Most calls are one of these six.
          </h2>
        </div>

        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map(({ icon: Icon, title, body }) => (
            <li
              key={title}
              className="border-border-subtle shadow-xs flex flex-col gap-3.5 rounded-2xl border bg-white p-6.5"
            >
              <Icon
                className="text-brand-600 size-6.5"
                strokeWidth={1.6}
                aria-hidden="true"
              />
              <p className="font-display text-brand-950 text-lg font-semibold">
                {title}
              </p>
              <p className="text-[14.5px] leading-[23px] text-slate-600">
                {body}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
