const FALLBACK_CHAR = "□";

/**
 * @description 对 XML 文本和属性值进行转义，避免出现非法字符。
 * @param {string} str 原始字符串。
 * @returns {string} 转义后的字符串。
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
 * @description 统一格式化年份字段；若只给出数字年份，则默认补齐 AD 前缀。
 * @param {string} year 年份字符串。
 * @returns {string} 格式化后的年份字符串。
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
 * @description 获取标注的首字符；为空时返回兜底方框字符。
 * @param {object} ann 标注对象。
 * @returns {string} 单个字符。
 */
function getCharValue(ann) {
  const value = String(ann.originalText || ann.simplifiedText || "").trim();
  return value ? value.slice(0, 1) : FALLBACK_CHAR;
}

/**
 * @description 生成字符编码；若未录入编码则按当前字符推导 Unicode 编码。
 * @param {object} ann 标注对象。
 * @returns {string} 形如 U+4E00 的编码。
 */
function getCharCode(ann) {
  const rawCode = String(ann.charCode || "").trim();
  if (rawCode) {
    return rawCode.toUpperCase();
  }
  return `U+${getCharValue(ann).codePointAt(0).toString(16).toUpperCase()}`;
}

/**
 * @description 生成稳定的排序键，优先按顺序号，其次按创建顺序。
 * @param {object} left 左侧对象。
 * @param {object} right 右侧对象。
 * @returns {number} 排序结果。
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
 * @description 为标注列表构建 parentId -> children 的索引，并按顺序号排序。
 * @param {object[]} annotations 标注列表。
 * @returns {Map<string, object[]>} 子节点索引。
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
 * @description 生成单个 word 节点；当前数据模型按“一个标注对应一个 word + 一个 char”导出。
 * @param {object} ann 标注对象。
 * @returns {string} word XML 片段。
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
 * @description 生成 sentence 节点，并将其子字级标注转成 word 列表。
 * @param {object} ann 句级或兜底标注对象。
 * @param {Map<string, object[]>} childMap 标注子节点索引。
 * @returns {string} sentence XML 片段。
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
 * @description 生成 paragraph 节点，并将其子句级标注转成 sentence 列表。
 * @param {object} ann 段级或兜底标注对象。
 * @param {Map<string, object[]>} childMap 标注子节点索引。
 * @returns {string} paragraph XML 片段。
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
 * @description 提取页面中参与 textfield 的文本类顶层标注。
 * @param {object[]} annotations 页面标注列表。
 * @returns {object[]} 顶层文本标注列表。
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
 * @description 提取页面中作为 panel 子元素输出的顶层图片标注。
 * @param {object[]} annotations 页面标注列表。
 * @returns {object[]} 顶层图片标注列表。
 */
function getTopLevelImageAnnotations(annotations) {
  return annotations
    .filter((annotation) => !annotation.parentId && annotation.level === "image")
    .sort(compareByOrder);
}

/**
 * @description 生成 content/page/panel/textfield 结构中的文本段落 XML。
 * @param {object[]} annotations 页面标注列表。
 * @returns {string} 段落 XML 片段。
 */
function buildTextfieldContentXml(annotations) {
  const childMap = buildChildMap(annotations);
  return getTopLevelTextAnnotations(annotations)
    .map((annotation) => buildParagraphXml(annotation, childMap))
    .join("");
}

/**
 * @description 生成 content/panel 下的图片节点 XML。
 * @param {object[]} annotations 页面标注列表。
 * @returns {string} 图片节点 XML 片段。
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
 * @description 提取需要在 view 中输出 text 元素的标注集合，保证与 content 中的 char 一一对应。
 * @param {object[]} annotations 页面标注列表。
 * @returns {object[]} 参与文本视图输出的标注列表。
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
 * @description 生成单页的 content/page 节点。
 * @param {object} page 页面对象。
 * @returns {string} page XML 片段。
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
 * @description 生成文字标注在 view 中的 SVG text 元素。
 * @param {object} ann 标注对象。
 * @returns {string} SVG text 片段；无区域时返回空串。
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
 * @description 生成普通标注在 view 中的高亮框或下划线。
 * @param {object} ann 标注对象。
 * @returns {string} SVG 形状片段。
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
 * @description 生成图片标注在 view 中的 SVG image 或兜底矩形。
 * @param {object} ann 图片标注对象。
 * @returns {string} SVG 片段。
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
 * @description 生成单页的 view/svg 节点。
 * @param {object} page 页面对象。
 * @returns {string} svg XML 片段。
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
 * @description 生成 head 节点 XML。
 * @param {object} article 文章对象。
 * @param {object[]} pages 页面列表。
 * @returns {string} head XML 片段。
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
 * @description 生成 sources 节点 XML。
 * @param {object[]} pages 页面列表。
 * @returns {string} sources XML 片段。
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
 * @description 基于文章快照生成符合 XML-V0.1 文档要求的导出 XML。
 * @param {{article: object, pages: object[]}} snapshot 文章快照。
 * @returns {string} XML 字符串。
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
