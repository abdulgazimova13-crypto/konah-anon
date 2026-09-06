const OWNER_ID = 6793301579; //

export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return new Response("Bot is running!");
    }

    const update = await request.json();

    if (update.callback_query) {
      const callback = update.callback_query;

      if (callback.from.id !== OWNER_ID) return new Response("OK");

      if (callback.data.startsWith("reply:")) {
        const targetId = callback.data.split(":")[1];

        await fetch(
          `https://api.telegram.org/bot${env.BOT_TOKEN}/answerCallbackQuery`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              callback_query_id: callback.id
            })
          }
        );

        await sendMessage(
          env.BOT_TOKEN,
          OWNER_ID,
          "✍️ Теперь ответь на сообщение с помощью функции «Ответить»."
        );

        await sendMessage(
          env.BOT_TOKEN,
          OWNER_ID,
          `__REPLY_TARGET_${targetId}__`
        );
      }

      return new Response("OK");
    }

    if (!update.message) return new Response("OK");

    const message = update.message;
    const chatId = message.chat.id;
    const text = message.text || "";

    if (text === "/start") {
      await sendMessage(
        env.BOT_TOKEN,
        chatId,
        "👋 Привет!\n\nНапиши здесь сообщение, и оно будет отправлено владельцу анонимно."
      );
      return new Response("OK");
    }

    if (chatId === OWNER_ID && message.reply_to_message) {
      const match = message.reply_to_message.text?.match(
        /__REPLY_TARGET_(\d+)__/
      );

      if (match) {
        await sendMessage(
          env.BOT_TOKEN,
          match[1],
          `💬 Ответ владельца:\n\n${text}`
        );

        await sendMessage(
          env.BOT_TOKEN,
          OWNER_ID,
          "✅ Ответ отправлен!"
        );

        return new Response("OK");
      }
    }

    if (chatId !== OWNER_ID) {
      await sendMessage(
        env.BOT_TOKEN,
        OWNER_ID,
        `💌 Анонимное сообщение:\n\n${text}`,
        {
          inline_keyboard: [
            [
              {
                text: "💬 Ответить",
                callback_data: `reply:${chatId}`
              }
            ]
          ]
        }
      );

      await sendMessage(
        env.BOT_TOKEN,
        chatId,
        "✅ Сообщение отправлено анонимно!"
      );
    }

    return new Response("OK");
  }
};

async function sendMessage(token, chatId, text, options = {}) {
  const body = {
    chat_id: chatId,
    text
  };

  if (options.inline_keyboard) {
    body.reply_markup = {
      inline_keyboard: options.inline_keyboard
    };
  }

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
              }
