import Link from "next/link";

import { BRAND } from "@/core/config/branding";
import { BrandMark } from "@/modules/marketing/components/BrandMark";

const SERVICE_LINKS = [
  "Window glass",
  "Sliding doors",
  "Shower glass",
  "Storefront",
] as const;

function FooterColumn({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <span className="text-brand-600 text-xs font-semibold tracking-[0.12em] uppercase">
        {heading}
      </span>
      {children}
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer className="bg-ink-deep mt-auto">
      <div className="mx-auto flex max-w-[74rem] flex-col gap-10 px-6 pt-14 pb-11">
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="flex flex-col gap-3.5">
            <div className="flex items-center gap-3">
              <BrandMark />
              <span className="font-display text-[17px] font-bold text-white">
                {BRAND.companyName}
              </span>
            </div>
            <p className="text-brand-300 max-w-[17.5rem] text-sm leading-[23px]">
              Glass replacement for homes and businesses across{" "}
              {BRAND.serviceArea}. Licensed and insured, {BRAND.licenseNumber}.
            </p>
          </div>

          <FooterColumn heading="Services">
            {SERVICE_LINKS.map((service) => (
              <span key={service} className="text-brand-300 text-sm">
                {service}
              </span>
            ))}
          </FooterColumn>

          <FooterColumn heading="Locations">
            {BRAND.locations.map((location) => (
              <span key={location} className="text-brand-300 text-sm">
                {location}
              </span>
            ))}
          </FooterColumn>

          <FooterColumn heading="Contact">
            <a
              href={BRAND.phoneHref}
              className="text-brand-300 text-sm hover:text-white"
            >
              {BRAND.phone}
            </a>
            <span className="text-brand-300 text-sm">{BRAND.email}</span>
            <span className="text-brand-300 text-sm">{BRAND.hours}</span>
            <Link
              href="/auth/signin"
              className="text-brand-300 text-sm hover:text-white"
            >
              Staff login
            </Link>
          </FooterColumn>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#123039] pt-6">
          <span className="text-brand-600 text-[13px]">
            © {new Date().getFullYear()} {BRAND.legalName}. All rights
            reserved.
          </span>
          <span className="text-brand-600 max-w-xl text-[13px]">
            Figures shown during intake are measurements, not prices.
          </span>
        </div>
      </div>
    </footer>
  );
}
