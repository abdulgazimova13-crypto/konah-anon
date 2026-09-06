export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return new Response("Anon bot is running!", { status: 200 });
    }

    try {
      const update = await request.json();

      if (!update.message) {
        return new Response("OK");
      }

      const message = update.message;
      const userId = message.from.id;

      // Create user
      await env.DB.prepare(
        "INSERT OR IGNORE INTO users (id, waiting, partner) VALUES (?, 0, NULL)"
      ).bind(userId).run();

      // Telegram commands
      if (message.text === "/start") {
        await sendMessage(
          env.BOT_TOKEN,
          userId,
          "👋 Добро пожаловать в анонимный чат!\n\n" +
          "Твои данные не показываются собеседнику.\n\n" +
          "🔎 Нажми «Найти собеседника».",
          keyboard()
        );
        return new Response("OK");
      }

      const text = message.text || "";

      if (text === "🔎 Найти собеседника") {
        await findPartner(env, userId);
        return new Response("OK");
      }

      if (text === "⏭️ Следующий") {
        await nextPartner(env, userId);
        return new Response("OK");
      }

      if (text === "🛑 Закончить") {
        await stopChat(env, userId);
        return new Response("OK");
      }

      if (text === "🚫 Заблокировать") {
        await blockPartner(env, userId);
        return new Response("OK");
      }

      if (text === "⚠️ Пожаловаться") {
        await reportPartner(env, userId);
        return new Response("OK");
      }

      // Forward any other message anonymously
      const user = await env.DB.prepare(
        "SELECT partner FROM users WHERE id = ?"
      ).bind(userId).first();

      if (!user || !user.partner) {
        await sendMessage(
          env.BOT_TOKEN,
          userId,
          "Сначала найди собеседника 🔎",
          keyboard()
        );
        return new Response("OK");
      }

      await copyMessage(
        env.BOT_TOKEN,
        user.partner,
        message.chat.id,
        message.message_id
      );

      return new Response("OK");

    } catch (error) {
      console.log(error);
      return new Response("OK");
    }
  }
};


// ---------- KEYBOARD ----------

function keyboard() {
  return {
    keyboard: [
      ["🔎 Найти собеседника"],
      ["⏭️ Следующий", "🛑 Закончить"],
      ["🚫 Заблокировать", "⚠️ Пожаловаться"]
    ],
    resize_keyboard: true
  };
}


// ---------- FIND PARTNER ----------

async function findPartner(env, userId) {
  const current = await env.DB.prepare(
    "SELECT partner, waiting FROM users WHERE id = ?"
  ).bind(userId).first();

  if (current?.partner) {
    await sendMessage(
      env.BOT_TOKEN,
      userId,
      "💬 Ты уже общаешься с собеседником.",
      keyboard()
    );
    return;
  }

  if (current?.waiting) {
    await sendMessage(
      env.BOT_TOKEN,
      userId,
      "🔎 Я уже ищу тебе собеседника...",
      keyboard()
    );
    return;
  }

  const partner = await env.DB.prepare(
    "SELECT id FROM users WHERE waiting = 1 AND partner IS NULL AND id != ? LIMIT 1"
  ).bind(userId).first();

  if (!partner) {
    await env.DB.prepare(
      "UPDATE users SET waiting = 1 WHERE id = ?"
    ).bind(userId).run();

    await sendMessage(
      env.BOT_TOKEN,
      userId,
      "🔎 Ищу тебе собеседника...",
      keyboard()
    );

    return;
  }

  const partnerId = partner.id;

  await env.DB.prepare(
    "UPDATE users SET partner = ?, waiting = 0 WHERE id = ?"
  ).bind(partnerId, userId).run();

  await env.DB.prepare(
    "UPDATE users SET partner = ?, waiting = 0 WHERE id = ?"
  ).bind(userId, partnerId).run();

  await sendMessage(
    env.BOT_TOKEN,
    userId,
    "🎉 Собеседник найден!\n\nМожешь писать.",
    keyboard()
  );

  await sendMessage(
    env.BOT_TOKEN,
    partnerId,
    "🎉 Собеседник найден!\n\nМожешь писать.",
    keyboard()
  );
}


