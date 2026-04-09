/**
 * @description xml服务端模块，负责对应领域能力的实现。
 */
const FALLBACK_CHAR = "□";

/**
 * @description 转义xml。
 * @param {*} str str参数。
 * @returns {string} xml后的字符串。
 */
function escapeXml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * @description 格式化year。
 * @param {*} year year参数。
 * @returns {string} year后的字符串。
 */
function formatYear(year) {
  const value = String(year || "").trim();
  if (!value) {
    return "";
  }
  if (/^(AD|BC)\d+$/i.test(value)) {
    return value.toUpperCase();
  }
  if (/^\d+$/.test(value)) {
    return `AD${value}`;
  }
  return value;
}

/**
 * @description 获取charvalue。
 * @param {*} ann 标注对象。
 * @returns {*} charvalue结果。
 */
function getCharValue(ann) {
  const value = String(ann.originalText || ann.simplifiedText || "").trim();
  return value ? value.slice(0, 1) : FALLBACK_CHAR;
}

/**
 * @description 获取charcode。
 * @param {*} ann 标注对象。
 * @returns {*} charcode结果。
 */
function getCharCode(ann) {
  const rawCode = String(ann.charCode || "").trim();
  if (rawCode) {
    return rawCode.toUpperCase();
  }
  return `U+${getCharValue(ann).codePointAt(0).toString(16).toUpperCase()}`;
}

/**
 * @description 比较order。
 * @param {*} left left参数。
 * @param {*} right right参数。
 * @returns {number} order结果。
 */
function compareByOrder(left, right) {
  const leftOrder = Number(left.orderIndex || 0);
  const rightOrder = Number(right.orderIndex || 0);
  if (leftOrder !== rightOrder) {
    return leftOrder - rightOrder;
  }
  return String(left.createdAt || "").localeCompare(String(right.createdAt || ""));
}

/**
 * @description 构建childmap。
 * @param {*} annotations annotations参数。
 * @returns {*} childmap结果。
 */
function buildChildMap(annotations) {
  const childMap = new Map();
  annotations.forEach((annotation) => {
    if (!annotation.parentId) {
      return;
    }
    if (!childMap.has(annotation.parentId)) {
      childMap.set(annotation.parentId, []);
    }
    childMap.get(annotation.parentId).push(annotation);
  });
  childMap.forEach((children) => {
    children.sort(compareByOrder);
  });
  return childMap;
}

/**
 * @description 构建wordxml。
 * @param {*} ann 标注对象。
 * @returns {*} wordxml结果。
 */
function buildWordXml(ann) {
  const wordNoteXml = ann.note
    ? `
                  <word_notes>
                    <word_note id="wn-${escapeXml(ann.id)}" note_type="${escapeXml(ann.noteType || "1")}">${escapeXml(ann.note)}</word_note>
                  </word_notes>`
    : "";
  return `
                <word id="wd-${escapeXml(ann.id)}" note="${escapeXml(ann.simplifiedText || ann.originalText || "")}">${wordNoteXml}
                  <char id="${escapeXml(ann.charId || `char-${ann.id}`)}" code="${escapeXml(getCharCode(ann))}">${escapeXml(getCharValue(ann))}</char>
                </word>`;
}

/**
 * @description 构建sentencexml。
 * @param {*} ann 标注对象。
 * @param {*} childMap childmap参数。
 * @returns {*} sentencexml结果。
 */
function buildSentenceXml(ann, childMap) {
  const wordChildren = (childMap.get(ann.id) || []).filter(
    (child) => child.level !== "image",
  );
  const wordsXml = (wordChildren.length ? wordChildren : [ann])
    .map((child) => buildWordXml(child))
    .join("");
  return `
              <sentence id="st-${escapeXml(ann.id)}" type="${ann.level === "sentence" ? "1" : "0"}" note="${escapeXml(ann.note || "")}" note_type="${escapeXml(ann.noteType || "1")}">${wordsXml}
              </sentence>`;
}

/**
 * @description 构建paragraphxml。
 * @param {*} ann 标注对象。
 * @param {*} childMap childmap参数。
 * @returns {*} paragraphxml结果。
 */
function buildParagraphXml(ann, childMap) {
  const sentenceChildren = (childMap.get(ann.id) || []).filter(
    (child) => child.level === "sentence",
  );
  const sentencesXml = (sentenceChildren.length ? sentenceChildren : [ann])
    .map((sentence) => buildSentenceXml(sentence, childMap))
    .join("");
  const type = ann.level === "paragraph" ? "1" : "0";
  return `
            <paragraph id="pg-${escapeXml(ann.id)}" type="${type}" note="${escapeXml(ann.note || "")}">${sentencesXml}
            </paragraph>`;
}

