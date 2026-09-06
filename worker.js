export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return new Response("Bot is running!");
    }

    const update = await request.json();

    if (!update.message) {
      return new Response("OK");
    }

    const message = update.message;
    const userId = message.from.id;
    const chatId = message.chat.id;

    // ТВОЙ Telegram ID сюда пока НЕ вставляем.
    // После настройки добавим его безопасно через Cloudflare Secret.

    if (message.text === "/start") {
      await sendMessage(
        env.BOT_TOKEN,
        chatId,
        "👋 Привет!\n\nНапиши здесь своё сообщение — оно будет отправлено анонимно владельцу бота.",
      );
      return new Response("OK");
    }

    // Здесь позже будет отправка сообщения ТЕБЕ.
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