// ---------- STOP ----------

async function stopChat(env, userId) {
  const user = await env.DB.prepare(
    "SELECT partner, waiting FROM users WHERE id = ?"
  ).bind(userId).first();

  if (user?.waiting) {
    await env.DB.prepare(
      "UPDATE users SET waiting = 0 WHERE id = ?"
    ).bind(userId).run();

    await sendMessage(
      env.BOT_TOKEN,
      userId,
      "🛑 Поиск отменён.",
      keyboard()
    );

    return;
  }

  if (!user?.partner) {
    await sendMessage(
      env.BOT_TOKEN,
      userId,
      "У тебя нет активного диалога.",
      keyboard()
    );

    return;
  }

  const partnerId = user.partner;

  await env.DB.prepare(
    "UPDATE users SET partner = NULL WHERE id = ?"
  ).bind(userId).run();

  await env.DB.prepare(
    "UPDATE users SET partner = NULL WHERE id = ?"
  ).bind(partnerId).run();

  await sendMessage(
    env.BOT_TOKEN,
    userId,
    "🛑 Диалог завершён.",
    keyboard()
  );

  await sendMessage(
    env.BOT_TOKEN,
    partnerId,
    "🛑 Собеседник завершил диалог.",
    keyboard()
  );
}


// ---------- NEXT ----------

async function nextPartner(env, userId) {
  await stopChat(env, userId);
  await findPartner(env, userId);
}


// ---------- BLOCK ----------

async function blockPartner(env, userId) {
  const user = await env.DB.prepare(
    "SELECT partner FROM users WHERE id = ?"
  ).bind(userId).first();

  if (!user?.partner) {
    await sendMessage(
      env.BOT_TOKEN,
      userId,
      "Нет собеседника для блокировки.",
      keyboard()
    );
    return;
  }

  const partnerId = user.partner;

  await env.DB.prepare(
    "INSERT OR IGNORE INTO blocks (user_id, blocked_id) VALUES (?, ?)"
  ).bind(userId, partnerId).run();

  await env.DB.prepare(
    "UPDATE users SET partner = NULL WHERE id = ?"
  ).bind(userId).run();

  await env.DB.prepare(
    "UPDATE users SET partner = NULL WHERE id = ?"
  ).bind(partnerId).run();

  await sendMessage(
    env.BOT_TOKEN,
    userId,
    "🚫 Собеседник заблокирован.",
    keyboard()
  );

  await sendMessage(
    env.BOT_TOKEN,
    partnerId,
    "🛑 Диалог завершён.",
    keyboard()
  );
}


// ---------- REPORT ----------

async function reportPartner(env, userId) {
  const user = await env.DB.prepare(
    "SELECT partner FROM users WHERE id = ?"
  ).bind(userId).first();

  if (!user?.partner) {
    await sendMessage(
      env.BOT_TOKEN,
      userId,
      "Нет активного собеседника.",
      keyboard()
    );
    return;
  }

  const partnerId = user.partner;

  await env.DB.prepare(
    "INSERT INTO reports (reporter, reported) VALUES (?, ?)"
  ).bind(userId, partnerId).run();

  await stopChat(env, userId);
}


// ---------- TELEGRAM ----------

async function sendMessage(token, chatId, text, replyMarkup) {
  return fetch(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        reply_markup: replyMarkup
      })
    }
  );
}


async function copyMessage(token, chatId, fromChatId, messageId) {
  return fetch(
    `https://api.telegram.org/bot${token}/copyMessage`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        chat_id: chatId,
        from_chat_id: fromChatId,
        message_id: messageId
      })
    }
  );
        }
