/**
 * OCR Provider abstraction layer.
 * Supports pluggable providers (Baidu, etc.) via a common interface.
 */

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

/* ------------------------------------------------------------------ */
/*  Base class                                                         */
/* ------------------------------------------------------------------ */

class OcrProvider {
  /** Recognize text in an image buffer. Returns [{ text, confidence }]. */
  async recognizeRegion(/* imageBuffer */) {
    throw new Error("recognizeRegion() not implemented");
  }

  /** Detect text regions in an image buffer. Returns [{ x, y, width, height, text, confidence }]. */
  async detectLayout(/* imageBuffer */) {
    throw new Error("detectLayout() not implemented");
  }
}

/* ------------------------------------------------------------------ */
/*  Baidu OCR provider                                                 */
/* ------------------------------------------------------------------ */

class BaiduOcrProvider extends OcrProvider {
  constructor(apiKey, secretKey) {
    super();
    this.apiKey = apiKey;
    this.secretKey = secretKey;
    this._accessToken = null;
    this._tokenExpiry = 0;
  }

  async _ensureToken() {
    if (this._accessToken && Date.now() < this._tokenExpiry) {
      return this._accessToken;
    }
    const url =
      `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials` +
      `&client_id=${encodeURIComponent(this.apiKey)}` +
      `&client_secret=${encodeURIComponent(this.secretKey)}`;
    const res = await fetch(url, { method: "POST" });
    if (!res.ok) {
      throw new Error(`Baidu token request failed: ${res.status}`);
    }
    const data = await res.json();
    if (!data.access_token) {
      throw new Error("Baidu token response missing access_token");
    }
    this._accessToken = data.access_token;
    // Token valid for 30 days; refresh 1 day early
    this._tokenExpiry = Date.now() + (data.expires_in - 86400) * 1000;
    return this._accessToken;
  }

  async recognizeRegion(imageBuffer) {
    const token = await this._ensureToken();
    const base64 = imageBuffer.toString("base64");
    const body = `image=${encodeURIComponent(base64)}`;
    const url = `https://aip.baidubce.com/rest/2.0/ocr/v1/accurate_basic?access_token=${token}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) {
      throw new Error(`Baidu OCR request failed: ${res.status}`);
    }
    const data = await res.json();
    if (data.error_code) {
      throw new Error(`Baidu OCR error ${data.error_code}: ${data.error_msg}`);
    }
    return (data.words_result || []).map((item) => ({
      text: item.words,
      confidence: item.probability ? item.probability.average : null,
    }));
  }

  async detectLayout(imageBuffer, level) {
    const token = await this._ensureToken();
    const base64 = imageBuffer.toString("base64");
    const granularity = level === "char" ? "small" : "big";
    const body = `image=${encodeURIComponent(base64)}&recognize_granularity=${granularity}`;
    const url = `https://aip.baidubce.com/rest/2.0/ocr/v1/general?access_token=${token}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) {
      throw new Error(`Baidu layout request failed: ${res.status}`);
    }
    const data = await res.json();
    if (data.error_code) {
      throw new Error(`Baidu OCR error ${data.error_code}: ${data.error_msg}`);
    }

    // 逐字模式：从 chars 数组中提取每个字的位置
    if (level === "char") {
      const results = [];
      for (const item of data.words_result || []) {
        if (Array.isArray(item.chars) && item.chars.length > 0) {
          for (const ch of item.chars) {
            results.push({
              x: ch.location.left,
              y: ch.location.top,
              width: ch.location.width,
              height: ch.location.height,
              text: ch.char,
              confidence: null,
            });
          }
        }
      }
      // 如果 API 未返回逐字数据，回退为逐行结果
      if (results.length === 0 && (data.words_result || []).length > 0) {
        console.warn("[OCR] 逐字模式未获得字符级数据，回退为逐行结果");
        return (data.words_result || []).map((item) => ({
          x: item.location.left,
          y: item.location.top,
          width: item.location.width,
          height: item.location.height,
          text: item.words,
          confidence: item.probability ? item.probability.average : null,
          _fallbackToLine: true,
        }));
      }
      return results;
    }

    // 逐行模式：直接返回行级结果
    return (data.words_result || []).map((item) => ({
      x: item.location.left,
      y: item.location.top,
      width: item.location.width,
      height: item.location.height,
      text: item.words,
      confidence: item.probability ? item.probability.average : null,
    }));
  }
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/**
 * Crop a rectangular region from an image file and return a buffer.
 */
async function cropImage(imagePath, rect) {
  const { x, y, width, height } = rect;
  return sharp(imagePath)
    .extract({ left: Math.round(x), top: Math.round(y), width: Math.round(width), height: Math.round(height) })
    .toBuffer();
}

/**
 * Read a full image file as a buffer.
 */
async function readImageBuffer(imagePath) {
  return fs.promises.readFile(imagePath);
}

/* ------------------------------------------------------------------ */
/*  Factory                                                            */
/* ------------------------------------------------------------------ */

let _provider = null;

function loadConfig() {
  const configPath = path.join(__dirname, "ocr-config.json");
  if (!fs.existsSync(configPath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(configPath, "utf-8"));
}

function createOcrProvider(config) {
  if (!config) return null;
  switch (config.provider) {
    case "baidu": {
      const { apiKey, secretKey } = config.baidu || {};
      if (!apiKey || !secretKey) {
        console.warn("[OCR] Baidu provider configured but missing apiKey/secretKey");
        return null;
      }
      return new BaiduOcrProvider(apiKey, secretKey);
    }
    default:
      console.warn(`[OCR] Unknown provider: ${config.provider}`);
      return null;
  }
}

function getProvider() {
  if (!_provider) {
    const config = loadConfig();
    _provider = createOcrProvider(config);
  }
  return _provider;
}

module.exports = {
  OcrProvider,
  BaiduOcrProvider,
  createOcrProvider,
  getProvider,
  cropImage,
  readImageBuffer,
};
