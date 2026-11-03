// Открываем базу данных Deno KV для хранения сообщений
const kv = await Deno.openKv();

Deno.serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);

  // --- ЛОГИКА ДЛЯ ИИ (Наш старый код для помощника) ---
  if (req.method === "POST" && url.pathname === "/") {
    try {
      const body = await req.json();
      
      if (body.messages) {
        const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
        if (!GROQ_API_KEY) throw new Error("Ключ не настроен");

        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${GROQ_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...body,
            model: "openai/gpt-oss-120b"
          }),
        });
        const data = await response.json();
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // --- ЛОГИКА ДЛЯ ЧАТА ---
  
  // Отправить сообщение
  if (req.method === "POST" && url.pathname === "/chat") {
    const body = await req.json();
    const key = ["chat", body.productId];
    const message = { text: body.text, sender: body.sender, time: Date.now() };
    
    const existing = await kv.get(key);
    let messages = existing.value || [];
    messages.push(message);
    await kv.set(key, messages);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Получить сообщения
  if (req.method === "GET" && url.pathname === "/chat") {
    const productId = url.searchParams.get("productId");
    if (!productId) return new Response("No ID", { status: 400, headers: corsHeaders });

    const existing = await kv.get(["chat", productId]);
    const messages = existing.value || [];

    return new Response(JSON.stringify(messages), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response("Метод не разрешен", { status: 405, headers: corsHeaders });
});