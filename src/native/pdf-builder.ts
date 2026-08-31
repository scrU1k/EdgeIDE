/**
 * Native PDF 1.4 generator - zero npm dependencies.
 * Formats source code and markdown into clean, paginated PDF documents.
 */
export class NativePdfBuilder {
  public static generateCodePdf(title: string, text: string): Uint8Array {
    const lines = text.split(/\r?\n/);
    const maxLinesPerPage = 52;
    const pageCount = Math.max(1, Math.ceil(lines.length / maxLinesPerPage));
    
    const pageObjIds: number[] = [];

    // Obj 1: Catalog, Obj 2: Pages, Obj 3: Font (Courier)
    let currentObjId = 4; // Start allocating page & content objects

    const pageContentPairs: Array<{ pageId: number; contentId: number; stream: string }> = [];

    for (let p = 0; p < pageCount; p++) {
      const pageId = currentObjId++;
      const contentId = currentObjId++;
      pageObjIds.push(pageId);

      const pageLines = lines.slice(p * maxLinesPerPage, (p + 1) * maxLinesPerPage);
      
      // Build PDF text stream
      let streamData = 'BT\n';
      // Header on every page
      streamData += '/F1 12 Tf\n';
      streamData += '40 800 Td\n';
      streamData += `(${this.escapePdfText(title)} - Page ${p + 1}/${pageCount}) Tj\n`;
      streamData += '0 -20 Td\n';
      
      // Line numbers and code
      streamData += '/F1 9 Tf\n';
      streamData += '14 TL\n'; // Line spacing 14pt

      for (let lIdx = 0; lIdx < pageLines.length; lIdx++) {
        const lineNum = p * maxLinesPerPage + lIdx + 1;
        const lineNumStr = String(lineNum).padStart(4, ' ');
        const rawLine = pageLines[lIdx];
        // Truncate line if too long for standard A4 (approx 85 chars at 9pt)
        const lineContent = rawLine.length > 85 ? rawLine.substring(0, 82) + '...' : rawLine;
        const formattedLine = `${lineNumStr} | ${lineContent}`;
        
        if (lIdx === 0) {
          streamData += `(${this.escapePdfText(formattedLine)}) Tj\n`;
        } else {
          streamData += `T* (${this.escapePdfText(formattedLine)}) Tj\n`;
        }
      }
      streamData += 'ET\n';

      pageContentPairs.push({ pageId, contentId, stream: streamData });
    }

    // Now construct all PDF objects in order
    // Obj 1: Catalog
    const catalogObj = `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`;
    
    // Obj 2: Pages Collection
    const kidsStr = pageObjIds.map(id => `${id} 0 R`).join(' ');
    const pagesObj = `2 0 obj\n<< /Type /Pages /Kids [${kidsStr}] /Count ${pageCount} >>\nendobj\n`;

    // Obj 3: Font
    const fontObj = `3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>\nendobj\n`;

    const allObjects: Array<{ id: number; data: string }> = [
      { id: 1, data: catalogObj },
      { id: 2, data: pagesObj },
      { id: 3, data: fontObj }
    ];

    for (const pair of pageContentPairs) {
      // Page Object (A4: 595.28 x 841.89 pt)
      const pageObj = `${pair.pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Contents ${pair.contentId} 0 R /Resources << /Font << /F1 3 0 R >> >> >>\nendobj\n`;
      
      // Stream Object
      const streamLen = new TextEncoder().encode(pair.stream).length;
      const contentObj = `${pair.contentId} 0 obj\n<< /Length ${streamLen} >>\nstream\n${pair.stream}endstream\nendobj\n`;

      allObjects.push({ id: pair.pageId, data: pageObj });
      allObjects.push({ id: pair.contentId, data: contentObj });
    }

    // Sort objects by ID
    allObjects.sort((a, b) => a.id - b.id);

    // Build the final PDF binary with XRef table
    let pdfStr = '%PDF-1.4\n';
    const offsets: number[] = [0]; // obj 0 is always 0000000000 65535 f

    for (const obj of allObjects) {
      const currentOffset = new TextEncoder().encode(pdfStr).length;
      offsets.push(currentOffset);
      pdfStr += obj.data;
    }

    const startXref = new TextEncoder().encode(pdfStr).length;
    pdfStr += `xref\n0 ${allObjects.length + 1}\n`;
    pdfStr += '0000000000 65535 f \n';
    for (let i = 1; i <= allObjects.length; i++) {
      const offStr = String(offsets[i]).padStart(10, '0');
      pdfStr += `${offStr} 00000 n \n`;
    }

    pdfStr += `trailer\n<< /Size ${allObjects.length + 1} /Root 1 0 R >>\n`;
    pdfStr += `startxref\n${startXref}\n%%EOF\n`;

    return new TextEncoder().encode(pdfStr);
  }

  private static escapePdfText(text: string): string {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)')
      .replace(/[^\x20-\x7E]/g, ' '); // Replace non-ascii chars with space for Type1 Courier
  }
}
