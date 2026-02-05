 import { useRef, useEffect, useState } from "react";
 import { Button } from "@/components/ui/button";
 import { Eraser } from "lucide-react";
 
 interface SignatureCanvasProps {
   onSignatureChange: (blob: Blob | null) => void;
 }
 
 const SignatureCanvas = ({ onSignatureChange }: SignatureCanvasProps) => {
   const canvasRef = useRef<HTMLCanvasElement>(null);
   const [isDrawing, setIsDrawing] = useState(false);
   const [hasSignature, setHasSignature] = useState(false);
 
   useEffect(() => {
     const canvas = canvasRef.current;
     if (!canvas) return;
 
     const ctx = canvas.getContext("2d");
     if (!ctx) return;
 
     // Set up canvas
     ctx.strokeStyle = "#000";
     ctx.lineWidth = 2;
     ctx.lineCap = "round";
     ctx.lineJoin = "round";
 
     // Fill with white background
     ctx.fillStyle = "#fff";
     ctx.fillRect(0, 0, canvas.width, canvas.height);
   }, []);
 
   const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
     const canvas = canvasRef.current;
     if (!canvas) return { x: 0, y: 0 };
 
     const rect = canvas.getBoundingClientRect();
     const scaleX = canvas.width / rect.width;
     const scaleY = canvas.height / rect.height;
 
     if ("touches" in e) {
       return {
         x: (e.touches[0].clientX - rect.left) * scaleX,
         y: (e.touches[0].clientY - rect.top) * scaleY,
       };
     } else {
       return {
         x: (e.clientX - rect.left) * scaleX,
         y: (e.clientY - rect.top) * scaleY,
       };
     }
   };
 
   const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
     e.preventDefault();
     const canvas = canvasRef.current;
     const ctx = canvas?.getContext("2d");
     if (!ctx) return;
 
     const { x, y } = getCoordinates(e);
     ctx.beginPath();
     ctx.moveTo(x, y);
     setIsDrawing(true);
   };
 
   const draw = (e: React.MouseEvent | React.TouchEvent) => {
     if (!isDrawing) return;
     e.preventDefault();
 
     const canvas = canvasRef.current;
     const ctx = canvas?.getContext("2d");
     if (!ctx) return;
 
     const { x, y } = getCoordinates(e);
     ctx.lineTo(x, y);
     ctx.stroke();
     setHasSignature(true);
   };
 
   const stopDrawing = () => {
     if (!isDrawing) return;
     setIsDrawing(false);
 
     const canvas = canvasRef.current;
     if (!canvas) return;
 
     canvas.toBlob((blob) => {
       onSignatureChange(blob);
     }, "image/png");
   };
 
   const clearCanvas = () => {
     const canvas = canvasRef.current;
     const ctx = canvas?.getContext("2d");
     if (!ctx || !canvas) return;
 
     ctx.fillStyle = "#fff";
     ctx.fillRect(0, 0, canvas.width, canvas.height);
     setHasSignature(false);
     onSignatureChange(null);
   };
 
   return (
     <div className="space-y-2">
       <div className="relative border border-input rounded-md overflow-hidden bg-white">
         <canvas
           ref={canvasRef}
           width={400}
           height={150}
           className="w-full h-[150px] touch-none cursor-crosshair"
           onMouseDown={startDrawing}
           onMouseMove={draw}
           onMouseUp={stopDrawing}
           onMouseLeave={stopDrawing}
           onTouchStart={startDrawing}
           onTouchMove={draw}
           onTouchEnd={stopDrawing}
         />
         {!hasSignature && (
           <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
             <span className="text-muted-foreground text-sm">Sign here</span>
           </div>
         )}
       </div>
       <Button type="button" variant="outline" size="sm" onClick={clearCanvas}>
         <Eraser className="w-4 h-4 mr-1" /> Clear
       </Button>
     </div>
   );
 };
 
 export default SignatureCanvas;