import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  generateCertificatePDF,
  generateSerialNumber,
  type CertificateData,
  type GenerationConfig,
} from "@/lib/certificate-generator";
import JSZip from "jszip";
import { toast } from "@/hooks/use-toast";

interface BatchRow {
  recipientName: string;
  recipientEmail?: string;
  recipientData: Record<string, string>;
}

interface GeneratedCertificateFile {
  serialNumber: string;
  recipientName: string;
  pdfUrl: string;
  pdfBlob?: Blob;
}

interface GenerationResult {
  success: number;
  failed: number;
  certificates: GeneratedCertificateFile[];
}

const yieldToBrowser = () => new Promise((resolve) => window.setTimeout(resolve, 0));

export const useCertificateGeneration = () => {
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);

  const generateBatch = useCallback(
    async (
      rows: BatchRow[],
      config: GenerationConfig,
      organizationId: string,
      templateId: string,
      batchId: string
    ): Promise<GenerationResult> => {
      setGenerating(true);
      setTotal(rows.length);
      setProgress(0);

      const verifyBaseUrl = "https://verify-ease-pro.lovable.app";
      const results: GenerationResult = { success: 0, failed: 0, certificates: [] };

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const serialNumber = generateSerialNumber();

        try {
          const certData: CertificateData = {
            recipientName: row.recipientName,
            recipientEmail: row.recipientEmail,
            recipientData: row.recipientData,
            serialNumber,
            verificationToken: "",
          };

          const { data: certRecord, error: insertError } = await supabase
            .from("certificates")
            .insert({
              organization_id: organizationId,
              template_id: templateId,
              batch_id: batchId,
              serial_number: serialNumber,
              recipient_name: row.recipientName,
              recipient_email: row.recipientEmail || null,
              recipient_data: row.recipientData,
              status: "active",
            })
            .select("id, verification_token")
            .single();

          if (insertError || !certRecord) {
            console.error("Insert error:", insertError);
            results.failed++;
            setProgress(i + 1);
            continue;
          }

          certData.verificationToken = certRecord.verification_token;
          const pdfBytes = await generateCertificatePDF(certData, config, verifyBaseUrl);
          const pdfBuffer = new Uint8Array(pdfBytes.length);
          pdfBuffer.set(pdfBytes);
          const pdfBlob = new Blob([pdfBuffer.buffer], { type: "application/pdf" });

          const pdfPath = `${organizationId}/${batchId}/${certRecord.id}.pdf`;
          const { error: uploadError } = await supabase.storage
            .from("generated-certificates")
            .upload(pdfPath, pdfBlob, { contentType: "application/pdf" });

          if (uploadError) {
            console.error("Upload error:", uploadError);
            results.failed++;
            setProgress(i + 1);
            continue;
          }

          const { data: urlData } = supabase.storage
            .from("generated-certificates")
            .getPublicUrl(pdfPath);

          const pdfUrl = urlData.publicUrl;

          const { error: updateError } = await supabase
            .from("certificates")
            .update({ pdf_url: pdfUrl })
            .eq("id", certRecord.id);

          if (updateError) {
            console.error("Certificate update error:", updateError);
            results.failed++;
            setProgress(i + 1);
            continue;
          }

          results.success++;
          results.certificates.push({
            serialNumber,
            recipientName: row.recipientName,
            pdfUrl,
          });
        } catch (err) {
          console.error("Generation error for", row.recipientName, err);
          results.failed++;
        }

        setProgress(i + 1);

        if ((i + 1) % 5 === 0) {
          await supabase
            .from("certificate_batches")
            .update({
              status: "processing",
              generated_count: results.success,
            })
            .eq("id", batchId);
          await yieldToBrowser();
        }
      }

      await supabase
        .from("certificate_batches")
        .update({
          status: results.failed === rows.length ? "failed" : "completed",
          generated_count: results.success,
        })
        .eq("id", batchId);

      setGenerating(false);
      return results;
    },
    []
  );

  const downloadBatchAsZip = useCallback(
    async (certificates: GeneratedCertificateFile[], batchName: string) => {
      const zip = new JSZip();

      for (let i = 0; i < certificates.length; i++) {
        const cert = certificates[i];
        const safeName = cert.recipientName.replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "_");
        const pdfBlob =
          cert.pdfBlob ??
          (await fetch(cert.pdfUrl).then(async (response) => {
            if (!response.ok) {
              throw new Error(`Failed to fetch certificate for ${cert.recipientName}`);
            }
            return response.blob();
          }));

        zip.file(`${safeName}_${cert.serialNumber}.pdf`, pdfBlob);

        if ((i + 1) % 5 === 0) {
          await yieldToBrowser();
        }
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${batchName.replace(/\s+/g, "_")}_certificates.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({ title: "Download complete", description: `${certificates.length} certificates downloaded.` });
    },
    []
  );

  return { generateBatch, downloadBatchAsZip, generating, progress, total };
};
