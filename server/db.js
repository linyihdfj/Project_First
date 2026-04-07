const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const sqlite3 = require("sqlite3").verbose();

const PROJECT_ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(PROJECT_ROOT, "data");
const UPLOADS_DIR = path.join(PROJECT_ROOT, "uploads");
const DB_PATH = path.join(DATA_DIR, "sdudoc.sqlite");

function nowIso() {
  return new Date().toISOString();
}

function uid(prefix) {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

ensureDir(DATA_DIR);
ensureDir(path.join(UPLOADS_DIR, "pages"));
ensureDir(path.join(UPLOADS_DIR, "glyphs"));

const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
  db.run("PRAGMA foreign_keys = ON;");
});

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) {
        reject(err);
        return;
      }
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(row || null);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows || []);
    });
  });
}

async function transaction(fn) {
  await run("BEGIN TRANSACTION");
  try {
    const result = await fn();
    await run("COMMIT");
    return result;
  } catch (error) {
    await run("ROLLBACK");
    throw error;
  }
}

function defaultArticle(articleId) {
  return {
    id: articleId || "article-1",
    type: "1",
    version: "1.0",
    title: "周易注",
    subtitle: "卷一",
    author: "王弼",
    book: "周易注",
    volume: "卷一",
    publishYear: "AD249",
    writingYear: "AD240",
  };
}

function mapArticleRow(row) {
  return {
    id: row.id,
    type: row.type,
    version: row.version,
    title: row.title,
    subtitle: row.subtitle,
    author: row.author,
    book: row.book,
    volume: row.volume,
    publishYear: row.publish_year,
    writingYear: row.writing_year,
  };
}

function mapPageRow(row) {
  return {
    id: row.id,
    pageNo: row.page_no,
    name: row.name,
    src: row.src,
    width: row.width,
    height: row.height,
    annotations: [],
  };
}

function mapAnnotationRow(row) {
  return {
    id: row.id,
    charId: row.char_id,
    level: row.level,
    style: row.style,
    color: row.color,
    originalText: row.original_text || "",
    simplifiedText: row.simplified_text || "",
    note: row.note || "",
    noteType: row.note_type || "1",
    charCode: row.char_code || "",
    glyphRef: row.glyph_ref || "",
    x: row.x,
    y: row.y,
    width: row.width,
    height: row.height,
    reviewStatus: row.review_status || "pending",
    reviewedBy: row.reviewed_by || "",
    parentId: row.parent_id || null,
    orderIndex: row.order_index || 0,
    regions: [],
  };
}

function mapGlyphRow(row) {
  return {
    id: row.id,
    code: row.code,
    name: row.name || "",
    note: row.note || "",
    imgDataUrl: row.img_src || "",
  };
}