/**
 * @description 获取topleveltextannotations。
 * @param {*} annotations annotations参数。
 * @returns {*} topleveltextannotations结果。
 */
function getTopLevelTextAnnotations(annotations) {
  return annotations
    .filter(
      (annotation) =>
        !annotation.parentId &&
        annotation.level !== "image",
    )
    .sort(compareByOrder);
}

/**
 * @description 获取toplevelimageannotations。
 * @param {*} annotations annotations参数。
 * @returns {*} toplevelimageannotations结果。
 */
function getTopLevelImageAnnotations(annotations) {
  return annotations
    .filter((annotation) => !annotation.parentId && annotation.level === "image")
    .sort(compareByOrder);
}

/**
 * @description 构建textfieldcontentxml。
 * @param {*} annotations annotations参数。
 * @returns {*} textfieldcontentxml结果。
 */
function buildTextfieldContentXml(annotations) {
  const childMap = buildChildMap(annotations);
  return getTopLevelTextAnnotations(annotations)
    .map((annotation) => buildParagraphXml(annotation, childMap))
    .join("");
}

/**
 * @description 构建panelimagesxml。
 * @param {*} annotations annotations参数。
 * @returns {*} panelimagesxml结果。
 */
function buildPanelImagesXml(annotations) {
  return getTopLevelImageAnnotations(annotations)
    .map(
      (annotation, index) => `
        <img id="img-${escapeXml(annotation.id)}" src="${escapeXml(annotation.originalText || "")}" note="${escapeXml(annotation.note || "")}" name="${escapeXml(annotation.simplifiedText || "")}" position="${index + 1}" />`,
    )
    .join("");
}

/**
 * @description 获取textannotationsview。
 * @param {*} annotations annotations参数。
 * @returns {*} textannotationsview结果。
 */
function getTextAnnotationsForView(annotations) {
  const childMap = buildChildMap(annotations);
  return annotations
    .filter((annotation) => {
      if (annotation.level === "image") {
        return false;
      }
      if (annotation.level === "char") {
        return true;
      }
      const nonImageChildren = (childMap.get(annotation.id) || []).filter(
        (child) => child.level !== "image",
      );
      return nonImageChildren.length === 0;
    })
    .sort(compareByOrder);
}

/**
 * @description 构建contentpagexml。
 * @param {*} page 页面对象。
 * @returns {*} contentpagexml结果。
 */
function buildContentPageXml(page) {
  const paragraphsXml = buildTextfieldContentXml(page.annotations || []);
  const imagesXml = buildPanelImagesXml(page.annotations || []);
  return `    <page layout="0" id="${escapeXml(page.id)}" page_no="${page.pageNo}" direction="0">
      <panel id="panel-${escapeXml(page.id)}" direction="0">
        <textfield id="tf-${escapeXml(page.id)}" position="1" direction="0">${paragraphsXml}
        </textfield>${imagesXml}
      </panel>
    </page>`;
}

/**
 * @description 构建textviewxml。
 * @param {*} ann 标注对象。
 * @returns {*} textviewxml结果。
 */
function buildTextViewXml(ann) {
  const regions = ann.regions || [];
  if (!regions.length) {
    return "";
  }
  const region = regions[0];
  return `
      <text x="${region.x + 2}" y="${Math.max(16, region.y - 4)}" id="${escapeXml(ann.charId || `char-${ann.id}`)}" fill="${escapeXml(ann.color || "#d5533f")}" font-family="STSong" font-size="18">${escapeXml(getCharValue(ann))}</text>`;
}

/**
 * @description 构建shapeviewxml。
 * @param {*} ann 标注对象。
 * @returns {*} shapeviewxml结果。
 */
function buildShapeViewXml(ann) {
  const stroke = ann.color || "#d5533f";
  const regions = ann.regions || [];
  if (!regions.length || ann.level === "image") {
    return "";
  }
  return regions
    .map((region) => {
      if (ann.style === "underline") {
        const lineY = region.y + region.height;
        return `
      <line x1="${region.x}" y1="${lineY}" x2="${region.x + region.width}" y2="${lineY}" style="stroke:${stroke};stroke-width:3" />`;
      }
      const fillStyle =
        ann.style === "highlight" ? `fill:${stroke}55;` : "fill:none;";
      return `
      <rect x="${region.x}" y="${region.y}" width="${region.width}" height="${region.height}" style="${fillStyle}stroke:${stroke};stroke-width:2" />`;
    })
    .join("");
}

