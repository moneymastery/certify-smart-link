import { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShieldCheck, Search, CheckCircle, XCircle, AlertTriangle, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface CertificateResult {
  id: string;
  serial_number: string;
  recipient_name: string;
  recipient_data: Record<string, string>;
  status: string;
  issued_at: string;
  organization_id: string;
  template_id: string;
}

interface OrgBranding {
  org_name: string;
  org_logo_url: string | null;
  verification_fields: string[];
}

const Verify = () => {
  const { id: tokenFromUrl } = useParams<{ id: string }>();
  const [query, setQuery] = useState(tokenFromUrl || "");
  const [certificate, setCertificate] = useState<CertificateResult | null>(null);
  const [branding, setBranding] = useState<OrgBranding | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "found" | "not-found">("idle");

  const handleVerify = async (searchToken?: string) => {
    const token = searchToken || query.trim();
    if (!token) return;
    setStatus("loading");

    let cert: any = null;
    let usedFallback = false;

    try {
      const { data, error } = await supabase.rpc("verify_certificate_by_token", {
        _token: token,
      });

      const result = Array.isArray(data) ? data[0] : data;
      if (!error && result) {
        cert = result;
      }
    } catch {
      // Primary API unreachable — will try fallback
    }

    // Static fallback: if primary failed, try GitHub-hosted manifest
    if (!cert) {
      try {
        const fallbackUrl = `${window.location.origin}/certificates-manifest.json`;
        const res = await fetch(fallbackUrl, { signal: AbortSignal.timeout(5000) });
        if (res.ok) {
          const manifest = await res.json();
          const match = Array.isArray(manifest)
            ? manifest.find((c: any) => c.verification_token === token)
            : null;
          if (match) {
            cert = match;
            usedFallback = true;
          }
        }
      } catch {
        // Fallback also unavailable
      }
    }

    if (!cert) {
      setStatus("not-found");
      setCertificate(null);
      setBranding(null);
      return;
    }

    setCertificate(cert as CertificateResult);

    // Get org branding (skip if using fallback — branding may be embedded)
    if (!usedFallback) {
      try {
        const { data: brandingData } = await supabase.rpc("get_org_branding_for_certificate", {
          _cert_id: cert.id,
        });
        const b = Array.isArray(brandingData) ? brandingData[0] : brandingData;
        if (b) setBranding(b as OrgBranding);
      } catch {
        // Branding fetch failed, continue with defaults
      }

      // Log verification
      try {
        await supabase.from("certificate_verifications").insert({
          certificate_id: cert.id,
          user_agent: navigator.userAgent,
        });
      } catch {
        // Non-critical
      }
    } else if (cert.branding) {
      setBranding(cert.branding as OrgBranding);
    }

    setStatus("found");
  };

  useEffect(() => {
    if (tokenFromUrl) {
      setQuery(tokenFromUrl);
      handleVerify(tokenFromUrl);
    }
  }, [tokenFromUrl]);

  const recipientData = certificate?.recipient_data as Record<string, string> | undefined;
  const isRevoked = certificate?.status === "revoked";
  const isActive = certificate?.status === "active";

  // Filter fields: use verification_fields if set, otherwise show all non-email fields
  const visibleFields = recipientData
    ? Object.entries(recipientData).filter(([key]) => {
        const lowerKey = key.toLowerCase();
        if (["name", "email", "recipient_name", "recipient_email"].includes(lowerKey)) return false;
        if (branding?.verification_fields && branding.verification_fields.length > 0) {
          return branding.verification_fields.includes(key);
        }
        return true;
      })
    : [];

  const displayName = branding?.org_name || "CertifyPro";
  const logoUrl = branding?.org_logo_url;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto flex items-center justify-between h-14 px-4">
          <Link to="/" className="flex items-center gap-2">
            {logoUrl ? (
              <img src={logoUrl} alt={displayName} className="h-7 w-7 rounded object-contain" />
            ) : (
              <ShieldCheck className="h-5 w-5 text-primary" />
            )}
            <span className="font-heading text-lg font-semibold text-foreground">{displayName}</span>
          </Link>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/">Home</Link>
          </Button>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex items-start justify-center px-4 py-8 sm:py-16">
        <div className="w-full max-w-sm space-y-6">
          {/* Title */}
          <div className="text-center">
            <h1 className="font-heading text-2xl font-bold text-foreground">Verify Certificate</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Enter the certificate ID or scan the QR code.
            </p>
          </div>

          {/* Search */}
          <div className="flex gap-2">
            <Input
              placeholder="Certificate ID or Token..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (status !== "idle") setStatus("idle");
              }}
              onKeyDown={(e) => e.key === "Enter" && handleVerify()}
            />
            <Button onClick={() => handleVerify()} disabled={status === "loading"} size="icon" className="shrink-0">
              {status === "loading" ? (
                <div className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* ✅ Verified */}
          {status === "found" && certificate && isActive && (
            <VerifiedCard
              certificate={certificate}
              displayName={displayName}
              visibleFields={visibleFields}
            />
          )}

          {/* ⚠️ Revoked */}
          {status === "found" && certificate && isRevoked && (
            <RevokedCard certificate={certificate} displayName={displayName} />
          )}

          {/* Found but other status */}
          {status === "found" && certificate && !isActive && !isRevoked && (
            <OtherStatusCard certificate={certificate} displayName={displayName} />
          )}

          {/* ❌ Not found */}
          {status === "not-found" && <NotFoundCard />}

          {/* Footer */}
          <p className="text-center text-xs text-muted-foreground pt-4">
            {branding ? (
              <>Verified by <span className="font-medium text-foreground">{displayName}</span> · Powered by <span className="font-medium text-foreground">CertifyPro</span></>
            ) : (
              <>Powered by <span className="font-medium text-foreground">CertifyPro</span></>
            )}
          </p>
        </div>
      </main>
    </div>
  );
};

