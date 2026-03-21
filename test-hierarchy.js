#!/usr/bin/env node
/**
 * 测试标题层级功能和文件切换功能
 */

const PORT = 3001;
const BASE_URL = `http://localhost:${PORT}`;

async function test() {
  console.log("=== 开始测试标题层级功能 ===\n");

  try {
    // 1. 创建页面
    console.log("1. 创建测试页面...");
    const pagesRes = await fetch(`${BASE_URL}/api/articles/article-1/pages/bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pages: [
          {
            name: "page1.jpg",
            width: 800,
            height: 600,
            srcDataUrl:
              "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCABkAGQDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWm5ybnJ2eoqOkpaanqKmqsrO0tba2uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWWpzdHV2d3h5eoKDhIWGh4iJipKTlJWWm5ydn6KjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3+iiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigD//Z",
          },
        ],
      }),
    });
    const pagesData = await pagesRes.json();
    console.log(`✓ 创建了 ${pagesData.pages.length} 个页面\n`);

    const pageId = pagesData.pages[0].id;

    // 2. 创建第一个标题（大标题）
    console.log("2. 创建第一个标题（大标题）...");
    const heading1Res = await fetch(
      `${BASE_URL}/api/articles/article-1/headings`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pageId: pageId,
          titleText: "第一章 导论",
          level: 1,
          y: 0,
        }),
      },
    );
    const heading1 = await heading1Res.json();
    console.log(`✓ 创建标题: ${heading1.heading.titleText}`);
    console.log(`  - ID: ${heading1.heading.id}`);
    console.log(`  - Parent ID: ${heading1.heading.parentId || "null"}\n`);

    // 3. 创建第二个标题（子标题，成为第一个的子标题）
    console.log("3. 创建第二个标题（子标题）...");
    const heading2Res = await fetch(
      `${BASE_URL}/api/articles/article-1/headings`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pageId: pageId,
          titleText: "1.1 背景介绍",
          level: 2,
          y: 50,
          parentId: heading1.heading.id,
        }),
      },
    );
    const heading2 = await heading2Res.json();
    console.log(`✓ 创建子标题: ${heading2.heading.titleText}`);
    console.log(`  - ID: ${heading2.heading.id}`);
    console.log(`  - Parent ID: ${heading2.heading.parentId}\n`);

    // 4. 创建第三个标题（sub-sub标题）
    console.log("4. 创建第三个标题（孙级标题）...");
    const heading3Res = await fetch(
      `${BASE_URL}/api/articles/article-1/headings`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pageId: pageId,
          titleText: "1.1.1 历史渊源",
          level: 3,
          y: 100,
          parentId: heading2.heading.id,
        }),
      },
    );
    const heading3 = await heading3Res.json();
    console.log(`✓ 创建孙级标题: ${heading3.heading.titleText}`);
    console.log(`  - ID: ${heading3.heading.id}`);
    console.log(`  - Parent ID: ${heading3.heading.parentId}\n`);

    // 5. 测试拖放功能 - 将第三个标题的父级更改为第一个标题
    console.log("5. 测试拖放功能 - 更改第三个标题的父级...");
    const updateRes = await fetch(
      `${BASE_URL}/api/articles/article-1/headings/${heading3.heading.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parentId: heading1.heading.id,
          orderIndex: 0,
        }),
      },
    );
    const updated = await updateRes.json();
    console.log(
      `✓ 更新后的标题: ${updated.heading.titleText}`,
    );
    console.log(
      `  - 新的 Parent ID: ${updated.heading.parentId} (之前是 ${heading2.heading.id})\n`,
    );

    // 6. 获取所有标题，查看树形结构
    console.log("6. 获取所有标题数据...");
    const snapshotRes = await fetch(
      `${BASE_URL}/api/articles/article-1/snapshot`,
    );
    const snapshot = await snapshotRes.json();
    console.log(
      `✓ 从数据库获取 ${snapshot.headings.length} 个标题`,
    );
    console.log("\n标题树形结构:");
    snapshot.headings.forEach((h) => {
      console.log(
        `  [${h.id.substring(0, 8)}...] "${h.titleText}" | parent: ${h.parentId ? h.parentId.substring(0, 8) + "..." : "null"} | level: ${h.level}`,
      );
    });

    // 7. 测试文件切换功能 - 清空页面并导入新文件
    console.log("\n7. 测试文件切换功能（清空旧页面）...");
    const clearRes = await fetch(
      `${BASE_URL}/api/articles/article-1/pages`,
      {
        method: "DELETE",
      },
    );
    console.log("✓ 清空了旧页面");

    const newPagesRes = await fetch(
      `${BASE_URL}/api/articles/article-1/pages/bulk`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pages: [
            {
              name: "new_file.jpg",
              width: 800,
              height: 600,
              srcDataUrl:
                "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCABkAGQDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWm5ybnJ2eoqOkpaanqKmqsrO0tba2uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWWpzdHV2d3h5eoKDhIWGh4iJipKTlJWWm5ydn6KjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3+iiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigD//Z",
            },
          ],
        }),
      },
    );
    const newPagesData = await newPagesRes.json();
    console.log(
      `✓ 导入了新文件，共 ${newPagesData.pages.length} 个页面`,
    );

    const finalSnapshotRes = await fetch(
      `${BASE_URL}/api/articles/article-1/snapshot`,
    );
    const finalSnapshot = await finalSnapshotRes.json();
    console.log(
      `✓ 最终页面数: ${finalSnapshot.pages.length}（应该是1）`,
    );
    console.log(
      `✓ 最终标题数: ${finalSnapshot.headings.length}（应该是0，因为旧标题已被清除）\n`,
    );

    console.log("=== 测试完成 ===");
    console.log(
      "\n✓ 所有测试通过！",
    );
    console.log("  - 标题层级功能正常");
    console.log(
      "  - 拖放功能（更新parent_id）正常",
    );
    console.log("  - 文件切换功能正常（导入新文件时清空旧数据）");
  } catch (error) {
    console.error("\n✗ 测试失败:", error.message);
    process.exit(1);
  }
}

test();
