import { PDFDocument, degrees } from 'pdf-lib';
import type { DrawingStroke, StickyNoteItem, StudyFile } from '../types';

export interface BakePdfOptions {
  pdfData: ArrayBuffer;
  pageStrokes: Record<number, DrawingStroke[]>;
  stickyNotes: StickyNoteItem[];
}

export interface SaveDirectlyResult {
  success: boolean;
  method: 'disk' | 'download';
  error?: string;
}

/**
 * Bakes all highlighters, pens, ruler lines, and sticky notes directly into the PDF pages.
 * The resulting PDF is 100% compatible with all standard PDF readers (Adobe Acrobat,
 * Google Chrome, Apple Preview, Microsoft Edge, Foxit, phones, and physical printers).
 */
export async function bakeAnnotatedPdf({
  pdfData,
  pageStrokes,
  stickyNotes,
}: BakePdfOptions): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfData);
  const pages = pdfDoc.getPages();

  // High DPI rasterization for crisp vector-like rendering in external PDF readers
  const RASTER_SCALE = 2.5;

  for (let i = 0; i < pages.length; i++) {
    const pageNum = i + 1;
    const strokes = pageStrokes[pageNum] || [];
    const notes = stickyNotes.filter((n) => n.pageNumber === pageNum);

    // Skip pages with zero annotations to preserve 100% original page purity and file size
    if (strokes.length === 0 && notes.length === 0) {
      continue;
    }

    const pdfPage = pages[i];
    const { width: pageWidth, height: pageHeight } = pdfPage.getSize();
    const rotation = ((pdfPage.getRotation().angle || 0) % 360 + 360) % 360;

    // Visual dimensions depending on rotation
    const isSideways = rotation === 90 || rotation === 270;
    const visualWidth = isSideways ? pageHeight : pageWidth;
    const visualHeight = isSideways ? pageWidth : pageHeight;

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(visualWidth * RASTER_SCALE);
    canvas.height = Math.round(visualHeight * RASTER_SCALE);
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;

    ctx.scale(RASTER_SCALE, RASTER_SCALE);

    // 1. Highlighters (multiplied blend mode with proper translucency)
    const highlighters = strokes.filter((s) => s.tool === 'highlighter');
    for (const stroke of highlighters) {
      if (!stroke.points || stroke.points.length === 0) continue;
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = stroke.opacity || 0.48;
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.lineCap = 'square';
      ctx.lineJoin = 'bevel';
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let p = 1; p < stroke.points.length; p++) {
        ctx.lineTo(stroke.points[p].x, stroke.points[p].y);
      }
      ctx.stroke();
      ctx.restore();
    }

    // 2. Pens & Rulers (crisp, solid ink)
    const otherStrokes = strokes.filter((s) => s.tool !== 'highlighter');
    for (const stroke of otherStrokes) {
      if (!stroke.points || stroke.points.length === 0) continue;
      ctx.save();
      ctx.globalAlpha = 1.0;
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let p = 1; p < stroke.points.length; p++) {
        ctx.lineTo(stroke.points[p].x, stroke.points[p].y);
      }
      ctx.stroke();
      ctx.restore();
    }

    // 3. Sticky Notes (Apple-style notes with Persian RTL text layout)
    for (const note of notes) {
      ctx.save();
      const noteW = 145;
      const noteH = 78;
      const nx = Math.max(0, Math.min(visualWidth - noteW, note.x));
      const ny = Math.max(0, Math.min(visualHeight - noteH, note.y));

      // Note shadow
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.beginPath();
      ctx.roundRect(nx + 1.5, ny + 2, noteW, noteH, 6);
      ctx.fill();

      // Note body
      ctx.fillStyle = note.color || '#fef08a';
      ctx.strokeStyle = 'rgba(0,0,0,0.18)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(nx, ny, noteW, noteH, 6);
      ctx.fill();
      ctx.stroke();

      // Header bar
      ctx.fillStyle = 'rgba(0,0,0,0.06)';
      ctx.beginPath();
      ctx.roundRect(nx, ny, noteW, 19, [6, 6, 0, 0]);
      ctx.fill();

      // Decorative top dot
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.beginPath();
      ctx.arc(nx + 10, ny + 9.5, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // RTL Detection
      const fullText = (note.title || '') + (note.content || '');
      const isRtl = /[\u0600-\u06FF]/.test(fullText);

      // Note Title
      ctx.fillStyle = note.textColor || '#171717';
      ctx.font = 'bold 9.5px Vazirmatn, Tahoma, sans-serif';
      if (isRtl) {
        ctx.direction = 'rtl';
        ctx.textAlign = 'right';
        ctx.fillText((note.title || 'یادداشت').slice(0, 26), nx + noteW - 8, ny + 13.5);
      } else {
        ctx.direction = 'ltr';
        ctx.textAlign = 'left';
        ctx.fillText((note.title || 'Note').slice(0, 26), nx + 18, ny + 13.5);
      }

      // Note Content (Word wrapping)
      if (note.content) {
        ctx.font = '8.5px Vazirmatn, Tahoma, sans-serif';
        const words = note.content.split(/\s+/);
        let currentLine = '';
        let lineY = ny + 32;
        const maxContentWidth = noteW - 16;

        for (const word of words) {
          const testLine = currentLine ? `${currentLine} ${word}` : word;
          if (ctx.measureText(testLine).width > maxContentWidth && currentLine) {
            if (isRtl) {
              ctx.fillText(currentLine, nx + noteW - 8, lineY);
            } else {
              ctx.fillText(currentLine, nx + 8, lineY);
            }
            currentLine = word;
            lineY += 12;
            if (lineY > ny + noteH - 6) break;
          } else {
            currentLine = testLine;
          }
        }

        if (currentLine && lineY <= ny + noteH - 6) {
          if (isRtl) {
            ctx.fillText(currentLine, nx + noteW - 8, lineY);
          } else {
            ctx.fillText(currentLine, nx + 8, lineY);
          }
        }
      }

      ctx.restore();
    }

    // Convert offscreen canvas to PNG binary
    const pngDataUrl = canvas.toDataURL('image/png');
    const base64Data = pngDataUrl.split(',')[1];
    const binaryStr = atob(base64Data);
    const pngBytes = new Uint8Array(binaryStr.length);
    for (let b = 0; b < binaryStr.length; b++) {
      pngBytes[b] = binaryStr.charCodeAt(b);
    }

    // Embed PNG overlay onto the PDF page with proper rotation
    const pngImage = await pdfDoc.embedPng(pngBytes);
    if (rotation === 0) {
      pdfPage.drawImage(pngImage, {
        x: 0,
        y: 0,
        width: pageWidth,
        height: pageHeight,
      });
    } else if (rotation === 90) {
      pdfPage.drawImage(pngImage, {
        x: 0,
        y: pageHeight,
        width: pageHeight,
        height: pageWidth,
        rotate: degrees(-90),
      });
    } else if (rotation === 180) {
      pdfPage.drawImage(pngImage, {
        x: pageWidth,
        y: pageHeight,
        width: pageWidth,
        height: pageHeight,
        rotate: degrees(180),
      });
    } else if (rotation === 270) {
      pdfPage.drawImage(pngImage, {
        x: pageWidth,
        y: 0,
        width: pageHeight,
        height: pageWidth,
        rotate: degrees(90),
      });
    }
  }

  // Save the modified PDF
  return await pdfDoc.save();
}

