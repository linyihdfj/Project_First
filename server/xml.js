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

function charToXml(ann) {
  const charValue = (ann.originalText || ann.simplifiedText || "□").slice(0, 1);
  const code = ann.charCode || toUnicodeCode(charValue);
  const wordNotes = ann.note
    ? `\n                <word_notes>\n                  <word_note id="wn-${escapeXml(ann.id)}" note_type="${escapeXml(ann.noteType || "1")}">${escapeXml(ann.note)}</word_note>\n                </word_notes>`
    : "";
  return `
                <word id="wd-${escapeXml(ann.id)}" note="${escapeXml(ann.simplifiedText || ann.originalText || "")}">${wordNotes}
                  <char id="${escapeXml(ann.charId)}" code="${escapeXml(code)}">${escapeXml(charValue)}</char>
                </word>`;
}

function imageToXml(ann) {
  const regions = ann.regions || [];
  const r = regions.length > 0 ? regions[0] : { x: 0, y: 0, width: 0, height: 0 };
  return `
                <img id="img-${escapeXml(ann.id)}" src="${escapeXml(ann.originalText || '')}" x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" note="${escapeXml(ann.note || '')}" />`;
}

function sentenceToXml(ann, charChildren) {
  const innerXml = charChildren.length > 0
    ? charChildren.map((c) => c.level === "image" ? imageToXml(c) : charToXml(c)).join("")
    : charToXml(ann);
  return `
              <sentence id="st-${escapeXml(ann.id)}" type="1" note="${escapeXml(ann.note || "")}" note_type="${escapeXml(ann.noteType || "1")}">${innerXml}
              </sentence>`;
}

function paragraphToXml(ann, sentChildren, childMap) {
  const note = ann.note ? ` note="${escapeXml(ann.note)}"` : "";
  let innerXml;
  if (sentChildren.length > 0) {
    innerXml = sentChildren.map((sent) => {
      const charChildren = (childMap.get(sent.id) || []).filter((c) => c.level === "char" || c.level === "image");
      return sentenceToXml(sent, charChildren);
    }).join("");
  } else {

    innerXml = `
              <sentence id="st-${escapeXml(ann.id)}" type="0" note="${escapeXml(ann.note || "")}" note_type="${escapeXml(ann.noteType || "1")}">
                ${charToXml(ann)}
              </sentence>`;
  }
  return `
            <paragraph id="pg-${escapeXml(ann.id)}" type="1"${note}>${innerXml}
            </paragraph>`;
}

function annotationsToXmlContent(annotations) {
  if (!annotations || annotations.length === 0) return "";

  const childMap = new Map();
  const topLevel = [];
  for (const ann of annotations) {
    if (ann.parentId) {
      if (!childMap.has(ann.parentId)) childMap.set(ann.parentId, []);
      childMap.get(ann.parentId).push(ann);
    } else {
      topLevel.push(ann);
    }
  }

  for (const [, children] of childMap) {
    children.sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
  }

  return topLevel.map((ann) => {
    if (ann.level === "paragraph") {
      const sentChildren = (childMap.get(ann.id) || []).filter((c) => c.level === "sentence");
      return paragraphToXml(ann, sentChildren, childMap);
    }
    if (ann.level === "sentence") {
      const charChildren = (childMap.get(ann.id) || []).filter((c) => c.level === "char" || c.level === "image");
      return `
            <paragraph id="pg-${escapeXml(ann.id)}" type="0">
              ${sentenceToXml(ann, charChildren)}
            </paragraph>`;
    }
    if (ann.level === "image") {
      return `
            <paragraph id="pg-${escapeXml(ann.id)}" type="0">${imageToXml(ann)}
            </paragraph>`;
    }

    const charValue = (ann.originalText || ann.simplifiedText || "□").slice(0, 1);
    const code = ann.charCode || toUnicodeCode(charValue);
    const wordNotes = ann.note
      ? `\n              <word_notes>\n                <word_note id="wn-${escapeXml(ann.id)}" note_type="${escapeXml(ann.noteType || "1")}">${escapeXml(ann.note)}</word_note>\n              </word_notes>`
      : "";
    return `
            <paragraph id="pg-${escapeXml(ann.id)}" type="0">
              <sentence id="st-${escapeXml(ann.id)}" type="0" note="${escapeXml(ann.note || "")}" note_type="${escapeXml(ann.noteType || "1")}">
                <word id="wd-${escapeXml(ann.id)}" note="${escapeXml(ann.simplifiedText || ann.originalText || "")}">${wordNotes}
                  <char id="${escapeXml(ann.charId)}" code="${escapeXml(code)}">${escapeXml(charValue)}</char>
                </word>
              </sentence>
            </paragraph>`;
  }).join("");
}

function annotationToSvgShape(ann) {
  const stroke = ann.color;
  const regions = ann.regions || [];
  if (regions.length === 0) return "";
  return regions.map((r) => {
    if (ann.style === "underline") {
      const y = r.y + r.height;
      return `
      <line x1="${r.x}" y1="${y}" x2="${r.x + r.width}" y2="${y}" style="stroke:${stroke};stroke-width:3" />`;
    }
    const fill = ann.style === "highlight" ? `fill:${stroke}55;` : "fill:none;";
    return `
      <rect x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" style="${fill}stroke:${stroke};stroke-width:2" />`;
  }).join("");
}

function annotationToSvgText(ann) {
  const codeText = ann.originalText || ann.simplifiedText || "□";
  const regions = ann.regions || [];
  if (regions.length === 0) return "";
  const r = regions[0];
  return `
      <text x="${r.x + 2}" y="${Math.max(16, r.y - 4)}" id="${escapeXml(ann.charId)}" fill="${escapeXml(ann.color)}" font-family="STSong" font-size="18">${escapeXml(codeText)}</text>`;
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
    const annXml = annotationsToXmlContent(page.annotations || []);
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
