function escapeXml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function toUnicodeCode(char) {
  if (!char) {
    return "U+25A1";
  }
  return `U+${char.codePointAt(0).toString(16).toUpperCase()}`;
}

function getContentByLevel(ann) {
  if (ann.level === "char") {
    const charValue = ann.originalText || ann.simplifiedText || "□";
    return {
      paragraphType: "0",
      sentenceType: "0",
      charValue: charValue.slice(0, 1),
    };
  }
  if (ann.level === "sentence") {
    return {
      paragraphType: "0",
      sentenceType: "1",
      charValue: (ann.originalText || ann.simplifiedText || "□").slice(0, 1),
    };
  }
  return {
    paragraphType: "1",
    sentenceType: "0",
    charValue: (ann.originalText || ann.simplifiedText || "□").slice(0, 1),
  };
}

function annotationToXmlContent(ann) {
  const info = getContentByLevel(ann);
  const code = ann.charCode || toUnicodeCode(info.charValue);
  const note = ann.note ? ` note="${escapeXml(ann.note)}"` : "";
  const wordNotes = ann.note
    ? `\n              <word_notes>\n                <word_note id="wn-${escapeXml(ann.id)}" note_type="${escapeXml(ann.noteType)}">${escapeXml(ann.note)}</word_note>\n              </word_notes>`
    : "";

  return `
          <paragraph id="pg-${escapeXml(ann.id)}" type="${info.paragraphType}"${note}>
            <sentence id="st-${escapeXml(ann.id)}" type="${info.sentenceType}" note="${escapeXml(ann.note || "")}" note_type="${escapeXml(ann.noteType || "1")}">
              <word id="wd-${escapeXml(ann.id)}" note="${escapeXml(ann.simplifiedText || ann.originalText || "")}">${wordNotes}
                <char id="${escapeXml(ann.charId)}" code="${escapeXml(code)}">${escapeXml(info.charValue)}</char>
              </word>
            </sentence>
          </paragraph>`;
}

function annotationToSvgShape(ann) {
  const stroke = ann.color;
  if (ann.style === "underline") {
    const y = ann.y + ann.height;
    return `
      <line x1="${ann.x}" y1="${y}" x2="${ann.x + ann.width}" y2="${y}" style="stroke:${stroke};stroke-width:3" />`;
  }
  const fill = ann.style === "highlight" ? `fill:${stroke}55;` : "fill:none;";
  return `
      <rect x="${ann.x}" y="${ann.y}" width="${ann.width}" height="${ann.height}" style="${fill}stroke:${stroke};stroke-width:2" />`;
}

function annotationToSvgText(ann) {
  const codeText = ann.originalText || ann.simplifiedText || "□";
  return `
      <text x="${ann.x + 2}" y="${Math.max(16, ann.y - 4)}" id="${escapeXml(ann.charId)}" fill="${escapeXml(ann.color)}" font-family="STSong" font-size="18">${escapeXml(codeText)}</text>`;
}

function generateXmlFromSnapshot(snapshot) {
  const article = snapshot.article;
  const pages = snapshot.pages || [];
  const pageNos = pages.map((page) => page.pageNo).join(",");

  const headXml = `
  <head>
    <title name="${escapeXml(article.title)}" note="" type="1">
      <subtitle name="${escapeXml(article.subtitle)}" note="" type="1" />
    </title>
    <authors>
      <author name="${escapeXml(article.author)}" id="author-1" note="" type="0" />
    </authors>
    <book name="${escapeXml(article.book)}" id="book-1" note="" type="1" volume="${escapeXml(article.volume)}" issue="" start_page="1" end_page="${pages.length || 1}" pages="${escapeXml(pageNos)}">
      <relation note="文章属于该书卷" type="1" />
    </book>
    <date>
      <publish_date year="${escapeXml(article.publishYear)}" dynasty="" note="" />
      <writing_date year="${escapeXml(article.writingYear)}" dynasty="" note="" />
    </date>
  </head>`;

  const contentXml = `
  <content page_mode="1">
${pages
  .map((page) => {
    const annXml = (page.annotations || [])
      .map(annotationToXmlContent)
      .join("");
    return `    <page layout="0" id="${escapeXml(page.id)}" page_no="${page.pageNo}" direction="0">
      <panel id="panel-${escapeXml(page.id)}" direction="0">
        <textfield id="tf-${escapeXml(page.id)}" position="1" direction="0">${annXml}
        </textfield>
      </panel>
    </page>`;
  })
  .join("\n")}
  </content>`;

  const viewXml = `
  <view count="${pages.length}" pages="${escapeXml(pageNos)}">
${pages
  .map((page) => {
    const shapeXml = (page.annotations || [])
      .map(annotationToSvgShape)
      .join("");
    const textXml = (page.annotations || []).map(annotationToSvgText).join("");
    return `    <svg id="${escapeXml(page.id)}" page_no="${page.pageNo}" width="${page.width}" height="${page.height}" notes="">
      <image id="img-${escapeXml(page.id)}" x="0" y="0" width="${page.width}" height="${page.height}" xlink:href="${escapeXml(page.src)}" />${shapeXml}${textXml}
    </svg>`;
  })
  .join("\n")}
  </view>`;

  const sourcesXml = `
  <sources type="1">
${pages.map((page) => `    <source src="${escapeXml(page.src)}" pageno="${page.pageNo}" />`).join("\n")}
  </sources>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<article id="${escapeXml(article.id)}" type="${escapeXml(article.type)}" version="${escapeXml(article.version)}" xmlns:xlink="http://www.w3.org/1999/xlink">${headXml}${contentXml}${viewXml}${sourcesXml}
</article>`;
}

module.exports = {
  generateXmlFromSnapshot,
};
