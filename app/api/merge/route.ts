import { NextResponse } from "next/server";
import { extractPdfsFromZip } from "@/lib/unzip";
import { mergePdfs } from "@/lib/merge";
import { compressPdf } from "@/lib/compress";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    const pdfFile = formData.get("pdf") as File | null;
    const zip1File = formData.get("zip1") as File | null;
    const zip2File = formData.get("zip2") as File | null;

    // Validate all three files are present
    if (!pdfFile || !zip1File || !zip2File) {
      return NextResponse.json(
        { error: "All three files are required: 1 PDF and 2 ZIP files" },
        { status: 400 },
      );
    }

    // Validate file types
    if (!pdfFile.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json(
        { error: "First file must be a PDF" },
        { status: 400 },
      );
    }

    if (
      !zip1File.name.toLowerCase().endsWith(".zip") ||
      !zip2File.name.toLowerCase().endsWith(".zip")
    ) {
      return NextResponse.json(
        { error: "Second and third files must be ZIP files" },
        { status: 400 },
      );
    }

    // Read file buffers
    const pdfBuffer = Buffer.from(await pdfFile.arrayBuffer());
    const zip1Buffer = Buffer.from(await zip1File.arrayBuffer());
    const zip2Buffer = Buffer.from(await zip2File.arrayBuffer());

    // Extract PDFs from ZIPs (sorted alphabetically)
    const zip1Pdfs = extractPdfsFromZip(zip1Buffer);
    const zip2Pdfs = extractPdfsFromZip(zip2Buffer);

    if (zip1Pdfs.length === 0 && zip2Pdfs.length === 0) {
      return NextResponse.json(
        { error: "No PDF files found in the ZIP archives" },
        { status: 400 },
      );
    }

    // Build ordered list: single PDF first, then ZIP1 PDFs, then ZIP2 PDFs
    const allPdfBuffers: Buffer[] = [
      pdfBuffer,
      ...zip1Pdfs.map((p) => p.buffer),
      ...zip2Pdfs.map((p) => p.buffer),
    ];

    // Merge all PDFs
    const mergedBuffer = await mergePdfs(allPdfBuffers);
    const originalSize = mergedBuffer.length;

    // Compress the merged PDF
    const compressedBuffer = await compressPdf(mergedBuffer);
    const finalSize = compressedBuffer.length;

    // Return the compressed PDF as a download with size info
    return new NextResponse(new Uint8Array(compressedBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="merged-compressed.pdf"',
        "Content-Length": compressedBuffer.length.toString(),
        "X-Original-Size": originalSize.toString(),
        "X-Final-Size": finalSize.toString(),
      },
    });
  } catch (err) {
    console.error("Merge/compress error:", err);
    const message =
      err instanceof Error ? err.message : "An unexpected error occurred";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