/**
 * @description 构建imageviewxml。
 * @param {*} ann 标注对象。
 * @returns {*} imageviewxml结果。
 */
function buildImageViewXml(ann) {
  const regions = ann.regions || [];
  if (!regions.length) {
    return "";
  }
  const region = regions[0];
  const imageId = `img-${escapeXml(ann.id)}`;
  const imageSrc = escapeXml(ann.originalText || "");
  if (imageSrc) {
    return `
      <image id="${imageId}" x="${region.x}" y="${region.y}" width="${region.width}" height="${region.height}" xlink:href="${imageSrc}" />`;
  }
  return `
      <rect id="${imageId}" x="${region.x}" y="${region.y}" width="${region.width}" height="${region.height}" style="fill:none;stroke:${escapeXml(ann.color || "#d5533f")};stroke-width:2" />`;
}

/**
 * @description 构建viewpagexml。
 * @param {*} page 页面对象。
 * @returns {*} viewpagexml结果。
 */
function buildViewPageXml(page) {
  const annotations = page.annotations || [];
  const shapeXml = annotations.map((annotation) => buildShapeViewXml(annotation)).join("");
  const textXml = getTextAnnotationsForView(annotations)
    .map((annotation) => buildTextViewXml(annotation))
    .join("");
  const imageXml = annotations
    .filter((annotation) => annotation.level === "image")
    .map((annotation) => buildImageViewXml(annotation))
    .join("");
  return `    <svg id="${escapeXml(page.id)}" page_no="${page.pageNo}" width="${page.width}" height="${page.height}" notes="">
      <image id="page-image-${escapeXml(page.id)}" x="0" y="0" width="${page.width}" height="${page.height}" xlink:href="${escapeXml(page.src)}" />${shapeXml}${imageXml}${textXml}
    </svg>`;
}

/**
 * @description 构建headxml。
 * @param {*} article 文章对象。
 * @param {*} pages pages参数。
 * @returns {*} headxml结果。
 */
function buildHeadXml(article, pages) {
  const pageNos = pages.map((page) => page.pageNo).join(",");
  return `
  <head>
    <title name="${escapeXml(article.title || "")}" note="" type="1">
      <subtitle name="${escapeXml(article.subtitle || "")}" note="" type="1" />
    </title>
    <authors>
      <author name="${escapeXml(article.author || "")}" id="author-1" note="" type="0" />
    </authors>
    <book name="${escapeXml(article.book || "")}" id="book-1" note="" type="1" volume="${escapeXml(article.volume || "")}" issue="" start_page="${pages.length ? pages[0].pageNo : 1}" end_page="${pages.length ? pages[pages.length - 1].pageNo : 1}" pages="${escapeXml(pageNos)}">
      <relation note="" type="1" />
    </book>
    <date>
      <publish_date year="${escapeXml(formatYear(article.publishYear))}" dynasty="" note="" />
      <writing_date year="${escapeXml(formatYear(article.writingYear))}" dynasty="" note="" />
    </date>
  </head>`;
}

/**
 * @description 构建sourcesxml。
 * @param {*} pages pages参数。
 * @returns {*} sourcesxml结果。
 */
function buildSourcesXml(pages) {
  return `
  <sources type="1">
${pages
  .map(
    (page) =>
      `    <source src="${escapeXml(page.src)}" pageno="${page.pageNo}" type="1" />`,
  )
  .join("\n")}
  </sources>`;
}

/**
 * @description 处理generatexmlsnapshot相关逻辑。
 * @param {*} snapshot snapshot参数。
 * @returns {*} xmlsnapshot结果。
 */
function generateXmlFromSnapshot(snapshot) {
  const article = snapshot.article || {};
  const pages = snapshot.pages || [];
  const pageNos = pages.map((page) => page.pageNo).join(",");

  const headXml = buildHeadXml(article, pages);
  const contentXml = `
  <content page_mode="1">
${pages.map((page) => buildContentPageXml(page)).join("\n")}
  </content>`;
  const viewXml = `
  <view count="${pages.length}" pages="${escapeXml(pageNos)}">
${pages.map((page) => buildViewPageXml(page)).join("\n")}
  </view>`;
  const sourcesXml = buildSourcesXml(pages);

  return `<?xml version="1.0" encoding="UTF-8"?>
<article id="${escapeXml(article.id || "")}" type="${escapeXml(article.type || "1")}" version="${escapeXml(article.version || "1.0")}" xmlns:xlink="http://www.w3.org/1999/xlink">${headXml}${contentXml}${viewXml}${sourcesXml}
</article>`;
}

module.exports = {
  generateXmlFromSnapshot,
};

