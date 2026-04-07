import { useState, useRef, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ShieldCheck,
  ArrowLeft,
  Upload,
  Image,
  PenTool,
  Stamp,
  Plus,
  Trash2,
  Save,
  GripVertical,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

interface FieldItem {
  id: string;
  fieldKey: string;
  label: string;
  xPosition: number;
  yPosition: number;
  fontSize: number;
  fontColor: string;
  textAlign: string;
  maxWidth: number | null;
}

const DEFAULT_FIELDS: Omit<FieldItem, "id">[] = [
  { fieldKey: "recipient_name", label: "Recipient Name", xPosition: 50, yPosition: 45, fontSize: 28, fontColor: "#1a1a2e", textAlign: "center", maxWidth: 600 },
  { fieldKey: "course", label: "Course Name", xPosition: 50, yPosition: 58, fontSize: 16, fontColor: "#444444", textAlign: "center", maxWidth: 500 },
  { fieldKey: "date", label: "Date", xPosition: 50, yPosition: 70, fontSize: 14, fontColor: "#666666", textAlign: "center", maxWidth: 300 },
];

const TemplateBuilder = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLDivElement>(null);

  const [templateName, setTemplateName] = useState("My Certificate Template");
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [sealUrl, setSealUrl] = useState<string | null>(null);
  const [fields, setFields] = useState<FieldItem[]>(
    DEFAULT_FIELDS.map((f, i) => ({ ...f, id: `field-${i}` }))
  );
  const [draggingField, setDraggingField] = useState<string | null>(null);
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [orgId, setOrgId] = useState<string | null>(null);

  // Canvas dimensions (display)
  const CANVAS_WIDTH = 842;
  const CANVAS_HEIGHT = 595;

  useEffect(() => {
    if (!user) return;
    const getOrg = async () => {
      let { data: orgs } = await supabase.from("organizations").select("id").limit(1);
      let org = orgs?.[0];
      if (!org) {
        const slug = `org-${user.id.substring(0, 8)}`;
        const { data: newOrg } = await supabase
          .from("organizations")
          .insert({ name: "My Organization", slug, owner_id: user.id })
          .select("id")
          .single();
        org = newOrg;
      }
      if (org) setOrgId(org.id);
    };
    getOrg();
  }, [user]);

  const uploadFile = async (file: File, bucket: string, path: string): Promise<string | null> => {
    const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
    if (error) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
      return null;
    }
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  };

  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "background" | "logo" | "signature" | "seal"
  ) => {
    const file = e.target.files?.[0];
    if (!file || !orgId) return;

    const path = `${orgId}/${type}-${Date.now()}.${file.name.split(".").pop()}`;
    const url = await uploadFile(file, "certificate-templates", path);
    if (!url) return;

    switch (type) {
      case "background": setBackgroundUrl(url); break;
      case "logo": setLogoUrl(url); break;
      case "signature": setSignatureUrl(url); break;
      case "seal": setSealUrl(url); break;
    }
  };

  const handleMouseDown = (fieldId: string, e: React.MouseEvent) => {
    e.preventDefault();
    setDraggingField(fieldId);
    setSelectedField(fieldId);
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!draggingField || !canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      setFields((prev) =>
        prev.map((f) =>
          f.id === draggingField
            ? { ...f, xPosition: Math.max(0, Math.min(100, x)), yPosition: Math.max(0, Math.min(100, y)) }
            : f
        )
      );
    },
    [draggingField]
  );

  const handleMouseUp = useCallback(() => {
    setDraggingField(null);
  }, []);

  useEffect(() => {
    if (draggingField) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [draggingField, handleMouseMove, handleMouseUp]);

  const addField = () => {
    const newField: FieldItem = {
      id: `field-${Date.now()}`,
      fieldKey: `field_${fields.length + 1}`,
      label: `Field ${fields.length + 1}`,
      xPosition: 50,
      yPosition: 50,
      fontSize: 16,
      fontColor: "#333333",
      textAlign: "center",
      maxWidth: null,
    };
    setFields([...fields, newField]);
    setSelectedField(newField.id);
  };

  const removeField = (id: string) => {
    setFields(fields.filter((f) => f.id !== id));
    if (selectedField === id) setSelectedField(null);
  };

  const updateField = (id: string, updates: Partial<FieldItem>) => {
    setFields(fields.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  };

  const handleSave = async () => {
    if (!user || !orgId) return;
    setSaving(true);

    try {
      const { data: template, error: tmplErr } = await supabase
        .from("templates")
        .insert({
          organization_id: orgId,
          name: templateName,
          created_by: user.id,
          width_px: CANVAS_WIDTH,
          height_px: CANVAS_HEIGHT,
          background_url: backgroundUrl,
          logo_url: logoUrl,
          signature_url: signatureUrl,
          seal_url: sealUrl,
        })
        .select("id")
        .single();

      if (tmplErr) throw tmplErr;

      // Insert fields
      const fieldRows = fields.map((f, i) => ({
        template_id: template.id,
        field_key: f.fieldKey,
        label: f.label,
        x_position: f.xPosition,
        y_position: f.yPosition,
        font_size: f.fontSize,
        font_color: f.fontColor,
        text_align: f.textAlign,
        max_width: f.maxWidth,
        sort_order: i,
      }));

      const { error: fieldsErr } = await supabase.from("template_fields").insert(fieldRows);
      if (fieldsErr) throw fieldsErr;

      toast({ title: "Template saved!", description: "Your certificate template has been created." });
      navigate("/dashboard");
    } catch (error: any) {
      toast({ title: "Error saving template", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const selectedFieldData = fields.find((f) => f.id === selectedField);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card shrink-0">
        <div className="flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/dashboard"><ArrowLeft className="h-4 w-4" /></Link>
            </Button>
            <ShieldCheck className="h-5 w-5 text-accent" />
            <Input
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              className="border-none bg-transparent font-heading text-lg font-semibold h-auto p-0 focus-visible:ring-0 w-64"
            />
          </div>
          <Button variant="hero" size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Template
          </Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Left sidebar - uploads */}
        <aside className="w-60 border-r border-border bg-card p-4 space-y-5 overflow-y-auto shrink-0">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Assets</h3>

          {[
            { type: "background" as const, label: "Background", icon: Image, url: backgroundUrl },
            { type: "logo" as const, label: "Logo", icon: ShieldCheck, url: logoUrl },
            { type: "signature" as const, label: "Signature", icon: PenTool, url: signatureUrl },
            { type: "seal" as const, label: "Seal / Stamp", icon: Stamp, url: sealUrl },
          ].map((asset) => (
            <div key={asset.type} className="space-y-2">
              <Label className="text-xs">{asset.label}</Label>
              {asset.url ? (
                <div className="relative group">
                  <img src={asset.url} alt={asset.label} className="w-full h-20 object-contain rounded-md border border-border bg-muted" />
                  <label className="absolute inset-0 flex items-center justify-center bg-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-md">
                    <span className="text-xs text-background font-medium">Replace</span>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, asset.type)} />
                  </label>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center h-20 rounded-md border border-dashed border-border bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors">
                  <Upload className="h-4 w-4 text-muted-foreground mb-1" />
                  <span className="text-xs text-muted-foreground">Upload</span>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, asset.type)} />
                </label>
              )}
            </div>
          ))}

          <div className="border-t border-border pt-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Fields</h3>
            <div className="space-y-1">
              {fields.map((field) => (
                <button
                  key={field.id}
                  onClick={() => setSelectedField(field.id)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors ${
                    selectedField === field.id
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-muted"
                  }`}
                >
                  <GripVertical className="h-3 w-3 shrink-0 opacity-50" />
                  <span className="truncate">{field.label}</span>
                </button>
              ))}
            </div>
            <Button variant="outline" size="sm" className="w-full mt-2" onClick={addField}>
              <Plus className="h-3 w-3" /> Add Field
            </Button>
          </div>
        </aside>

        {/* Canvas */}
        <div className="flex-1 bg-muted/30 flex items-center justify-center p-6 overflow-auto">
          <div
            ref={canvasRef}
            className="relative bg-background border border-border shadow-lg"
            style={{
              width: CANVAS_WIDTH,
              height: CANVAS_HEIGHT,
              backgroundImage: backgroundUrl ? `url(${backgroundUrl})` : undefined,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          >
            {/* Logo overlay */}
            {logoUrl && (
              <img src={logoUrl} alt="Logo" className="absolute top-4 left-1/2 -translate-x-1/2 h-12 object-contain" />
            )}

            {/* Signature overlay */}
            {signatureUrl && (
              <img src={signatureUrl} alt="Signature" className="absolute bottom-16 left-[25%] h-10 object-contain" />
            )}

            {/* Seal overlay */}
            {sealUrl && (
              <img src={sealUrl} alt="Seal" className="absolute bottom-12 right-[15%] h-16 object-contain" />
            )}

            {/* Draggable fields */}
            {fields.map((field) => (
              <div
                key={field.id}
                onMouseDown={(e) => handleMouseDown(field.id, e)}
                onClick={() => setSelectedField(field.id)}
                className={`absolute cursor-move select-none px-2 py-1 rounded transition-shadow ${
                  selectedField === field.id
                    ? "ring-2 ring-accent ring-offset-1 shadow-md"
                    : "hover:ring-1 hover:ring-border"
                }`}
                style={{
                  left: `${field.xPosition}%`,
                  top: `${field.yPosition}%`,
                  transform: "translate(-50%, -50%)",
                  fontSize: field.fontSize,
                  color: field.fontColor,
                  textAlign: field.textAlign as any,
                  maxWidth: field.maxWidth || undefined,
                }}
              >
                {`{{${field.fieldKey}}}`}
              </div>
            ))}

            {/* Empty state */}
            {!backgroundUrl && fields.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <Image className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Upload a background image to start</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right sidebar - field properties */}
        {selectedFieldData && (
          <aside className="w-64 border-l border-border bg-card p-4 space-y-4 overflow-y-auto shrink-0">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Field Properties</h3>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeField(selectedFieldData.id)}>
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Label</Label>
                <Input
                  value={selectedFieldData.label}
                  onChange={(e) => updateField(selectedFieldData.id, { label: e.target.value })}
                  className="h-8 text-sm"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Field Key (CSV column)</Label>
                <Input
                  value={selectedFieldData.fieldKey}
                  onChange={(e) => updateField(selectedFieldData.id, { fieldKey: e.target.value })}
                  className="h-8 text-sm font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">X (%)</Label>
                  <Input
                    type="number"
                    value={Math.round(selectedFieldData.xPosition)}
                    onChange={(e) => updateField(selectedFieldData.id, { xPosition: Number(e.target.value) })}
                    className="h-8 text-sm"
                    min={0}
                    max={100}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Y (%)</Label>
                  <Input
                    type="number"
                    value={Math.round(selectedFieldData.yPosition)}
                    onChange={(e) => updateField(selectedFieldData.id, { yPosition: Number(e.target.value) })}
                    className="h-8 text-sm"
                    min={0}
                    max={100}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Font Size</Label>
                <Input
                  type="number"
                  value={selectedFieldData.fontSize}
                  onChange={(e) => updateField(selectedFieldData.id, { fontSize: Number(e.target.value) })}
                  className="h-8 text-sm"
                  min={8}
                  max={72}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Color</Label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={selectedFieldData.fontColor}
                    onChange={(e) => updateField(selectedFieldData.id, { fontColor: e.target.value })}
                    className="h-8 w-8 rounded border border-border cursor-pointer"
                  />
                  <Input
                    value={selectedFieldData.fontColor}
                    onChange={(e) => updateField(selectedFieldData.id, { fontColor: e.target.value })}
                    className="h-8 text-sm font-mono flex-1"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Align</Label>
                <div className="flex gap-1">
                  {["left", "center", "right"].map((a) => (
                    <Button
                      key={a}
                      variant={selectedFieldData.textAlign === a ? "default" : "outline"}
                      size="sm"
                      className="flex-1 h-7 text-xs capitalize"
                      onClick={() => updateField(selectedFieldData.id, { textAlign: a })}
                    >
                      {a}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Max Width (px)</Label>
                <Input
                  type="number"
                  value={selectedFieldData.maxWidth || ""}
                  onChange={(e) =>
                    updateField(selectedFieldData.id, {
                      maxWidth: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  className="h-8 text-sm"
                  placeholder="Auto"
                />
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};

export default TemplateBuilder;
