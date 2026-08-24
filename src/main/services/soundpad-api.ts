import net from "node:net";
import iconv from "iconv-lite";
import type { SoundpadResult } from "../../shared/types.js";

// Soundpad's remote control uses a plain-text command protocol over a named
// pipe (not JSON). Commands look like:
//
//   DoAddSound("C:\sounds\clip.wav")
//   DoAddSound("C:\sounds\clip.wav", <categoryIndex>, <position>)
//   DoAddCategory("Name", <parentIndex>)
//   GetCategories(false, false)   -> XML category tree
//
// Successful responses start with "R-200"; errors are R-xxx.
// Reference: leppsoft.com/soundpad/en/rc/ (SoundRemoteControl.java)
//
// Important encoding detail: commands are read by Soundpad in the system ANSI
// codepage (GBK on Chinese Windows), while responses come back as UTF-8. We
// therefore encode the request with GBK and decode the response as UTF-8.

const PIPE = "\\\\.\\pipe\\sp_remote_control";
const TIMEOUT_MS = 3000;
const QUIET_MS = 150;

interface CategoryInfo {
  index: number;
  name: string;
}

function escapeForCommand(value: string): string {
  // Soundpad expects Windows paths with backslashes; only quotes need escaping.
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function isSuccess(response: string): boolean {
  return response.startsWith("R-200");
}

function resultFor(response: string): SoundpadResult {
  if (!response) return { ok: false, error: "Soundpad 未运行或未启用远程控制" };
  if (isSuccess(response)) return { ok: true };
  const code = response.slice(0, 200);
  if (code.startsWith("R-204")) {
    return { ok: false, error: "Soundpad 无法读取该文件（路径可能包含非英文字符）" };
  }
  return { ok: false, error: code };
}

function parseCategories(xml: string): CategoryInfo[] {
  const categories: CategoryInfo[] = [];
  const tagRe = /<Category\b[^>]*>/g;
  let match: RegExpExecArray | null;
  while ((match = tagRe.exec(xml))) {
    const tag = match[0];
    const index = /index="(\d+)"/.exec(tag)?.[1];
    const name = /name="([^"]*)"/.exec(tag)?.[1];
    if (index !== undefined && name !== undefined) {
      categories.push({ index: parseInt(index, 10), name });
    }
  }
  return categories;
}

// Sends one command and waits until the response stops growing (the pipe stays
// open after a reply, so we settle on a short quiet period instead of close).
function sendCommand(command: string): Promise<string> {
  return new Promise((resolve) => {
    const client = net.createConnection(PIPE);
    let buffer = "";
    let settled = false;
    let quietTimer: NodeJS.Timeout | undefined;

    const finish = (result: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutTimer);
      if (quietTimer) clearTimeout(quietTimer);
      client.destroy();
      resolve(result);
    };

    const scheduleQuietFinish = () => {
      if (quietTimer) clearTimeout(quietTimer);
      quietTimer = setTimeout(() => finish(buffer.trim()), QUIET_MS);
    };

    const timeoutTimer = setTimeout(() => finish(buffer.trim()), TIMEOUT_MS);

    client.on("connect", () => {
      client.write(iconv.encode(command, "gbk"));
    });
    client.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      scheduleQuietFinish();
    });
    client.on("error", () => finish(""));
    client.on("close", () => finish(buffer.trim()));
  });
}

async function resolveCategoryIndex(name: string): Promise<number | null> {
  const xml = await sendCommand("GetCategories(false, false)");
  const category = parseCategories(xml).find((c) => c.name === name);
  return category?.index ?? null;
}

export async function addToSoundpad(
  filePath: string,
  category = "Quick Cut",
): Promise<SoundpadResult> {
  try {
    if (!category) {
      return resultFor(await sendCommand(`DoAddSound("${escapeForCommand(filePath)}")`));
    }

    let categoryIndex = await resolveCategoryIndex(category);
    if (categoryIndex === null) {
      const createResponse = await sendCommand(
        `DoAddCategory("${escapeForCommand(category)}", 0)`,
      );
      if (!isSuccess(createResponse)) {
        return {
          ok: false,
          error: createResponse
            ? `创建分类失败: ${createResponse.slice(0, 200)}`
            : "Soundpad 未运行或未启用远程控制",
        };
      }
      // Soundpad may need a moment to refresh the category tree after creation.
      for (let attempt = 0; attempt < 3 && categoryIndex === null; attempt++) {
        await new Promise((r) => setTimeout(r, 150));
        categoryIndex = await resolveCategoryIndex(category);
      }
      if (categoryIndex === null) {
        return { ok: false, error: "分类创建后未能定位" };
      }
    }

    const addResponse = await sendCommand(
      `DoAddSound("${escapeForCommand(filePath)}", ${categoryIndex}, -1)`,
    );
    return resultFor(addResponse);
  } catch (err) {
    return { ok: false, error: (err as Error).message || "未知错误" };
  }
}
