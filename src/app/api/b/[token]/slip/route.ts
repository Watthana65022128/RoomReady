import { billGateway } from "@/lib/public-bill";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const responseHeaders = { "Cache-Control": "private, no-store" };
  if (!/^[a-f0-9]{64}$/.test(token))
    return Response.json(
      { error: "ไม่พบบิล" },
      { status: 404, headers: responseHeaders },
    );
  if (
    request.headers.get("origin") &&
    request.headers.get("origin") !== new URL(request.url).origin
  )
    return Response.json(
      { error: "คำขอไม่ถูกต้อง" },
      { status: 403, headers: responseHeaders },
    );
  if (Number(request.headers.get("content-length") || 0) > 5500000)
    return Response.json(
      { error: "ไฟล์ต้องไม่เกิน 5 MB" },
      { status: 413, headers: responseHeaders },
    );
  try {
    const reader = request.body?.getReader();
    if (!reader)
      return Response.json({ error: "กรุณาเลือกไฟล์" }, { status: 400 });
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      total += part.value.length;
      if (total > 5500000) {
        await reader.cancel();
        return Response.json(
          { error: "ไฟล์ต้องไม่เกิน 5 MB" },
          { status: 413 },
        );
      }
      chunks.push(part.value);
    }
    const body = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) {
      body.set(c, offset);
      offset += c.length;
    }
    const response = await billGateway(token, {
      method: "POST",
      headers: { "Content-Type": request.headers.get("content-type") || "" },
      body,
    });
    return new Response(await response.text(), {
      status: response.status,
      headers: { ...responseHeaders, "Content-Type": "application/json" },
    });
  } catch {
    return Response.json(
      { error: "ส่งไม่สำเร็จ กรุณาลองอีกครั้ง" },
      { status: 503, headers: responseHeaders },
    );
  }
}