/* ─── Sub-components ──────────────────────────── */

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between py-2.5 border-b border-border last:border-0">
    <span className="text-muted-foreground">{label}</span>
    <span className="font-medium text-foreground text-right max-w-[60%] break-words">{value}</span>
  </div>
);

const VerifiedCard = ({
  certificate,
  displayName,
  visibleFields,
}: {
  certificate: CertificateResult;
  displayName: string;
  visibleFields: [string, string][];
}) => (
  <div className="rounded-xl border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30 p-6 animate-fade-up">
    <div className="flex flex-col items-center mb-5">
      <div className="h-14 w-14 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center mb-3">
        <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
      </div>
      <h3 className="font-heading text-lg font-bold text-green-700 dark:text-green-400">
        Certificate Verified
      </h3>
    </div>
    <div className="space-y-0 text-sm">
      <Row label="Holder" value={certificate.recipient_name} />
      <Row label="Issued by" value={displayName} />
      <Row
        label="Issue Date"
        value={new Date(certificate.issued_at).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })}
      />
      <Row label="ID" value={certificate.serial_number} />
      {visibleFields.map(([key, val]) => (
        <Row
          key={key}
          label={key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
          value={String(val)}
        />
      ))}
      <div className="flex justify-between py-2.5">
        <span className="text-muted-foreground">Status</span>
        <span className="inline-flex items-center gap-1 font-medium text-green-600 dark:text-green-400">
          <CheckCircle className="h-3.5 w-3.5" />
          Active
        </span>
      </div>
    </div>
  </div>
);

const RevokedCard = ({ certificate, displayName }: { certificate: CertificateResult; displayName: string }) => (
  <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-6 animate-fade-up">
    <div className="flex flex-col items-center mb-5">
      <div className="h-14 w-14 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center mb-3">
        <AlertTriangle className="h-8 w-8 text-amber-600 dark:text-amber-400" />
      </div>
      <h3 className="font-heading text-lg font-bold text-amber-700 dark:text-amber-400">
        Certificate Revoked
      </h3>
    </div>
    <div className="space-y-0 text-sm">
      <Row label="Holder" value={certificate.recipient_name} />
      <Row label="Issued by" value={displayName} />
      <Row label="ID" value={certificate.serial_number} />
      <div className="flex justify-between py-2.5">
        <span className="text-muted-foreground">Status</span>
        <span className="inline-flex items-center gap-1 font-medium text-amber-600 dark:text-amber-400">
          <XCircle className="h-3.5 w-3.5" />
          Revoked
        </span>
      </div>
    </div>
  </div>
);

const OtherStatusCard = ({ certificate, displayName }: { certificate: CertificateResult; displayName: string }) => (
  <div className="rounded-xl border border-border bg-card p-6 animate-fade-up">
    <div className="flex flex-col items-center mb-5">
      <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mb-3">
        <Clock className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="font-heading text-lg font-bold text-foreground capitalize">
        Certificate {certificate.status}
      </h3>
    </div>
    <div className="space-y-0 text-sm">
      <Row label="Holder" value={certificate.recipient_name} />
      <Row label="Issued by" value={displayName} />
      <Row label="ID" value={certificate.serial_number} />
    </div>
  </div>
);

const NotFoundCard = () => (
  <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 animate-fade-up">
    <div className="flex flex-col items-center">
      <div className="h-14 w-14 rounded-full bg-destructive/10 flex items-center justify-center mb-3">
        <XCircle className="h-8 w-8 text-destructive" />
      </div>
      <h3 className="font-heading text-lg font-bold text-foreground">Invalid Certificate</h3>
      <p className="mt-2 text-sm text-muted-foreground text-center">
        No certificate matches this ID. Please check and try again.
      </p>
    </div>
  </div>
);

export default Verify;