function mapHeadingRow(row) {
  return {
    id: row.id,
    articleId: row.article_id,
    pageId: row.page_id,
    annotationId: row.annotation_id || null,
    titleText: row.title_text,
    level: Number(row.level) || 1,
    y: Number(row.y) || 0,
    pageNo: Number(row.page_no) || 0,
    parentId: row.parent_id || null,
    orderIndex: Number(row.order_index) || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function parseDataUrl(dataUrl) {
  if (typeof dataUrl !== "string") {
    throw new Error("图片数据格式不正确");
  }
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw new Error("图片数据必须是 base64 Data URL");
  }
  const mime = match[1].toLowerCase();
  const base64 = match[2];
  const buffer = Buffer.from(base64, "base64");
  return { mime, buffer };
}

function extensionFromMime(mime) {
  if (mime.includes("png")) {
    return "png";
  }
  if (mime.includes("jpeg") || mime.includes("jpg")) {
    return "jpg";
  }
  if (mime.includes("webp")) {
    return "webp";
  }
  if (mime.includes("gif")) {
    return "gif";
  }
  if (mime.includes("bmp")) {
    return "bmp";
  }
  return "bin";
}

function saveImageDataUrl(dataUrl, typeFolder) {
  const { mime, buffer } = parseDataUrl(dataUrl);
  const ext = extensionFromMime(mime);
  const fileName = `${Date.now()}-${crypto.randomBytes(5).toString("hex")}.${ext}`;
  const diskDir = path.join(UPLOADS_DIR, typeFolder);
  ensureDir(diskDir);
  const diskPath = path.join(diskDir, fileName);
  fs.writeFileSync(diskPath, buffer);
  return `/uploads/${typeFolder}/${fileName}`;
}

async function initDatabase() {
  await run(`
    CREATE TABLE IF NOT EXISTS articles (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      version TEXT NOT NULL,
      title TEXT NOT NULL,
      subtitle TEXT NOT NULL,
      author TEXT NOT NULL,
      book TEXT NOT NULL,
      volume TEXT NOT NULL,
      publish_year TEXT NOT NULL,
      writing_year TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS pages (
      id TEXT PRIMARY KEY,
      article_id TEXT NOT NULL,
      page_no INTEGER NOT NULL,
      name TEXT NOT NULL,
      src TEXT NOT NULL,
      width INTEGER NOT NULL,
      height INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(article_id, page_no),
      FOREIGN KEY(article_id) REFERENCES articles(id) ON DELETE CASCADE
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS annotations (
      id TEXT PRIMARY KEY,
      article_id TEXT NOT NULL,
      page_id TEXT NOT NULL,
      char_id TEXT NOT NULL,
      level TEXT NOT NULL,
      style TEXT NOT NULL,
      color TEXT NOT NULL,
      original_text TEXT,
      simplified_text TEXT,
      note TEXT,
      note_type TEXT,
      char_code TEXT,
      glyph_ref TEXT,
      x INTEGER NOT NULL,
      y INTEGER NOT NULL,
      width INTEGER NOT NULL,
      height INTEGER NOT NULL,
      review_status TEXT DEFAULT 'pending',
      reviewed_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(article_id) REFERENCES articles(id) ON DELETE CASCADE,
      FOREIGN KEY(page_id) REFERENCES pages(id) ON DELETE CASCADE
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS glyphs (
      id TEXT PRIMARY KEY,
      article_id TEXT NOT NULL,
      code TEXT NOT NULL,
      name TEXT,
      note TEXT,
      img_src TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(article_id, code),
      FOREIGN KEY(article_id) REFERENCES articles(id) ON DELETE CASCADE
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS headings (
      id TEXT PRIMARY KEY,
      article_id TEXT NOT NULL,
      page_id TEXT NOT NULL,
      annotation_id TEXT,
      title_text TEXT NOT NULL,
      level INTEGER NOT NULL,
      y INTEGER NOT NULL DEFAULT 0,
      parent_id TEXT,
      order_index INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(article_id) REFERENCES articles(id) ON DELETE CASCADE,
      FOREIGN KEY(page_id) REFERENCES pages(id) ON DELETE CASCADE,
      FOREIGN KEY(annotation_id) REFERENCES annotations(id) ON DELETE SET NULL,
      FOREIGN KEY(parent_id) REFERENCES headings(id) ON DELETE SET NULL
    )
  `);

  try {
    const headingCols = await all("PRAGMA table_info(headings)");
    const hasParentId = headingCols.some((col) => col.name === "parent_id");
    const hasOrderIndex = headingCols.some((col) => col.name === "order_index");

    if (!hasParentId) {
      await run("ALTER TABLE headings ADD COLUMN parent_id TEXT");
      await run(
        "ALTER TABLE headings ADD CONSTRAINT fk_parent FOREIGN KEY(parent_id) REFERENCES headings(id) ON DELETE SET NULL",
      ).catch(() => {});
    }

    if (!hasOrderIndex) {
      await run(
        "ALTER TABLE headings ADD COLUMN order_index INTEGER NOT NULL DEFAULT 0",
      );
    }
  } catch (e) {}

  await run(`
    CREATE TABLE IF NOT EXISTS xml_versions (
      id TEXT PRIMARY KEY,
      article_id TEXT NOT NULL,
      version_no INTEGER NOT NULL,
      xml_content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(article_id, version_no),
      FOREIGN KEY(article_id) REFERENCES articles(id) ON DELETE CASCADE
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'editor',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      article_id TEXT NOT NULL,
      annotation_id TEXT,
      page_id TEXT,
      user_id TEXT NOT NULL,
      content TEXT NOT NULL,
      resolved INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(article_id) REFERENCES articles(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);

  try {
    const annCols = await all("PRAGMA table_info(annotations)");
    if (!annCols.some((col) => col.name === "review_status")) {
      await run(
        "ALTER TABLE annotations ADD COLUMN review_status TEXT DEFAULT 'pending'",
      );
    }
    if (!annCols.some((col) => col.name === "reviewed_by")) {
      await run("ALTER TABLE annotations ADD COLUMN reviewed_by TEXT");
    }
    if (!annCols.some((col) => col.name === "parent_id")) {
      await run("ALTER TABLE annotations ADD COLUMN parent_id TEXT");
    }
    if (!annCols.some((col) => col.name === "order_index")) {
      await run(
        "ALTER TABLE annotations ADD COLUMN order_index INTEGER NOT NULL DEFAULT 0",
      );
    }
  } catch (e) {}

  await run(`
    CREATE TABLE IF NOT EXISTS annotation_regions (
      id TEXT PRIMARY KEY,
      annotation_id TEXT NOT NULL,
      page_id TEXT NOT NULL,
      x INTEGER NOT NULL,
      y INTEGER NOT NULL,
      width INTEGER NOT NULL,
      height INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(annotation_id) REFERENCES annotations(id) ON DELETE CASCADE,
      FOREIGN KEY(page_id) REFERENCES pages(id) ON DELETE CASCADE
    )
  `);

  try {
    const regionCols = await all("PRAGMA table_info(annotation_regions)");
    if (!regionCols.some((col) => col.name === "order_index")) {
      await run(
        "ALTER TABLE annotation_regions ADD COLUMN order_index INTEGER NOT NULL DEFAULT 0",
      );
    }
  } catch (e) {}

  await run(`
    CREATE TABLE IF NOT EXISTS user_articles (
      user_id TEXT NOT NULL,
      article_id TEXT NOT NULL,
      assigned_at TEXT NOT NULL,
      PRIMARY KEY (user_id, article_id),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(article_id) REFERENCES articles(id) ON DELETE CASCADE
    )
  `);

  await ensureAdminUser();

  await migrateAnnotationsToRegions();
}

async function migrateAnnotationsToRegions() {

  const rows = await all(
    "SELECT id, page_id, x, y, width, height FROM annotations WHERE (x != 0 OR y != 0 OR width != 0 OR height != 0)",
  );
  if (!rows.length) return;

  const now = nowIso();
  for (const row of rows) {

    const existing = await get(
      "SELECT id FROM annotation_regions WHERE annotation_id = ? AND page_id = ?",
      [row.id, row.page_id],
    );
    if (!existing) {
      await run(
        `INSERT INTO annotation_regions (id, annotation_id, page_id, x, y, width, height, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uid("region"),
          row.id,
          row.page_id,
          row.x,
          row.y,
          row.width,
          row.height,
          now,
        ],
      );
    }

    await run(
      "UPDATE annotations SET x = 0, y = 0, width = 0, height = 0 WHERE id = ?",
      [row.id],
    );
  }
}

const SALT_LEN = 16;
const KEY_LEN = 32;

function hashPassword(password) {
  const salt = crypto.randomBytes(SALT_LEN).toString("hex");
  const key = crypto.scryptSync(password, salt, KEY_LEN).toString("hex");
  return `${salt}:${key}`;
}

function verifyPassword(password, hash) {
  const [salt, key] = hash.split(":");
  const derived = crypto.scryptSync(password, salt, KEY_LEN).toString("hex");
  return derived === key;
}

const JWT_SECRET =
  process.env.JWT_SECRET || "sdudoc-secret-key-change-in-production";
const JWT_EXPIRY = 7 * 24 * 60 * 60;

