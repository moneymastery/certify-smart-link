import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    q: "How does QR code verification work?",
    a: "Each certificate contains a unique QR code. When scanned, it opens a verification page that confirms the certificate's authenticity, holder name, issue date, and status — all in real time.",
  },
  {
    q: "Can I customize which details appear on the verification page?",
    a: "Yes. During certificate generation, you choose exactly which fields from your spreadsheet are visible after scanning — student name, roll number, course, or any custom field.",
  },
  {
    q: "Is the verification page branded with my organization?",
    a: "Absolutely. The verification page displays your organization's name and logo, giving recipients and verifiers a professional, white-label experience.",
  },
  {
    q: "How many certificates can I generate at once?",
    a: "There is no hard limit. Upload a CSV with thousands of rows and CertifyPro processes them in batches, generating PDFs with QR codes for each recipient.",
  },
  {
    q: "What happens if a certificate needs to be revoked?",
    a: "Admins can revoke any certificate from the dashboard. Once revoked, the verification page immediately shows a 'Revoked' status when the QR is scanned.",
  },
  {
    q: "Do I need technical knowledge to use CertifyPro?",
    a: "Not at all. The entire workflow — uploading templates, mapping fields, generating certificates — is designed for non-technical users with a simple drag-and-drop interface.",
  },
];

const FAQ = () => {
  return (
    <section id="faq" className="section-padding">
      <div className="container mx-auto max-w-3xl">
        <div className="text-center mb-12">
          <h2 className="font-heading text-3xl lg:text-4xl font-bold text-foreground">
            Frequently Asked Questions
          </h2>
          <p className="mt-4 text-muted-foreground max-w-lg mx-auto">
            Everything you need to know about generating and verifying certificates.
          </p>
        </div>

        <Accordion type="single" collapsible className="w-full">
          {faqs.map((faq, i) => (
            <AccordionItem key={i} value={`item-${i}`}>
              <AccordionTrigger className="text-left text-foreground font-medium">
                {faq.q}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-relaxed">
                {faq.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
};

export default FAQ;
