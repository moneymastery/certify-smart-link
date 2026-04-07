import { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShieldCheck, Search, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface CertificateResult {
  id: string;
  serial_number: string;
  recipient_name: string;
  recipient_data: Record<string, string>;
  status: string;
  issued_at: string;
  organization_id: string;
}

const statusColors: Record<string, string> = {
  active: "text-success",
  revoked: "text-destructive",
  reissued: "text-warning",
  expired: "text-muted-foreground",
};

const Verify = () => {
  const { id: tokenFromUrl } = useParams<{ id: string }>();
  const [query, setQuery] = useState(tokenFromUrl || "");
  const [certificate, setCertificate] = useState<CertificateResult | null>(null);
  const [orgName, setOrgName] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "found" | "not-found">("idle");

  const handleVerify = async (searchToken?: string) => {
    const token = searchToken || query.trim();
    if (!token) return;
    setStatus("loading");

    // Search by verification_token or serial_number
    const { data, error } = await supabase
      .from("certificates")
      .select("id, serial_number, recipient_name, recipient_data, status, issued_at, organization_id")
      .or(`verification_token.eq.${token},serial_number.eq.${token}`)
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      setStatus("not-found");
      setCertificate(null);
      return;
    }

    setCertificate(data as CertificateResult);

    // Get org name
    const { data: org } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", data.organization_id)
      .single();
    if (org) setOrgName(org.name);

    // Log verification
    await supabase.from("certificate_verifications").insert({
      certificate_id: data.id,
      user_agent: navigator.userAgent,
    });

    setStatus("found");
  };

  useEffect(() => {
    if (tokenFromUrl) {
      setQuery(tokenFromUrl);
      handleVerify(tokenFromUrl);
    }
  }, [tokenFromUrl]);

  const recipientData = certificate?.recipient_data as Record<string, string> | undefined;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto flex items-center justify-between h-16 px-6">
          <Link to="/" className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-accent" />
            <span className="font-heading text-xl font-semibold text-foreground">CertifyPro</span>
          </Link>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/">Back to Home</Link>
          </Button>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-md text-center space-y-8">
          <div>
            <h1 className="font-heading text-3xl font-bold text-foreground">Verify Certificate</h1>
            <p className="mt-2 text-muted-foreground">
              Enter the certificate ID or scan the QR code to verify authenticity.
            </p>
          </div>

          <div className="flex gap-2">
            <Input
              placeholder="Enter Certificate ID or Token..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (status !== "idle") setStatus("idle");
              }}
              onKeyDown={(e) => e.key === "Enter" && handleVerify()}
              className="text-center"
            />
            <Button variant="hero" onClick={() => handleVerify()} disabled={status === "loading"}>
              {status === "loading" ? (
                <div className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </div>

          {status === "found" && certificate && (
            <div className="rounded-xl border border-border bg-card p-6 animate-fade-up">
              <CheckCircle className="h-12 w-12 text-success mx-auto mb-4" />
              <h3 className="font-heading text-lg font-semibold text-foreground">Certificate Verified</h3>
              <div className="mt-4 space-y-0 text-sm text-left">
                <Row label="Holder" value={certificate.recipient_name} />
                {orgName && <Row label="Issuer" value={orgName} />}
                <Row
                  label="Issue Date"
                  value={new Date(certificate.issued_at).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                />
                <Row label="Serial" value={certificate.serial_number} />
                {recipientData &&
                  Object.entries(recipientData)
                    .filter(([key]) => !["name", "email", "recipient_name", "recipient_email"].includes(key.toLowerCase()))
                    .map(([key, val]) => (
                      <Row
                        key={key}
                        label={key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                        value={String(val)}
                      />
                    ))}
                <div className="flex justify-between py-2.5">
                  <span className="text-muted-foreground">Status</span>
                  <span className={`inline-flex items-center gap-1 font-medium capitalize ${statusColors[certificate.status] || "text-foreground"}`}>
                    {certificate.status === "active" && <CheckCircle className="h-3.5 w-3.5" />}
                    {certificate.status === "revoked" && <XCircle className="h-3.5 w-3.5" />}
                    {certificate.status}
                  </span>
                </div>
              </div>
            </div>
          )}

          {status === "not-found" && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 animate-fade-up">
              <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h3 className="font-heading text-lg font-semibold text-foreground">Certificate Not Found</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                No certificate matches this ID. Please check and try again.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between py-2.5 border-b border-border">
    <span className="text-muted-foreground">{label}</span>
    <span className="font-medium text-foreground text-right max-w-[60%] break-words">{value}</span>
  </div>
);

export default Verify;
