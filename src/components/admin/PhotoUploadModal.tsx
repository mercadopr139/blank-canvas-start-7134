import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, RotateCcw, Save, X } from "lucide-react";
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
  currentPhotoUrl,
  onPhotoUpdated,
  youthName,
}: PhotoUploadModalProps) {
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 640 },
        audio: false,
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (error) {
      toast.error("Failed to access camera. Please use file upload instead.");
      console.error("Camera error:", error);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 640;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(videoRef.current, 0, 0, 640, 640);
    const dataUrl = canvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob);
        setCapturedImage(url);
        stopCamera();
      }
    }, "image/jpeg", 0.9);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
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
            const url = URL.createObjectURL(blob);
            setCapturedImage(url);
          }
        }, "image/jpeg", 0.9);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const uploadPhoto = async () => {
    if (!capturedImage) return;
    setUploading(true);
    try {
      const blob = await fetch(capturedImage).then((r) => r.blob());
      const fileName = `youth-photos/${registrationId}/profile.jpg`;
      
      // Upload to storage (overwrites existing)
      const { error: uploadError } = await supabase.storage
        .from("youth-photos")
        .upload(fileName, blob, {
          contentType: "image/jpeg",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from("youth-photos")
        .getPublicUrl(fileName);

      const publicUrl = publicUrlData.publicUrl;

      // Update registration record
      const { error: updateError } = await supabase
        .from("youth_registrations")
        .update({ child_headshot_url: publicUrl })
        .eq("id", registrationId);

      if (updateError) throw updateError;

      toast.success("Photo updated successfully");
      onPhotoUpdated(publicUrl);
      handleClose();
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload photo");
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    stopCamera();
    setCapturedImage(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Update Photo - {youthName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!capturedImage && !stream && (
            <div className="space-y-3">
              <Button
                onClick={startCamera}
                className="w-full gap-2"
                variant="outline"
              >
                <Camera className="w-4 h-4" />
                Open Camera
              </Button>
              <div className="text-center text-sm text-muted-foreground">or</div>
              <Button
                onClick={() => fileInputRef.current?.click()}
                className="w-full"
                variant="secondary"
              >
                Choose from Files
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>
          )}

          {stream && !capturedImage && (
            <div className="space-y-3">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full rounded-lg bg-black"
              />
              <div className="flex gap-2">
                <Button onClick={capturePhoto} className="flex-1">
                  <Camera className="w-4 h-4 mr-2" />
                  Capture Photo
                </Button>
                <Button onClick={stopCamera} variant="outline">
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {capturedImage && (
            <div className="space-y-3">
              <img
                src={capturedImage}
                alt="Preview"
                className="w-full rounded-lg border"
              />
              <div className="flex gap-2">
                <Button
                  onClick={() => setCapturedImage(null)}
                  variant="outline"
                  className="flex-1"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Retake
                </Button>
                <Button
                  onClick={uploadPhoto}
                  disabled={uploading}
                  className="flex-1"
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
              <Button onClick={handleClose} variant="ghost" className="w-full">
                Cancel
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
