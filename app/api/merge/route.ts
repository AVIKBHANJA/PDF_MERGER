import { NextResponse } from "next/server";
import { extractPdfsFromZip } from "@/lib/unzip";
import { mergePdfs } from "@/lib/merge";
import { compressPdf } from "@/lib/compress";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    const uploadedFiles = formData.getAll("files") as File[];

    if (uploadedFiles.length === 0) {
      return NextResponse.json(
        { error: "At least one PDF or ZIP file is required" },
        { status: 400 },
      );
    }

    // Separate PDFs and ZIPs, validate extensions
    const allPdfBuffers: Buffer[] = [];

    for (const file of uploadedFiles) {
      const name = file.name.toLowerCase();

      if (name.endsWith(".pdf")) {
        const buffer = Buffer.from(await file.arrayBuffer());
        allPdfBuffers.push(buffer);
      } else if (name.endsWith(".zip")) {
        const zipBuffer = Buffer.from(await file.arrayBuffer());
        const extractedPdfs = extractPdfsFromZip(zipBuffer);
        allPdfBuffers.push(...extractedPdfs.map((p) => p.buffer));
      } else {
        return NextResponse.json(
          {
            error: `Unsupported file type: ${file.name}. Only PDF and ZIP files are allowed.`,
          },
          { status: 400 },
        );
      }
    }

    if (allPdfBuffers.length === 0) {
      return NextResponse.json(
        { error: "No PDF files found in the uploaded files or ZIP archives" },
        { status: 400 },
      );
    }

    // Merge all PDFs
    console.log(`Merging ${allPdfBuffers.length} PDFs...`);
    const mergedBuffer = await mergePdfs(allPdfBuffers);
    const originalSize = mergedBuffer.length;
    console.log(`Merged PDF: ${(originalSize / 1024 / 1024).toFixed(1)} MB`);

    // Compress the merged PDF
    console.log("Starting compression...");
    const compressedBuffer = await compressPdf(mergedBuffer);
    const finalSize = compressedBuffer.length;
    console.log(`Compression done: ${(finalSize / 1024 / 1024).toFixed(1)} MB`);

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