function base64UrlEncode(data) {
  return Buffer.from(data)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlDecode(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  return Buffer.from(str, "base64").toString("utf8");
}

function createToken(userId, role) {
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64UrlEncode(
    JSON.stringify({
      userId,
      role,
      exp: Math.floor(Date.now() / 1000) + JWT_EXPIRY,
    }),
  );
  const signature = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `${header}.${payload}.${signature}`;
}

function verifyToken(token) {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;
  const expected = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  if (expected !== signature) return null;
  try {
    const data = JSON.parse(base64UrlDecode(payload));
    if (data.exp && data.exp < Math.floor(Date.now() / 1000)) return null;
    return data;
  } catch (e) {
    return null;
  }
}

async function ensureAdminUser() {
  const existing = await get("SELECT id FROM users WHERE username = ?", [
    "admin",
  ]);
  if (existing) return;
  const now = nowIso();
  await run(
    `INSERT INTO users (id, username, password_hash, display_name, role, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      uid("user"),
      "admin",
      hashPassword("admin123"),
      "管理员",
      "admin",
      now,
      now,
    ],
  );
}

function mapUserRow(row) {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    role: row.role,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getUserByUsername(username) {
  const row = await get("SELECT * FROM users WHERE username = ?", [username]);
  return row || null;
}

async function getUserById(userId) {
  const row = await get("SELECT * FROM users WHERE id = ?", [userId]);
  return row ? mapUserRow(row) : null;
}

async function listUsers() {
  const rows = await all("SELECT * FROM users ORDER BY created_at ASC");
  return rows.map(mapUserRow);
}

async function createUser(username, password, displayName, role) {
  const existing = await get("SELECT id FROM users WHERE username = ?", [
    username,
  ]);
  if (existing) throw new Error("用户名已存在");
  const now = nowIso();
  const user = {
    id: uid("user"),
    username,
    displayName: displayName || username,
    role: role || "editor",
    createdAt: now,
    updatedAt: now,
  };
  await run(
    `INSERT INTO users (id, username, password_hash, display_name, role, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      user.id,
      username,
      hashPassword(password),
      user.displayName,
      user.role,
      now,
      now,
    ],
  );
  return user;
}

async function updateUser(userId, updates) {
  const row = await get("SELECT * FROM users WHERE id = ?", [userId]);
  if (!row) throw new Error("用户不存在");
  const now = nowIso();
  if (updates.role) {
    await run("UPDATE users SET role = ?, updated_at = ? WHERE id = ?", [
      updates.role,
      now,
      userId,
    ]);
  }
  if (updates.displayName) {
    await run(
      "UPDATE users SET display_name = ?, updated_at = ? WHERE id = ?",
      [updates.displayName, now, userId],
    );
  }
  if (updates.password) {
    await run(
      "UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?",
      [hashPassword(updates.password), now, userId],
    );
  }
  return getUserById(userId);
}

async function deleteUser(userId) {
  const row = await get("SELECT * FROM users WHERE id = ?", [userId]);
  if (!row) throw new Error("用户不存在");
  if (row.username === "admin") throw new Error("不能删除默认管理员");
  await run("DELETE FROM users WHERE id = ?", [userId]);
}

function mapCommentRow(row) {
  return {
    id: row.id,
    articleId: row.article_id,
    annotationId: row.annotation_id || null,
    pageId: row.page_id || null,
    userId: row.user_id,
    username: row.username || "",
    displayName: row.display_name || "",
    content: row.content,
    resolved: row.resolved === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getCommentsByArticle(articleId) {
  const rows = await all(
    `SELECT c.*, u.username, u.display_name
     FROM comments c
     LEFT JOIN users u ON u.id = c.user_id
     WHERE c.article_id = ?
     ORDER BY c.created_at ASC`,
    [articleId],
  );
  return rows.map(mapCommentRow);
}

async function createComment(articleId, userId, payload) {
  const now = nowIso();
  const comment = {
    id: uid("comment"),
    articleId,
    annotationId: payload.annotationId || null,
    pageId: payload.pageId || null,
    userId,
    content: payload.content || "",
    resolved: 0,
    createdAt: now,
    updatedAt: now,
  };
  await run(
    `INSERT INTO comments (id, article_id, annotation_id, page_id, user_id, content, resolved, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      comment.id,
      comment.articleId,
      comment.annotationId,
      comment.pageId,
      comment.userId,
      comment.content,
      0,
      now,
      now,
    ],
  );
  const row = await get(
    `SELECT c.*, u.username, u.display_name FROM comments c LEFT JOIN users u ON u.id = c.user_id WHERE c.id = ?`,
    [comment.id],
  );
  return row ? mapCommentRow(row) : comment;
}

async function updateComment(commentId, updates) {
  const row = await get("SELECT * FROM comments WHERE id = ?", [commentId]);
  if (!row) throw new Error("评论不存在");
  const now = nowIso();
  if (updates.content !== undefined) {
    await run("UPDATE comments SET content = ?, updated_at = ? WHERE id = ?", [
      updates.content,
      now,
      commentId,
    ]);
  }
  if (updates.resolved !== undefined) {
    await run("UPDATE comments SET resolved = ?, updated_at = ? WHERE id = ?", [
      updates.resolved ? 1 : 0,
      now,
      commentId,
    ]);
  }
  const updated = await get(
    `SELECT c.*, u.username, u.display_name FROM comments c LEFT JOIN users u ON u.id = c.user_id WHERE c.id = ?`,
    [commentId],
  );
  return updated ? mapCommentRow(updated) : null;
}

async function deleteComment(commentId) {
  await run("DELETE FROM comments WHERE id = ?", [commentId]);
}

async function ensureArticle(articleId) {
  const row = await get("SELECT * FROM articles WHERE id = ?", [articleId]);
  if (row) {
    return mapArticleRow(row);
  }
  const article = defaultArticle(articleId);
  await upsertArticle(article);
  return article;
}

async function getArticle(articleId) {
  const row = await get("SELECT * FROM articles WHERE id = ?", [articleId]);
  return row ? mapArticleRow(row) : null;
}

async function upsertArticle(article) {
  const now = nowIso();
  const existing = await getArticle(article.id);
  if (!existing) {
    await run(
      `INSERT INTO articles
      (id, type, version, title, subtitle, author, book, volume, publish_year, writing_year, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        article.id,
        article.type || "1",
        article.version || "1.0",
        article.title || "",
        article.subtitle || "",
        article.author || "",
        article.book || "",
        article.volume || "",
        article.publishYear || "",
        article.writingYear || "",
        now,
        now,
      ],
    );
  } else {
    await run(
      `UPDATE articles
       SET type = ?, version = ?, title = ?, subtitle = ?, author = ?, book = ?, volume = ?, publish_year = ?, writing_year = ?, updated_at = ?
       WHERE id = ?`,
      [
        article.type || existing.type,
        article.version || existing.version,
        article.title || "",
        article.subtitle || "",
        article.author || "",
        article.book || "",
        article.volume || "",
        article.publishYear || "",
        article.writingYear || "",
        now,
        article.id,
      ],
    );
  }

  return ensureArticle(article.id);
}

async function getPageIdsByArticle(articleId) {
  const rows = await all("SELECT id FROM pages WHERE article_id = ?", [
    articleId,
  ]);
  return rows.map((r) => r.id);
}

async function getPagesByArticle(articleId) {
  const pageRows = await all(
    "SELECT * FROM pages WHERE article_id = ? ORDER BY page_no ASC",
    [articleId],
  );
  const pages = pageRows.map(mapPageRow);
  if (!pages.length) {
    return pages;
  }

  const regionRows = await all(
    `SELECT ar.id AS region_id, ar.annotation_id, ar.page_id, ar.x, ar.y, ar.width, ar.height,
            a.id AS ann_id, a.char_id, a.level, a.style, a.color,
            a.original_text, a.simplified_text, a.note, a.note_type,
            a.char_code, a.glyph_ref, a.review_status, a.reviewed_by,
            a.parent_id, a.order_index
     FROM annotation_regions ar
     JOIN annotations a ON a.id = ar.annotation_id
     WHERE a.article_id = ?
     ORDER BY a.created_at ASC`,
    [articleId],
  );

  const allAnnotationRows = await all(
    "SELECT * FROM annotations WHERE article_id = ? ORDER BY created_at ASC",
    [articleId],
  );
  const allAnnotationsMap = new Map();
  allAnnotationRows.forEach((row) => {
    allAnnotationsMap.set(row.id, mapAnnotationRow(row));
  });

  const pageMap = new Map(pages.map((page) => [page.id, page]));

  const pageAnnotationIds = new Map();
  regionRows.forEach((row) => {
    if (!pageAnnotationIds.has(row.page_id)) {
      pageAnnotationIds.set(row.page_id, new Set());
    }
    pageAnnotationIds.get(row.page_id).add(row.annotation_id);
  });

  const childrenMap = new Map();
  allAnnotationRows.forEach((row) => {
    if (row.parent_id) {
      if (!childrenMap.has(row.parent_id)) {
        childrenMap.set(row.parent_id, []);
      }
      childrenMap.get(row.parent_id).push(row.id);
    }
  });

  function getAllDescendants(parentId, result = new Set()) {
    const children = childrenMap.get(parentId) || [];
    for (const childId of children) {
      if (!result.has(childId)) {
        result.add(childId);
        getAllDescendants(childId, result);
      }
    }
    return result;
  }

  const annotationRegionsMap = new Map();
  regionRows.forEach((row) => {
    if (!annotationRegionsMap.has(row.annotation_id)) {
      annotationRegionsMap.set(row.annotation_id, []);
    }
    annotationRegionsMap.get(row.annotation_id).push({
      id: row.region_id,
      pageId: row.page_id,
      x: row.x,
      y: row.y,
      width: row.width,
      height: row.height,
    });
  });

  for (const page of pages) {
    const directIds = pageAnnotationIds.get(page.id) || new Set();

    const allIds = new Set(directIds);
    for (const annId of directIds) {
      const descendants = getAllDescendants(annId);
      for (const descId of descendants) {
        allIds.add(descId);
      }
    }

    const annotations = [];
    for (const annId of allIds) {
      const ann = allAnnotationsMap.get(annId);
      if (!ann) continue;

      const allRegions = annotationRegionsMap.get(annId) || [];
      const pageRegions = allRegions.filter((r) => r.pageId === page.id);
      annotations.push({
        ...ann,
        regions: pageRegions.map((r) => ({
          id: r.id,
          x: r.x,
          y: r.y,
          width: r.width,
          height: r.height,
        })),
      });
    }

    page.annotations = annotations;
  }

  return pages;
}

async function createPages(articleId, pagesInput) {
  await ensureArticle(articleId);
  if (!Array.isArray(pagesInput) || !pagesInput.length) {
    return [];
  }

  return transaction(async () => {
    const maxRow = await get(
      "SELECT COALESCE(MAX(page_no), 0) AS max_no FROM pages WHERE article_id = ?",
      [articleId],
    );
    let pageNo = Number(maxRow ? maxRow.max_no : 0);
    const now = nowIso();
    const created = [];

    for (const page of pagesInput) {
      const src = saveImageDataUrl(page.srcDataUrl, "pages");
      pageNo += 1;
      const pageId = page.id || uid("page");
      const width = Number(page.width) || 0;
      const height = Number(page.height) || 0;
      const name = page.name || `page-${pageNo}`;

      await run(
        `INSERT INTO pages
         (id, article_id, page_no, name, src, width, height, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [pageId, articleId, pageNo, name, src, width, height, now, now],
      );

      created.push({
        id: pageId,
        pageNo,
        name,
        src,
        width,
        height,
        annotations: [],
      });
    }

    return created;
  });
}

async function clearPagesByArticle(articleId) {
  await ensureArticle(articleId);
  await transaction(async () => {
    const pageRows = await all("SELECT src FROM pages WHERE article_id = ?", [
      articleId,
    ]);
    await run("DELETE FROM pages WHERE article_id = ?", [articleId]);
    pageRows.forEach((row) => {
      if (!row.src) {
        return;
      }
      const diskPath = path.join(PROJECT_ROOT, row.src.replace(/^\//, ""));
      if (fs.existsSync(diskPath)) {
        fs.unlinkSync(diskPath);
      }
    });
  });
}

async function getPageRow(pageId) {
  return get("SELECT * FROM pages WHERE id = ?", [pageId]);
}

async function createAnnotation(pageId, payload) {
  const page = await get("SELECT * FROM pages WHERE id = ?", [pageId]);
  if (!page) {
    throw new Error("页面不存在");
  }
  const now = nowIso();
  const ann = {
    id: payload.id || uid("ann"),
    charId: payload.charId || uid("char"),
    level: payload.level || "char",
    style: payload.style || "highlight",
    color: payload.color || "#d5533f",
    originalText: payload.originalText || "",
    simplifiedText: payload.simplifiedText || "",
    note: payload.note || "",
    noteType: payload.noteType || "1",
    charCode: payload.charCode || "",
    glyphRef: payload.glyphRef || "",
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    parentId: payload.parentId || null,
    orderIndex: Number(payload.orderIndex) || 0,
  };

  await run(
    `INSERT INTO annotations
    (id, article_id, page_id, char_id, level, style, color, original_text, simplified_text, note, note_type, char_code, glyph_ref, x, y, width, height, parent_id, order_index, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      ann.id,
      page.article_id,
      pageId,
      ann.charId,
      ann.level,
      ann.style,
      ann.color,
      ann.originalText,
      ann.simplifiedText,
      ann.note,
      ann.noteType,
      ann.charCode,
      ann.glyphRef,
      0,
      0,
      0,
      0,
      ann.parentId,
      ann.orderIndex,
      now,
      now,
    ],
  );

  const regionX = Number(payload.x) || 0;
  const regionY = Number(payload.y) || 0;
  const regionW = Number(payload.width) || 0;
  const regionH = Number(payload.height) || 0;
  const region = await addAnnotationRegion(
    ann.id,
    pageId,
    regionX,
    regionY,
    regionW,
    regionH,
  );

  return {
    ...ann,
    pageId,
    regions: [
      {
        id: region.id,
        x: region.x,
        y: region.y,
        width: region.width,
        height: region.height,
      },
    ],
  };
}

async function updateAnnotation(annotationId, payload) {
  const row = await get("SELECT * FROM annotations WHERE id = ?", [
    annotationId,
  ]);
  if (!row) {
    throw new Error("标注不存在");
  }

  const regionRows = await all(
    "SELECT DISTINCT page_id FROM annotation_regions WHERE annotation_id = ?",
    [annotationId],
  );
  const pageIds = regionRows.map((r) => r.page_id);

  const merged = {
    charId: payload.charId || row.char_id,
    level: payload.level || row.level,
    style: payload.style || row.style,
    color: payload.color || row.color,
    originalText: payload.originalText ?? row.original_text,
    simplifiedText: payload.simplifiedText ?? row.simplified_text,
    note: payload.note ?? row.note,
    noteType: payload.noteType ?? row.note_type,
    charCode: payload.charCode ?? row.char_code,
    glyphRef: payload.glyphRef ?? row.glyph_ref,
    x: Number(payload.x ?? row.x),
    y: Number(payload.y ?? row.y),
    width: Number(payload.width ?? row.width),
    height: Number(payload.height ?? row.height),
    reviewStatus: payload.reviewStatus ?? row.review_status ?? "pending",
    reviewedBy: payload.reviewedBy ?? row.reviewed_by ?? "",
    parentId:
      payload.parentId !== undefined ? payload.parentId : row.parent_id || null,
    orderIndex: Number(payload.orderIndex ?? row.order_index ?? 0),
  };

  await run(
    `UPDATE annotations
     SET char_id = ?, level = ?, style = ?, color = ?, original_text = ?, simplified_text = ?, note = ?, note_type = ?, char_code = ?, glyph_ref = ?, x = ?, y = ?, width = ?, height = ?, review_status = ?, reviewed_by = ?, parent_id = ?, order_index = ?, updated_at = ?
     WHERE id = ?`,
    [
      merged.charId,
      merged.level,
      merged.style,
      merged.color,
      merged.originalText,
      merged.simplifiedText,
      merged.note,
      merged.noteType,
      merged.charCode,
      merged.glyphRef,
      merged.x,
      merged.y,
      merged.width,
      merged.height,
      merged.reviewStatus,
      merged.reviewedBy,
      merged.parentId,
      merged.orderIndex,
      nowIso(),
      annotationId,
    ],
  );

  return {
    id: annotationId,
    pageId: row.page_id,
    pageIds,
    ...merged,
  };
}

async function deleteAnnotation(annotationId) {

  const regionRows = await all(
    "SELECT DISTINCT page_id FROM annotation_regions WHERE annotation_id = ?",
    [annotationId],
  );
  const pageIds = regionRows.map((r) => r.page_id);
  const row = await get("SELECT page_id FROM annotations WHERE id = ?", [
    annotationId,
  ]);
  await transaction(async () => {
    await run("UPDATE annotations SET parent_id = NULL WHERE parent_id = ?", [
      annotationId,
    ]);
    await run(
      "UPDATE headings SET annotation_id = NULL WHERE annotation_id = ?",
      [annotationId],
    );
    await run("DELETE FROM annotations WHERE id = ?", [annotationId]);
  });
  return row ? { pageId: row.page_id, pageIds } : null;
}

async function getChildAnnotations(parentId) {
  const rows = await all(
    "SELECT * FROM annotations WHERE parent_id = ? ORDER BY order_index ASC, created_at ASC",
    [parentId],
  );
  return rows.map(mapAnnotationRow);
}

async function addAnnotationRegion(annotationId, pageId, x, y, width, height) {
  const id = uid("region");
  const now = nowIso();
  await run(
    `INSERT INTO annotation_regions (id, annotation_id, page_id, x, y, width, height, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      annotationId,
      pageId,
      Math.round(x),
      Math.round(y),
      Math.round(width),
      Math.round(height),
      now,
    ],
  );
  return {
    id,
    annotationId,
    pageId,
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height),
    createdAt: now,
  };
}

async function getAnnotationsForPage(pageId) {
  const pageRow = await get("SELECT * FROM pages WHERE id = ?", [pageId]);
  if (!pageRow) return [];

  const articleId = pageRow.article_id;

  const regionRows = await all(
    `SELECT ar.id AS region_id, ar.annotation_id, ar.page_id, ar.x, ar.y, ar.width, ar.height
     FROM annotation_regions ar
     JOIN annotations a ON a.id = ar.annotation_id
     WHERE ar.page_id = ?
     ORDER BY a.created_at ASC`,
    [pageId],
  );

  const directIds = new Set(regionRows.map((r) => r.annotation_id));

  const allAnnotationRows = await all(
    "SELECT * FROM annotations WHERE article_id = ? ORDER BY created_at ASC",
    [articleId],
  );
  const allAnnotationsMap = new Map();
  allAnnotationRows.forEach((row) => {
    allAnnotationsMap.set(row.id, mapAnnotationRow(row));
  });

  const childrenMap = new Map();
  allAnnotationRows.forEach((row) => {
    if (row.parent_id) {
      if (!childrenMap.has(row.parent_id)) childrenMap.set(row.parent_id, []);
      childrenMap.get(row.parent_id).push(row.id);
    }
  });

  function getAllDescendants(parentId, result = new Set()) {
    const children = childrenMap.get(parentId) || [];
    for (const childId of children) {
      if (!result.has(childId)) {
        result.add(childId);
        getAllDescendants(childId, result);
      }
    }
    return result;
  }

  const allIds = new Set(directIds);
  for (const annId of directIds) {
    const descendants = getAllDescendants(annId);
    for (const descId of descendants) {
      allIds.add(descId);
    }
  }

  const allRegionRows =
    allIds.size > 0
      ? await all(
          `SELECT * FROM annotation_regions WHERE annotation_id IN (${[...allIds].map(() => "?").join(",")})`,
          [...allIds],
        )
      : [];

  const annotationRegionsMap = new Map();
  allRegionRows.forEach((row) => {
    if (!annotationRegionsMap.has(row.annotation_id)) {
      annotationRegionsMap.set(row.annotation_id, []);
    }
    annotationRegionsMap.get(row.annotation_id).push({
      id: row.id,
      pageId: row.page_id,
      x: row.x,
      y: row.y,
      width: row.width,
      height: row.height,
    });
  });

  const annotations = [];
  for (const annId of allIds) {
    const ann = allAnnotationsMap.get(annId);
    if (!ann) continue;
    const allRegions = annotationRegionsMap.get(annId) || [];
    const pageRegions = allRegions.filter((r) => r.pageId === pageId);
    annotations.push({
      ...ann,
      regions: pageRegions.map((r) => ({
        id: r.id,
        x: r.x,
        y: r.y,
        width: r.width,
        height: r.height,
      })),
    });
  }

  return annotations;
}

async function getRegionsByPage(pageId) {
  const rows = await all(
    `SELECT ar.*, a.level, a.style, a.color, a.original_text, a.simplified_text,
            a.note, a.note_type, a.char_id, a.char_code, a.glyph_ref,
            a.review_status, a.reviewed_by, a.parent_id, a.order_index, a.page_id AS ann_page_id
     FROM annotation_regions ar
     JOIN annotations a ON a.id = ar.annotation_id
     WHERE ar.page_id = ?`,
    [pageId],
  );
  return rows.map((row) => ({
    regionId: row.id,
    annotationId: row.annotation_id,
    pageId: row.page_id,
    x: row.x,
    y: row.y,
    width: row.width,
    height: row.height,

    id: row.annotation_id,
    charId: row.char_id,
    level: row.level,
    style: row.style,
    color: row.color,
    originalText: row.original_text || "",
    simplifiedText: row.simplified_text || "",
    note: row.note || "",
    noteType: row.note_type || "1",
    charCode: row.char_code || "",
    glyphRef: row.glyph_ref || "",
    reviewStatus: row.review_status || "pending",
    reviewedBy: row.reviewed_by || "",
    parentId: row.parent_id || null,
    orderIndex: row.order_index || 0,
    originalPageId: row.ann_page_id,
  }));
}

async function getRegionsByAnnotation(annotationId) {
  const rows = await all(
    "SELECT * FROM annotation_regions WHERE annotation_id = ? ORDER BY order_index ASC, created_at ASC",
    [annotationId],
  );
  return rows.map((row) => ({
    id: row.id,
    annotationId: row.annotation_id,
    pageId: row.page_id,
    x: row.x,
    y: row.y,
    width: row.width,
    height: row.height,
    orderIndex: row.order_index || 0,
    createdAt: row.created_at,
  }));
}

/**
 * @description 按区域 ID 查询单个标注区域，供协作广播时补充 pageId / annotationId。
 * @param {string} regionId 区域 ID。
 * @returns {Promise<object|null>} 区域对象；不存在时返回 null。
 */
async function getAnnotationRegion(regionId) {
  const row = await get("SELECT * FROM annotation_regions WHERE id = ?", [
    regionId,
  ]);
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    annotationId: row.annotation_id,
    pageId: row.page_id,
    x: row.x,
    y: row.y,
    width: row.width,
    height: row.height,
    orderIndex: row.order_index || 0,
    createdAt: row.created_at,
  };
}

async function deleteAnnotationRegion(regionId) {
  await run("DELETE FROM annotation_regions WHERE id = ?", [regionId]);
}

async function updateAnnotationRegion(regionId, payload) {
  const x = Number(payload.x);
  const y = Number(payload.y);
  const width = Number(payload.width);
  const height = Number(payload.height);

  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(width) ||
    !Number.isFinite(height)
  ) {
    throw new Error("区域坐标参数无效");
  }

  await run(
    `UPDATE annotation_regions
     SET x = ?, y = ?, width = ?, height = ?
     WHERE id = ?`,
    [x, y, width, height, regionId],
  );

  const row = await get("SELECT * FROM annotation_regions WHERE id = ?", [
    regionId,
  ]);
  if (!row) {
    throw new Error("区域不存在");
  }

  return {
    id: row.id,
    annotationId: row.annotation_id,
    pageId: row.page_id,
    x: row.x,
    y: row.y,
    width: row.width,
    height: row.height,
    orderIndex: row.order_index || 0,
    createdAt: row.created_at,
  };
}

async function reorderAnnotationRegions(annotationId, regionIds) {
  for (let i = 0; i < regionIds.length; i++) {
    await run(
      "UPDATE annotation_regions SET order_index = ? WHERE id = ? AND annotation_id = ?",
      [i, regionIds[i], annotationId],
    );
  }
}

async function getHeadingsByArticle(articleId) {
  await ensureArticle(articleId);
  const rows = await all(
    `SELECT h.*, p.page_no
     FROM headings h
     LEFT JOIN pages p ON p.id = h.page_id
     WHERE h.article_id = ?
     ORDER BY COALESCE(p.page_no, 999999) ASC, h.y ASC, h.created_at ASC`,
    [articleId],
  );
  return rows.map(mapHeadingRow);
}

async function createHeading(articleId, payload) {
  await ensureArticle(articleId);
  const pageId = String(payload.pageId || "").trim();
  if (!pageId) {
    throw new Error("请选择标题关联页面");
  }

  const pageRow = await get("SELECT id, article_id FROM pages WHERE id = ?", [
    pageId,
  ]);
  if (!pageRow) {
    throw new Error("页面不存在");
  }
  if (pageRow.article_id !== articleId) {
    throw new Error("标题页面不属于当前文章");
  }

  const titleText = String(payload.titleText || "").trim();
  if (!titleText) {
    throw new Error("标题文本不能为空");
  }

  const levelRaw = Number(payload.level || 1);
  const level = Number.isFinite(levelRaw)
    ? Math.max(1, Math.min(4, Math.round(levelRaw)))
    : 1;

  const annotationIdRaw = String(payload.annotationId || "").trim();
  let annotationId = null;
  if (annotationIdRaw) {
    const annRow = await get(
      "SELECT id, article_id FROM annotations WHERE id = ?",
      [annotationIdRaw],
    );
    if (!annRow) {
      throw new Error("关联标注不存在");
    }
    if (annRow.article_id !== articleId) {
      throw new Error("关联标注与文章不匹配");
    }
    annotationId = annRow.id;
  }

  const yRaw = Number(payload.y || 0);
  const y = Number.isFinite(yRaw) ? Math.max(0, Math.round(yRaw)) : 0;

  const parentIdRaw = String(payload.parentId || "").trim();
  let parentId = null;
  if (parentIdRaw) {
    const parentRow = await get(
      "SELECT id, article_id FROM headings WHERE id = ?",
      [parentIdRaw],
    );
    if (!parentRow) {
      throw new Error("上级标题不存在");
    }
    if (parentRow.article_id !== articleId) {
      throw new Error("上级标题不属于当前文章");
    }
    parentId = parentRow.id;
  }

  const orderIndex = Number(payload.orderIndex || 0);

  const heading = {
    id: uid("heading"),
    articleId,
    pageId,
    annotationId,
    titleText,
    level,
    y,
    parentId,
    orderIndex,
    createdAt: nowIso(),
  };

  await run(
    `INSERT INTO headings
     (id, article_id, page_id, annotation_id, title_text, level, y, parent_id, order_index, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      heading.id,
      heading.articleId,
      heading.pageId,
      heading.annotationId,
      heading.titleText,
      heading.level,
      heading.y,
      heading.parentId,
      heading.orderIndex,
      heading.createdAt,
      heading.createdAt,
    ],
  );

  const row = await get(
    `SELECT h.*, p.page_no
     FROM headings h
     LEFT JOIN pages p ON p.id = h.page_id
     WHERE h.id = ?`,
    [heading.id],
  );
  return row ? mapHeadingRow(row) : null;
}

/**
 * @description 按标题 ID 查询单个标题，供删除前广播所属文章与标题信息。
 * @param {string} headingId 标题 ID。
 * @returns {Promise<object|null>} 标题对象；不存在时返回 null。
 */
async function getHeadingById(headingId) {
  const row = await get(
    `SELECT h.*, p.page_no
     FROM headings h
     LEFT JOIN pages p ON p.id = h.page_id
     WHERE h.id = ?`,
    [headingId],
  );
  return row ? mapHeadingRow(row) : null;
}

async function deleteHeading(headingId) {
  await run("DELETE FROM headings WHERE id = ?", [headingId]);
}

async function updateHeadingParent(
  articleId,
  headingId,
  parentId,
  orderIndex = 0,
  level = null,
) {
  const now = nowIso();

  if (parentId) {
    const parentRow = await get(
      "SELECT id, article_id FROM headings WHERE id = ?",
      [parentId],
    );
    if (!parentRow) {
      throw new Error("上级标题不存在");
    }
    if (parentRow.article_id !== articleId) {
      throw new Error("上级标题不属于当前文章");
    }
  }

  const headingRow = await get(
    "SELECT id, article_id FROM headings WHERE id = ?",
    [headingId],
  );
  if (!headingRow) {
    throw new Error("标题不存在");
  }
  if (headingRow.article_id !== articleId) {
    throw new Error("标题不属于当前文章");
  }

  if (level !== null) {
    await run(
      `UPDATE headings SET parent_id = ?, order_index = ?, level = ?, updated_at = ? WHERE id = ?`,
      [parentId || null, orderIndex, level, now, headingId],
    );

    await updateChildLevelsDb(articleId, headingId, level);
  } else {
    await run(
      `UPDATE headings SET parent_id = ?, order_index = ?, updated_at = ? WHERE id = ?`,
      [parentId || null, orderIndex, now, headingId],
    );
  }

  const row = await get(
    `SELECT h.*, p.page_no
     FROM headings h
     LEFT JOIN pages p ON p.id = h.page_id
     WHERE h.id = ?`,
    [headingId],
  );
  return row ? mapHeadingRow(row) : null;
}

async function updateChildLevelsDb(articleId, parentId, parentLevel) {
  const children = await all(
    "SELECT id FROM headings WHERE article_id = ? AND parent_id = ?",
    [articleId, parentId],
  );
  for (const child of children) {
    const childLevel = parentLevel + 1;
    await run("UPDATE headings SET level = ? WHERE id = ?", [
      childLevel,
      child.id,
    ]);
    await updateChildLevelsDb(articleId, child.id, childLevel);
  }
}

async function reorderHeadings(articleId, parentId, orderedIds) {
  const now = nowIso();
  for (let i = 0; i < orderedIds.length; i++) {
    await run(
      "UPDATE headings SET order_index = ?, updated_at = ? WHERE id = ? AND article_id = ?",
      [i, now, orderedIds[i], articleId],
    );
  }
}

async function getGlyphsByArticle(articleId) {
  const rows = await all(
    "SELECT * FROM glyphs WHERE article_id = ? ORDER BY created_at DESC",
    [articleId],
  );
  return rows.map(mapGlyphRow);
}

async function createGlyph(articleId, payload) {
  await ensureArticle(articleId);
  const code = String(payload.code || "")
    .trim()
    .toUpperCase();
  if (!/^U\+[0-9A-F]{4,6}$/.test(code)) {
    throw new Error("编码格式不正确，请输入形如 U+E001 的值");
  }

  const exists = await get(
    "SELECT id FROM glyphs WHERE article_id = ? AND code = ?",
    [articleId, code],
  );
  if (exists) {
    throw new Error("该编码已存在，请更换编码");
  }

  let imgSrc = "";
  if (payload.imgDataUrl) {
    imgSrc = saveImageDataUrl(payload.imgDataUrl, "glyphs");
  }

  const glyph = {
    id: uid("glyph"),
    code,
    name: payload.name || "",
    note: payload.note || "",
    imgDataUrl: imgSrc,
  };

  const now = nowIso();
  await run(
    `INSERT INTO glyphs
     (id, article_id, code, name, note, img_src, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      glyph.id,
      articleId,
      glyph.code,
      glyph.name,
      glyph.note,
      glyph.imgDataUrl,
      now,
      now,
    ],
  );

  return glyph;
}

async function importGlyph(articleId, payload) {
  await ensureArticle(articleId);
  const code = String(payload.code || "")
    .trim()
    .toUpperCase();
  if (!/^U\+[0-9A-F]{4,6}$/.test(code)) {
    throw new Error("编码格式不正确，请输入形如 U+E001 的值");
  }

  const exists = await get(
    "SELECT id FROM glyphs WHERE article_id = ? AND code = ?",
    [articleId, code],
  );
  if (exists) {
    throw new Error("该编码已存在，请更换编码");
  }

  let imgSrc = "";
  if (payload.imgDataUrl) {
    if (payload.imgDataUrl.startsWith("data:")) {
      imgSrc = saveImageDataUrl(payload.imgDataUrl, "glyphs");
    } else if (payload.imgDataUrl.startsWith("/uploads/")) {
      imgSrc = payload.imgDataUrl;
    }
  }

  const glyph = {
    id: uid("glyph"),
    code,
    name: payload.name || "",
    note: payload.note || "",
    imgDataUrl: imgSrc,
  };

  const now = nowIso();
  await run(
    `INSERT INTO glyphs
     (id, article_id, code, name, note, img_src, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      glyph.id,
      articleId,
      glyph.code,
      glyph.name,
      glyph.note,
      glyph.imgDataUrl,
      now,
      now,
    ],
  );

  return glyph;
}

async function deleteGlyph(glyphId) {
  const glyph = await get("SELECT * FROM glyphs WHERE id = ?", [glyphId]);
  if (!glyph) {
    return null;
  }

  await transaction(async () => {
    await run("DELETE FROM glyphs WHERE id = ?", [glyphId]);
    await run("UPDATE annotations SET glyph_ref = '' WHERE glyph_ref = ?", [
      glyphId,
    ]);
  });

  if (glyph.img_src) {
    const diskPath = path.join(PROJECT_ROOT, glyph.img_src.replace(/^\//, ""));
    if (fs.existsSync(diskPath)) {
      fs.unlinkSync(diskPath);
    }
  }

  return {
    ...mapGlyphRow(glyph),
    articleId: glyph.article_id,
  };
}

async function getPageSrcsByArticle(articleId, limit = 3) {
  await ensureArticle(articleId);
  const rows = await all(
    "SELECT src FROM pages WHERE article_id = ? ORDER BY page_no ASC LIMIT ?",
    [articleId, limit],
  );
  return rows.map((r) => r.src).filter(Boolean);
}

async function getSnapshot(articleId) {
  const article = await ensureArticle(articleId);
  const pages = await getPagesByArticle(articleId);
  const glyphs = await getGlyphsByArticle(articleId);
  const headings = await getHeadingsByArticle(articleId);
  return {
    article,
    pages,
    glyphs,
    headings,
  };
}

async function saveXmlVersion(articleId, xmlContent) {
  await ensureArticle(articleId);
  const maxRow = await get(
    "SELECT COALESCE(MAX(version_no), 0) AS max_no FROM xml_versions WHERE article_id = ?",
    [articleId],
  );
  const nextVersion = Number(maxRow ? maxRow.max_no : 0) + 1;
  const versionId = uid("xmlv");
  const now = nowIso();

  await run(
    `INSERT INTO xml_versions (id, article_id, version_no, xml_content, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [versionId, articleId, nextVersion, xmlContent, now],
  );

  return {
    id: versionId,
    articleId,
    versionNo: nextVersion,
    createdAt: now,
    xml: xmlContent,
  };
}

async function listXmlVersions(articleId) {
  await ensureArticle(articleId);
  const rows = await all(
    "SELECT version_no, created_at, LENGTH(xml_content) AS size FROM xml_versions WHERE article_id = ? ORDER BY version_no DESC",
    [articleId],
  );
  return rows.map((row) => ({
    versionNo: row.version_no,
    createdAt: row.created_at,
    size: row.size || 0,
  }));
}

async function getXmlVersion(articleId, versionNo) {
  const row = await get(
    "SELECT version_no, created_at, xml_content FROM xml_versions WHERE article_id = ? AND version_no = ?",
    [articleId, Number(versionNo)],
  );
  if (!row) {
    return null;
  }
  return {
    versionNo: row.version_no,
    createdAt: row.created_at,
    xml: row.xml_content,
  };
}

async function listArticles() {
  const rows = await all("SELECT * FROM articles ORDER BY updated_at DESC");
  return rows.map(mapArticleRow);
}

async function listArticlesForUser(userId, role) {
  if (role === "admin") {
    return listArticles();
  }
  const rows = await all(
    `SELECT a.* FROM articles a
     INNER JOIN user_articles ua ON ua.article_id = a.id
     WHERE ua.user_id = ?
     ORDER BY a.updated_at DESC`,
    [userId],
  );
  return rows.map(mapArticleRow);
}

async function checkArticleAccess(userId, articleId, role) {
  if (role === "admin") return true;
  const row = await get(
    "SELECT 1 FROM user_articles WHERE user_id = ? AND article_id = ?",
    [userId, articleId],
  );
  return !!row;
}

async function assignArticleAccess(userId, articleId) {
  const now = nowIso();
  await run(
    "INSERT OR IGNORE INTO user_articles (user_id, article_id, assigned_at) VALUES (?, ?, ?)",
    [userId, articleId, now],
  );
}

async function removeArticleAccess(userId, articleId) {
  await run("DELETE FROM user_articles WHERE user_id = ? AND article_id = ?", [
    userId,
    articleId,
  ]);
}

async function getArticleAccessUsers(articleId) {
  const rows = await all(
    `SELECT u.id, u.username, u.display_name, u.role, ua.assigned_at
     FROM user_articles ua
     INNER JOIN users u ON u.id = ua.user_id
     WHERE ua.article_id = ?
     ORDER BY ua.assigned_at ASC`,
    [articleId],
  );
  return rows.map((row) => ({
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    role: row.role,
    assignedAt: row.assigned_at,
  }));
}

async function createArticleRecord(payload) {
  const id = uid("article");
  const now = nowIso();
  await run(
    `INSERT INTO articles
     (id, type, version, title, subtitle, author, book, volume, publish_year, writing_year, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      payload.type || "1",
      payload.version || "1.0",
      payload.title || "",
      payload.subtitle || "",
      payload.author || "",
      payload.book || "",
      payload.volume || "",
      payload.publishYear || "",
      payload.writingYear || "",
      now,
      now,
    ],
  );
  const row = await get("SELECT * FROM articles WHERE id = ?", [id]);
  return row ? mapArticleRow(row) : null;
}

async function deleteArticle(articleId) {

  const pageRows = await all("SELECT src FROM pages WHERE article_id = ?", [
    articleId,
  ]);

  const glyphRows = await all(
    "SELECT img_src FROM glyphs WHERE article_id = ?",
    [articleId],
  );

  await run("DELETE FROM articles WHERE id = ?", [articleId]);

  pageRows.forEach((row) => {
    if (!row.src) return;
    const diskPath = path.join(PROJECT_ROOT, row.src.replace(/^\//, ""));
    if (fs.existsSync(diskPath)) fs.unlinkSync(diskPath);
  });
  glyphRows.forEach((row) => {
    if (!row.img_src) return;
    const diskPath = path.join(PROJECT_ROOT, row.img_src.replace(/^\//, ""));
    if (fs.existsSync(diskPath)) fs.unlinkSync(diskPath);
  });
}

module.exports = {
  initDatabase,
  getArticle,
  ensureArticle,
  upsertArticle,
  createPages,
  clearPagesByArticle,
  getPageRow,
  createAnnotation,
  updateAnnotation,
  deleteAnnotation,
  getChildAnnotations,
  addAnnotationRegion,
  getAnnotationsForPage,
  getRegionsByPage,
  getRegionsByAnnotation,
  getAnnotationRegion,
  deleteAnnotationRegion,
  updateAnnotationRegion,
  reorderAnnotationRegions,
  getHeadingsByArticle,
  getHeadingById,
  getPageIdsByArticle,
  createHeading,
  updateHeadingParent,
  reorderHeadings,
  deleteHeading,
  getGlyphsByArticle,
  createGlyph,
  importGlyph,
  deleteGlyph,
  getPageSrcsByArticle,
  getSnapshot,

  hashPassword,
  verifyPassword,
  createToken,
  verifyToken,
  getUserByUsername,
  getUserById,
  listUsers,
  createUser,
  updateUser,
  deleteUser,

  getCommentsByArticle,
  createComment,
  updateComment,
  deleteComment,

  listArticles,
  listArticlesForUser,
  checkArticleAccess,
  assignArticleAccess,
  removeArticleAccess,
  getArticleAccessUsers,
  createArticleRecord,
  deleteArticle,
};
