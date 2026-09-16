import { StartEstimateButton } from "@/modules/marketing/components/StartEstimateButton";

export function CallToActionSection() {
  return (
    <section className="bg-ink">
      <div className="mx-auto flex max-w-[74rem] flex-col justify-between gap-10 px-6 py-19 lg:flex-row lg:items-center">
        <div className="flex flex-col gap-3.5">
          <h2 className="font-display text-[2rem] leading-[1.15] font-bold tracking-[-0.022em] text-white sm:text-[2.375rem]">
            Got a broken pane in front of you?
          </h2>
          <p className="text-brand-200 text-[17px] leading-7">
            Take the photo now while you are standing there. It takes about
            three minutes.
          </p>
        </div>
        <StartEstimateButton
          size="lg"
          variant="accent"
          label="Start with a photo"
          className="h-14 shrink-0 self-start px-[1.875rem] text-[16.5px] lg:self-auto"
        />
      </div>
    </section>
  );
}
