import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, Upload, RotateCcw, Save, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface PhotoUploadModalProps {
  open: boolean;
  onClose: () => void;
  registrationId: string;
  currentPhotoUrl?: string | null;
  onPhotoUpdated: (newUrl: string) => void;
  youthName: string;
}

export default function PhotoUploadModal({
  open,
  onClose,
  registrationId,
  onPhotoUpdated,
  youthName,
}: PhotoUploadModalProps) {
  const [capturedImage, setCapturedImage] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const size = 640;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const scale = Math.max(size / img.width, size / img.height);
        const x = (size - img.width * scale) / 2;
        const y = (size - img.height * scale) / 2;
        ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
        canvas.toBlob((blob) => {
          if (blob) {
            setCapturedImage(blob);
            setPreviewUrl(URL.createObjectURL(blob));
          }
        }, "image/jpeg", 0.9);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    // Reset input so same file can be re-selected
    e.target.value = "";
  };

  const uploadPhoto = async () => {
    if (!capturedImage) return;
    setUploading(true);
    try {
      const fileName = `${registrationId}/profile_${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("youth-photos")
        .upload(fileName, capturedImage, {
          contentType: "image/jpeg",
          upsert: true,
        });

      if (uploadError) {
        console.error("Storage upload error:", uploadError);
        throw uploadError;
      }

      const { data: publicUrlData } = supabase.storage
        .from("youth-photos")
        .getPublicUrl(fileName);

      const publicUrl = publicUrlData.publicUrl;

      // Use SECURITY DEFINER function to bypass any RLS/auth issues on the kiosk
      const { error: rpcError } = await supabase.rpc("update_youth_headshot", {
        _registration_id: registrationId,
        _headshot_url: publicUrl,
      });

      if (rpcError) {
        console.error("RPC update error:", rpcError);
        throw rpcError;
      }

      toast.success("Profile picture updated successfully");
      onPhotoUpdated(publicUrl);
      handleClose();
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(`Failed to upload photo: ${error?.message || "Please try again."}`);
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    setCapturedImage(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    onClose();
  };

  const resetCapture = () => {
    setCapturedImage(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md bg-zinc-900 border-white/10 text-white">
        <DialogHeader>
          <DialogTitle className="text-white">Update Photo — {youthName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!previewUrl && (
            <div className="space-y-3">
              {/* Camera input — uses native device camera on mobile/iPad */}
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFileChange}
              />
              <Button
                onClick={() => cameraInputRef.current?.click()}
                className="w-full gap-2 h-14 text-lg bg-white/10 hover:bg-white/20 text-white border border-white/20"
                variant="outline"
              >
                <Camera className="w-5 h-5" />
                Take Photo
              </Button>

              <div className="text-center text-sm text-white/40">or</div>

              {/* File picker — opens photo library / files */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                className="w-full gap-2 h-12 bg-white/5 hover:bg-white/10 text-white/80 border border-white/10"
                variant="outline"
              >
                <Upload className="w-4 h-4" />
                Choose from Library
              </Button>
            </div>
          )}

          {previewUrl && (
            <div className="space-y-4">
              <div className="relative rounded-xl overflow-hidden border-2 border-white/10">
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="w-full aspect-square object-cover"
                />
              </div>
              <div className="flex gap-3">
                <Button
                  onClick={resetCapture}
                  variant="outline"
                  className="flex-1 h-12 bg-white/5 border-white/20 text-white hover:bg-white/10"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Retake
                </Button>
                <Button
                  onClick={uploadPhoto}
                  disabled={uploading}
                  className="flex-1 h-12 bg-green-600 hover:bg-green-500 text-white font-bold"
                >
                  {uploading ? (
                    "Saving..."
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save Photo
                    </>
                  )}
                </Button>
              </div>
              <Button onClick={handleClose} variant="ghost" className="w-full text-white/50 hover:text-white hover:bg-white/5">
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