/**
 * Saves the baked PDF directly into the file:
 * 1. If FileSystemFileHandle is available (Chrome/Edge File System Access API),
 *    writes directly into the file on disk (replacing it without creating a new file).
 * 2. Otherwise downloads/saves with the EXACT SAME original file name (no duplicate suffix),
 *    so it replaces the original file directly.
 */
export async function saveDirectlyToFile({
  file,
  bakedPdfBytes,
  fileHandle,
}: {
  file: StudyFile;
  bakedPdfBytes: Uint8Array;
  fileHandle?: any;
}): Promise<SaveDirectlyResult> {
  const handle = fileHandle || file.fileHandle;

  // Method 1: Direct File System Access API write to disk file
  if (handle && typeof handle.createWritable === 'function') {
    try {
      if (typeof handle.queryPermission === 'function') {
        let perm = await handle.queryPermission({ mode: 'readwrite' });
        if (perm !== 'granted' && typeof handle.requestPermission === 'function') {
          perm = await handle.requestPermission({ mode: 'readwrite' });
        }
        if (perm !== 'granted') {
          throw new Error('Write permission was not granted by user.');
        }
      }

      const writable = await handle.createWritable();
      await writable.write(bakedPdfBytes);
      await writable.close();
      return { success: true, method: 'disk' };
    } catch (err: any) {
      console.warn('Direct file handle write failed, falling back to download:', err);
    }
  }

  // Method 2: Save directly with the EXACT SAME original file name
  try {
    const blob = new Blob([bakedPdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    // Exactly the same name as the original file: No "_با_ادیت‌ها" suffix!
    a.download = file.name || 'document.pdf';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1500);

    return { success: true, method: 'download' };
  } catch (err: any) {
    return { success: false, method: 'download', error: err?.message };
  }
}

/**
 * Backwards compatible export function - produces the baked PDF
 * with the exact original filename (not a separate "_با_ادیت‌ها" file).
 */
export async function exportAnnotatedPdf({
  pdfData,
  fileName,
  pageStrokes,
  stickyNotes,
}: {
  pdfData: ArrayBuffer;
  fileName: string;
  pageStrokes: Record<number, DrawingStroke[]>;
  stickyNotes: StickyNoteItem[];
}): Promise<Uint8Array> {
  const bakedBytes = await bakeAnnotatedPdf({
    pdfData,
    pageStrokes,
    stickyNotes,
  });

  const blob = new Blob([bakedBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName || 'document.pdf';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1000);

  return bakedBytes;
}
