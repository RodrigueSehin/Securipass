import type { Metadata } from "next";
import { CertificateExamples, CertificationHero, CertificationProcess, CertificationTypes, VerifyIntro } from "@/components/certification/sections";
import { Faq } from "@/components/enterprise/sections";
import { CERT_FAQ } from "@/content/certification";

export const metadata: Metadata = { title: "Certifications" };

export default function CertificationPage() {
  return (
    <>
      <CertificationHero />
      <div className="mx-auto max-w-[1384px] space-y-10 px-4 py-8">
        <VerifyIntro />
        <CertificationTypes />
        <CertificationProcess />
        <CertificateExamples />
        <Faq items={CERT_FAQ} moreHref={null} />
      </div>
    </>
  );
}
