import net from "node:net";

const PIPE = "\\\\.\\pipe\\sp_remote_control";

export async function addToSoundpad(
  filePath: string,
  category: string = "Quick Cut"
): Promise<{ ok: boolean; error?: string }> {
  let settled = false;
  return new Promise((resolve) => {
    const done = (result: { ok: boolean; error?: string }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      client.destroy();
      resolve(result);
    };

    const client = net.createConnection(PIPE, () => {
      const cmd = JSON.stringify({
        Type: "AddSound",
        Sound: { Path: filePath, Index: -1, Category: category },
      });
      client.write(cmd + "\n");
    });

    let data = "";
    client.on("data", (chunk) => { data += chunk.toString(); });
    client.on("error", () => done({ ok: false, error: "Soundpad 未运行" }));
    client.on("close", () => done({ ok: false, error: "连接已关闭" }));
    client.on("end", () => {
      try {
        const resp = JSON.parse(data);
        if (resp.Status === "OK") done({ ok: true });
        else done({ ok: false, error: resp.Error || "未知错误" });
      } catch {
        done({ ok: false, error: "无效响应" });
      }
    });

    const timer = setTimeout(() => done({ ok: false, error: "连接超时" }), 3000);
  });
}
