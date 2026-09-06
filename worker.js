const OWNER_ID = 6793301579; // 

export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return new Response("Bot is running!");
    }

    const update = await request.json();
    const message = update.message;

    if (!message) return new Response("OK");

    const chatId = message.chat.id;
    const text = message.text || "";

    if (text === "/start") {
      await sendMessage(
        env.BOT_TOKEN,
        chatId,
        "👋 Привет!\n\nНапиши мне сообщение, и я анонимно передам его владельцу этого бота."
      );
      return new Response("OK");
    }

    // Отправляем сообщение владельцу
    await sendMessage(
      env.BOT_TOKEN,
      OWNER_ID,
      `💌 Анонимное сообщение:\n\n${text}`
    );

    await sendMessage(
      env.BOT_TOKEN,
      chatId,
      "✅ Сообщение отправлено анонимно!"
    );

    return new Response("OK");
  },
};

async function sendMessage(token, chatId, text) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
    }),
  });
      }
